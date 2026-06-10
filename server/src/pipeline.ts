import type { z } from "zod";
import { runModule, type StreamEvent } from "./agent.js";
import { parseAndValidate } from "./parse.js";
import { STAGE_SCHEMAS, type StageId, type Findings, type State, type Dealmaking } from "./schemas.js";
import {
  gatherPrompt,
  statePrompt,
  dealmakingPrompt,
  peacePlanPrompt,
  changelogPrompt,
} from "./prompts.js";
import {
  getConfig,
  newSnapshotId,
  snapshotDir,
  writeStage,
  writeMeta,
  latestSnapshotId,
  readStage,
  appendRunLog,
} from "./store.js";
import { mkdirSync } from "node:fs";
import type { StageMeta, SnapshotMeta } from "./types.js";

export type PipelineEvent =
  | { kind: "stage-start"; stage: StageId; model: string }
  | { kind: "tool"; stage: StageId; name: string; summary: string }
  | { kind: "status"; text: string }
  | { kind: "stage-done"; stage: StageId; outcome: StageMeta["outcome"] }
  | { kind: "done"; snapshotId: string }
  | { kind: "error"; error: string };

const MODEL_FOR: Record<StageId, string> = {
  findings: "sonnet",
  state: "sonnet",
  dealmaking: "sonnet",
  peaceplan: "opus", // the one deep, prescriptive stage
  changelog: "sonnet",
};

const MAX_TURNS_FOR: Record<StageId, number> = {
  findings: 30, // web-heavy
  state: 6,
  dealmaking: 6,
  peaceplan: 8,
  changelog: 4,
};

function estTokens(...texts: string[]): number {
  return Math.round(texts.reduce((n, t) => n + t.length, 0) / 4);
}

// Web research dominates real usage: each WebSearch/WebFetch pulls page content into
// context that the prompt/output text can't see. This rough proxy keeps meta.estimatedTokens
// representative of actual subscription draw rather than only counting final outputs.
const TOKENS_PER_TOOL_CALL = 9000;

interface RunStageResult<T> {
  data: T;
  meta: StageMeta;
}

async function runStage<T>(opts: {
  id: string;
  stage: StageId;
  system: string;
  user: string;
  onEvent: (e: PipelineEvent) => void;
}): Promise<RunStageResult<T>> {
  const { id, stage, system, user, onEvent } = opts;
  const model = MODEL_FOR[stage];
  const schema = STAGE_SCHEMAS[stage] as unknown as z.ZodType<T>;
  const started = Date.now();
  let toolCalls = 0;

  onEvent({ kind: "stage-start", stage, model });

  const onStream = (e: StreamEvent) => {
    if (e.kind === "tool") {
      toolCalls++;
      onEvent({ kind: "tool", stage, name: e.name, summary: e.summary });
    } else if (e.kind === "status") {
      onEvent({ kind: "status", text: e.text });
    }
  };

  let prompt = user;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const run = await runModule({
      system,
      user: prompt,
      cwd: snapshotDir(id),
      model,
      maxTurns: MAX_TURNS_FOR[stage],
      onEvent: onStream,
    });

    if (!run.isError) {
      const parsed = parseAndValidate<T>(run.text, schema);
      if (parsed.ok && parsed.data !== undefined) {
        writeStage(id, stage, parsed.data);
        const meta: StageMeta = { stage, model, outcome: "ok", toolCalls, ms: Date.now() - started };
        onEvent({ kind: "stage-done", stage, outcome: "ok" });
        return { data: parsed.data, meta };
      }
      if (attempt === 1) {
        onEvent({ kind: "status", text: `${stage}: output did not validate, retrying… (${parsed.error})` });
        prompt = `${user}\n\nIMPORTANT: your previous reply did not validate. Error: ${parsed.error}\nReturn ONLY one fenced \`\`\`json block matching the required shape exactly.`;
        continue;
      }
      const meta: StageMeta = { stage, model, outcome: "parse_failed", toolCalls, ms: Date.now() - started };
      onEvent({ kind: "stage-done", stage, outcome: "parse_failed" });
      throw Object.assign(new Error(`${stage} failed validation: ${parsed.error}`), { meta });
    }

    const meta: StageMeta = { stage, model, outcome: "error", toolCalls, ms: Date.now() - started };
    onEvent({ kind: "stage-done", stage, outcome: "error" });
    throw Object.assign(new Error(`${stage} agent run errored`), { meta });
  }
  throw new Error(`${stage}: unreachable`);
}

/** Run the full 5-stage pipeline, writing a new snapshot. Returns its id. */
export async function runPipeline(onEvent: (e: PipelineEvent) => void): Promise<string> {
  const config = getConfig();
  const scenario = config.scenario;
  const now = new Date();
  // Capture the previous snapshot BEFORE creating the current one — otherwise the
  // current (highest-sorting) dir would be returned as "latest" and the changelog skipped.
  const prevId = latestSnapshotId();
  const id = newSnapshotId(now);
  mkdirSync(snapshotDir(id), { recursive: true });
  appendRunLog(`pipeline start snapshot=${id}`);

  const stages: StageMeta[] = [];
  let estimatedTokens = 0;
  const track = (m: StageMeta, ...texts: string[]) => {
    stages.push(m);
    estimatedTokens += estTokens(...texts);
  };

  try {
    // 1. Gather
    const gp = gatherPrompt(scenario, config.maxSources);
    const findings = await runStage<Findings>({ id, stage: "findings", system: gp.system, user: gp.user, onEvent });
    track(findings.meta, gp.system, gp.user, JSON.stringify(findings.data));
    onEvent({ kind: "status", text: `Gathered ${findings.data.findings.length} sources.` });

    // 2. Current State
    const sp = statePrompt(scenario, findings.data);
    const state = await runStage<State>({ id, stage: "state", system: sp.system, user: sp.user, onEvent });
    track(state.meta, sp.system, sp.user, JSON.stringify(state.data));
    onEvent({ kind: "status", text: `Mapped ${state.data.parties.length} parties.` });

    // 3. Deal-Making
    const dp = dealmakingPrompt(scenario, findings.data, state.data);
    const dealmaking = await runStage<Dealmaking>({ id, stage: "dealmaking", system: dp.system, user: dp.user, onEvent });
    track(dealmaking.meta, dp.system, dp.user, JSON.stringify(dealmaking.data));

    // 4. Improved Peace Plan (Opus)
    const pp = peacePlanPrompt(scenario, state.data, dealmaking.data);
    const peaceplan = await runStage({ id, stage: "peaceplan", system: pp.system, user: pp.user, onEvent });
    track(peaceplan.meta, pp.system, pp.user, JSON.stringify(peaceplan.data));

    // 5. Changelog (only if a prior snapshot's state exists)
    const prevState = prevId ? readStage<State>(prevId, "state") : null;
    if (prevState) {
      const cp = changelogPrompt(scenario, findings.data, state.data, prevState);
      try {
        const changelog = await runStage({ id, stage: "changelog", system: cp.system, user: cp.user, onEvent });
        track(changelog.meta, cp.system, cp.user, JSON.stringify(changelog.data));
      } catch (e) {
        onEvent({ kind: "status", text: `Changelog skipped: ${(e as Error).message}` });
      }
    }

    const totalToolCalls = stages.reduce((n, s) => n + s.toolCalls, 0);
    const meta: SnapshotMeta = {
      id,
      createdAt: now.toISOString(),
      scenarioTitle: scenario.title,
      stages,
      totalToolCalls,
      estimatedTokens: estimatedTokens + totalToolCalls * TOKENS_PER_TOOL_CALL,
    };
    writeMeta(id, meta);
    appendRunLog(`pipeline done snapshot=${id} tools=${meta.totalToolCalls} estTokens=${estimatedTokens}`);
    onEvent({ kind: "done", snapshotId: id });
    return id;
  } catch (err) {
    appendRunLog(`pipeline ERROR snapshot=${id}: ${(err as Error).message}`);
    // Still write whatever meta we have so a partial run is inspectable.
    const totalToolCalls = stages.reduce((n, s) => n + s.toolCalls, 0);
    writeMeta(id, {
      id,
      createdAt: now.toISOString(),
      scenarioTitle: scenario.title,
      stages,
      totalToolCalls,
      estimatedTokens: estimatedTokens + totalToolCalls * TOKENS_PER_TOOL_CALL,
    });
    onEvent({ kind: "error", error: (err as Error).message });
    throw err;
  }
}
