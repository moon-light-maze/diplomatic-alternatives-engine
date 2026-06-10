export interface SnapshotSummary {
  id: string;
  createdAt: string | null;
  scenarioTitle: string | null;
  totalToolCalls: number | null;
  estimatedTokens: number | null;
  stages: { stage: string; outcome: string }[];
}
export interface SnapshotList {
  latest: string | null;
  snapshots: SnapshotSummary[];
}
export interface Config {
  scenario: { title: string; description: string; seedParties: string[] };
  maxSources: number;
  scheduleHour: number;
  lastRunDate: string | null;
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<T>;
}

export const api = {
  config: () => fetch("/api/config").then(j<Config>),
  snapshots: () => fetch("/api/snapshots").then(j<SnapshotList>),
  reportUrl: (id: string) => `/api/snapshots/${id}/report`,
};

export type RefreshEvent =
  | { kind: "stage-start"; stage: string; model: string }
  | { kind: "tool"; stage: string; name: string; summary: string }
  | { kind: "status"; text: string }
  | { kind: "stage-done"; stage: string; outcome: string }
  | { kind: "done"; snapshotId: string }
  | { kind: "report-ready"; snapshotId: string }
  | { kind: "error"; error: string }
  | { kind: "end" };

export function refresh(onEvent: (e: RefreshEvent) => void): () => void {
  const es = new EventSource("/api/refresh");
  const on = (type: string, map: (d: any) => RefreshEvent) =>
    es.addEventListener(type, (ev) => onEvent(map(JSON.parse((ev as MessageEvent).data))));
  on("stage-start", (d) => ({ kind: "stage-start", stage: d.stage, model: d.model }));
  on("tool", (d) => ({ kind: "tool", stage: d.stage, name: d.name, summary: d.summary }));
  on("status", (d) => ({ kind: "status", text: d.text }));
  on("stage-done", (d) => ({ kind: "stage-done", stage: d.stage, outcome: d.outcome }));
  on("done", (d) => ({ kind: "done", snapshotId: d.snapshotId }));
  on("report-ready", (d) => ({ kind: "report-ready", snapshotId: d.snapshotId }));
  on("error", (d) => ({ kind: "error", error: d.error }));
  es.addEventListener("end", () => {
    onEvent({ kind: "end" });
    es.close();
  });
  es.onerror = () => es.close();
  return () => es.close();
}
