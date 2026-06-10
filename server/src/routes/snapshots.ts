import { Router } from "express";
import { existsSync } from "node:fs";
import {
  listSnapshotIds,
  readSnapshot,
  readMeta,
  latestSnapshotId,
  reportPath,
  snapshotDir,
  getConfig,
} from "../store.js";

export const snapshotsRouter = Router();

// Config (scenario, schedule hour, last run)
snapshotsRouter.get("/config", (_req, res) => {
  res.json(getConfig());
});

// List snapshots (id + light meta), newest first
snapshotsRouter.get("/snapshots", (_req, res) => {
  const list = listSnapshotIds().map((id) => {
    const meta = readMeta(id);
    return {
      id,
      createdAt: meta?.createdAt ?? null,
      scenarioTitle: meta?.scenarioTitle ?? null,
      totalToolCalls: meta?.totalToolCalls ?? null,
      estimatedTokens: meta?.estimatedTokens ?? null,
      stages: meta?.stages.map((s) => ({ stage: s.stage, outcome: s.outcome })) ?? [],
    };
  });
  res.json({ latest: latestSnapshotId(), snapshots: list });
});

// Full snapshot bundle
snapshotsRouter.get("/snapshots/:id", (req, res) => {
  const id = req.params.id === "latest" ? latestSnapshotId() : req.params.id;
  if (!id || !existsSync(snapshotDir(id))) {
    res.status(404).json({ error: "snapshot not found" });
    return;
  }
  res.json(readSnapshot(id));
});

// Serve the rendered HTML report for a snapshot
snapshotsRouter.get("/snapshots/:id/report", (req, res) => {
  const id = req.params.id === "latest" ? latestSnapshotId() : req.params.id;
  if (!id || !existsSync(reportPath(id))) {
    res.status(404).send("report not found");
    return;
  }
  res.sendFile(reportPath(id));
});
