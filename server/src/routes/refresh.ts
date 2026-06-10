import { Router, type Response } from "express";
import { runPipeline } from "../pipeline.js";
import { renderReport } from "../report.js";
import {
  readSnapshot,
  writeReport,
  getConfig,
  saveConfig,
  pacificDateString,
} from "../store.js";

export const refreshRouter = Router();

// Module-level guard so the daily job and on-demand runs never overlap.
let isRunning = false;

function sse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// SSE: trigger an on-demand pipeline run from the dashboard "Refresh now" button.
refreshRouter.get("/refresh", async (_req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  if (isRunning) {
    sse(res, "error", { error: "A refresh is already in progress." });
    sse(res, "end", {});
    res.end();
    return;
  }

  isRunning = true;
  try {
    const id = await runPipeline((e) => sse(res, e.kind, e));
    writeReport(id, renderReport(readSnapshot(id)));
    const config = getConfig();
    config.lastRunDate = pacificDateString(new Date());
    saveConfig(config);
    sse(res, "report-ready", { snapshotId: id });
  } catch (err) {
    sse(res, "error", { error: (err as Error).message });
  } finally {
    isRunning = false;
    sse(res, "end", {});
    res.end();
  }
});
