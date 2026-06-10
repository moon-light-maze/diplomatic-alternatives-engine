import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { snapshotsRouter } from "./routes/snapshots.js";
import { refreshRouter } from "./routes/refresh.js";
import { REPO_ROOT } from "./store.js";

const PORT = Number(process.env.PORT ?? 8788);
const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, usingApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.use("/api", snapshotsRouter);
app.use("/api", refreshRouter);

// Serve the built dashboard in production.
const webDist = join(REPO_ROOT, "web", "dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(webDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Conflict Monitor dashboard on http://localhost:${PORT}`);
});
