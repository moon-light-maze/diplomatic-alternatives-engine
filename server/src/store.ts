import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config, SnapshotMeta } from "./types.js";
import type { StageId } from "./schemas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, "..", "..");
export const DATA_ROOT = join(REPO_ROOT, "data");
export const SNAPSHOTS_ROOT = join(DATA_ROOT, "snapshots");
const CONFIG_PATH = join(DATA_ROOT, "config.json");

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

const DEFAULT_CONFIG: Config = {
  scenario: {
    id: "us-iran-israel",
    title: "US–Iran–Israel Conflict",
    description:
      "The interlocking confrontation between the United States, Iran, and Israel — covering Iran's nuclear program, direct and proxy military exchanges, sanctions, and the on/off diplomatic track.",
    seedParties: ["United States", "Iran", "Israel"],
    focus:
      "Map the current state of hostilities and negotiations and each party's red lines, demands, and needs; identify the deal most likely to take shape; then design a fairer, more sustainable diplomatic alternative and argue why it is better.",
  },
  maxSources: 14,
  scheduleHour: 5,
  lastRunDate: null,
};

export function getConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    ensureDir(DATA_ROOT);
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return DEFAULT_CONFIG;
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Config;
}

export function saveConfig(config: Config): void {
  ensureDir(DATA_ROOT);
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ---- Snapshots --------------------------------------------------------------

/** Snapshot ids are ISO-ish timestamps with ':' replaced so they're path-safe and sort lexically. */
export function newSnapshotId(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function snapshotDir(id: string): string {
  return join(SNAPSHOTS_ROOT, id);
}

export function listSnapshotIds(): string[] {
  if (!existsSync(SNAPSHOTS_ROOT)) return [];
  return readdirSync(SNAPSHOTS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
}

export function latestSnapshotId(): string | null {
  return listSnapshotIds()[0] ?? null;
}

export function writeStage(id: string, stage: StageId, data: unknown): void {
  ensureDir(snapshotDir(id));
  writeFileSync(join(snapshotDir(id), `${stage}.json`), JSON.stringify(data, null, 2));
}

export function readStage<T = unknown>(id: string, stage: StageId): T | null {
  const p = join(snapshotDir(id), `${stage}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

export function writeMeta(id: string, meta: SnapshotMeta): void {
  ensureDir(snapshotDir(id));
  writeFileSync(join(snapshotDir(id), "meta.json"), JSON.stringify(meta, null, 2));
}

export function readMeta(id: string): SnapshotMeta | null {
  const p = join(snapshotDir(id), "meta.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as SnapshotMeta;
}

export function reportPath(id: string): string {
  return join(snapshotDir(id), "report.html");
}

export function writeReport(id: string, html: string): void {
  ensureDir(snapshotDir(id));
  writeFileSync(reportPath(id), html);
}

export interface SnapshotBundle {
  id: string;
  meta: SnapshotMeta | null;
  findings: unknown;
  state: unknown;
  dealmaking: unknown;
  peaceplan: unknown;
  changelog: unknown;
}

export function readSnapshot(id: string): SnapshotBundle {
  return {
    id,
    meta: readMeta(id),
    findings: readStage(id, "findings"),
    state: readStage(id, "state"),
    dealmaking: readStage(id, "dealmaking"),
    peaceplan: readStage(id, "peaceplan"),
    changelog: readStage(id, "changelog"),
  };
}

export function appendRunLog(line: string): void {
  ensureDir(DATA_ROOT);
  appendFileSync(join(DATA_ROOT, "run.log"), `${new Date().toISOString()} ${line}\n`);
}

/** YYYY-MM-DD in US Pacific, for the same-day double-run guard. */
export function pacificDateString(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
