import { useEffect, useRef, useState } from "react";
import { api, refresh, type SnapshotList, type Config, type RefreshEvent } from "./api.js";

export function App() {
  const [list, setList] = useState<SnapshotList>({ latest: null, snapshots: [] });
  const [config, setConfig] = useState<Config | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<{ cls: string; text: string }[]>([]);
  const streamRef = useRef<HTMLDivElement>(null);

  async function load(selectLatest = false) {
    const l = await api.snapshots();
    setList(l);
    if (selectLatest && l.latest) setSelected(l.latest);
    else if (!selected && l.latest) setSelected(l.latest);
  }

  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
    load(true);
  }, []);

  useEffect(() => {
    streamRef.current?.scrollTo(0, streamRef.current.scrollHeight);
  }, [lines]);

  function runRefresh() {
    if (running) return;
    setRunning(true);
    setLines([{ cls: "status", text: "Starting daily refresh… (this can take a few minutes)" }]);
    const push = (cls: string, text: string) => setLines((ls) => [...ls, { cls, text }]);
    const onEvent = (e: RefreshEvent) => {
      switch (e.kind) {
        case "stage-start": push("stage", `▶ ${e.stage} (${e.model})`); break;
        case "tool": push("tool", `    ${e.stage}: ${e.name}(${e.summary})`); break;
        case "status": push("status", e.text); break;
        case "stage-done": push("done", `✓ ${e.stage} — ${e.outcome}`); break;
        case "report-ready":
        case "done": push("status", "Report ready."); load(true).then(() => setSelected(e.snapshotId)); break;
        case "error": push("err", `Error: ${e.error}`); break;
        case "end": setRunning(false); break;
      }
    };
    refresh(onEvent);
  }

  const fmt = (id: string, createdAt: string | null) =>
    createdAt ? new Date(createdAt).toLocaleString() : id;

  return (
    <div className="layout">
      <div className="sidebar">
        <div className="brand">Conflict Monitor</div>
        <div className="tagline">{config?.scenario.title ?? "Live conflict tracker"} · daily AI brief</div>

        <button className="primary" style={{ width: "100%", margin: "8px 0" }} onClick={runRefresh} disabled={running}>
          {running ? "Refreshing…" : "↻ Refresh now"}
        </button>
        {config?.lastRunDate && <div className="muted" style={{ fontSize: 11 }}>Last run: {config.lastRunDate} · auto-updates 5am PT</div>}

        {(running || lines.length > 0) && (
          <div className="stream" ref={streamRef} style={{ margin: "10px 0", maxHeight: 220 }}>
            {lines.map((l, i) => (
              <div key={i} className={l.cls}>{l.text}</div>
            ))}
          </div>
        )}

        <div className="muted" style={{ fontSize: 11, margin: "10px 0 4px", textTransform: "uppercase", letterSpacing: ".05em" }}>
          History ({list.snapshots.length})
        </div>
        {list.snapshots.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No snapshots yet. Click Refresh now.</div>}
        {list.snapshots.map((s) => (
          <div
            key={s.id}
            className={"case-item" + (s.id === selected ? " active" : "")}
            onClick={() => setSelected(s.id)}
          >
            <div className="nm" style={{ fontSize: 13 }}>{fmt(s.id, s.createdAt)}</div>
            <div className="dt">
              {s.stages.filter((x) => x.outcome === "ok").length}/{s.stages.length} stages
              {s.estimatedTokens ? ` · ~${Math.round(s.estimatedTokens / 1000)}k tok` : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="main" style={{ padding: 0 }}>
        {selected ? (
          <iframe
            key={selected}
            title="report"
            src={api.reportUrl(selected)}
            style={{ width: "100%", height: "100vh", border: "none", background: "#0f1115" }}
          />
        ) : (
          <div className="empty">
            No brief yet. Click <b>↻ Refresh now</b> to generate the first one (a few minutes), or wait for the 5am PT run.
          </div>
        )}
      </div>
    </div>
  );
}
