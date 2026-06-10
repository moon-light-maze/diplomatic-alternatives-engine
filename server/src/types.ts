import type { StageId } from "./schemas.js";

export interface Scenario {
  id: string;
  title: string;
  description: string;
  /** Seed parties; the agent may discover and add more. */
  seedParties: string[];
  /** Free-text analytic focus / framing. */
  focus: string;
}

export interface Config {
  scenario: Scenario;
  /** Max number of sources Stage 1 should gather (cost lever). */
  maxSources: number;
  /** Hour (local/Pacific) the daily job runs — informational; launchd is source of truth. */
  scheduleHour: number;
  /** YYYY-MM-DD of the last completed run, to prevent same-day double-runs. */
  lastRunDate: string | null;
}

export interface StageMeta {
  stage: StageId;
  model: string;
  outcome: "ok" | "parse_failed" | "error";
  toolCalls: number;
  ms: number;
}

export interface SnapshotMeta {
  id: string;
  createdAt: string;
  scenarioTitle: string;
  stages: StageMeta[];
  totalToolCalls: number;
  /** Rough output-token estimate logged for usage awareness. */
  estimatedTokens: number;
}
