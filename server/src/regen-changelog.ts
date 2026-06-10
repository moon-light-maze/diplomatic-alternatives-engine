import type { z } from "zod";
import { runModule } from "./agent.js";
import { parseAndValidate } from "./parse.js";
import { ChangelogSchema, type Findings, type State } from "./schemas.js";
import { changelogPrompt } from "./prompts.js";
import { renderReport } from "./report.js";
import {
  getConfig,
  listSnapshotIds,
  readStage,
  writeStage,
  snapshotDir,
  readSnapshot,
  writeReport,
} from "./store.js";

/**
 * One-off: (re)generate the sourced "events since last update" changelog for the
 * newest snapshot by diffing it against the previous one, then re-render its report.
 * Cheap (a single Sonnet call) compared with a full pipeline run.
 */
async function main() {
  const ids = listSnapshotIds(); // newest first
  if (ids.length < 2) {
    console.log("[regen] need at least 2 snapshots to build a changelog.");
    process.exit(0);
  }
  const [cur, prev] = ids;
  const scenario = getConfig().scenario;

  const findings = readStage<Findings>(cur, "findings");
  const state = readStage<State>(cur, "state");
  const prevState = readStage<State>(prev, "state");
  if (!findings || !state || !prevState) {
    console.error("[regen] missing findings/state/prevState.");
    process.exit(1);
  }

  console.log(`[regen] diffing ${cur} against ${prev}…`);
  const { system, user } = changelogPrompt(scenario, findings, state, prevState);
  const run = await runModule({
    system,
    user,
    cwd: snapshotDir(cur),
    model: "sonnet",
    maxTurns: 4,
    onEvent: (e) => e.kind === "tool" && console.log(`[regen]   ${e.name}(${e.summary})`),
  });

  const parsed = parseAndValidate(run.text, ChangelogSchema as unknown as z.ZodType<unknown>);
  if (!parsed.ok) {
    console.error("[regen] validation failed:", parsed.error);
    process.exit(1);
  }
  writeStage(cur, "changelog", parsed.data);
  writeReport(cur, renderReport(readSnapshot(cur)));
  console.log(`[regen] wrote changelog + re-rendered report for ${cur}.`);
}

main().catch((e) => {
  console.error("[regen] error:", e);
  process.exit(1);
});
