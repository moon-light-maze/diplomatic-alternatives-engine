import { execFile } from "node:child_process";
import { runPipeline } from "./pipeline.js";
import { renderReport } from "./report.js";
import {
  getConfig,
  saveConfig,
  readSnapshot,
  writeReport,
  reportPath,
  pacificDateString,
  appendRunLog,
} from "./store.js";

/**
 * CLI entry run by launchd (and `npm run refresh`):
 *   guard same-day double-run -> run pipeline -> render + write report -> open it.
 * Flags: --force (ignore the same-day guard), --no-open (don't launch a browser).
 */
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const noOpen = args.includes("--no-open");

  const config = getConfig();
  const today = pacificDateString(new Date());

  if (!force && config.lastRunDate === today) {
    console.log(`[refresh] already ran today (${today}); use --force to run again.`);
    appendRunLog(`refresh skipped (already ran ${today})`);
    process.exit(0);
  }

  console.log("[refresh] running pipeline…");
  const id = await runPipeline((e) => {
    if (e.kind === "stage-start") console.log(`[refresh] ▶ ${e.stage} (${e.model})`);
    else if (e.kind === "tool") console.log(`[refresh]     ${e.stage}: ${e.name}(${e.summary})`);
    else if (e.kind === "status") console.log(`[refresh]   ${e.text}`);
    else if (e.kind === "stage-done") console.log(`[refresh] ✓ ${e.stage} (${e.outcome})`);
    else if (e.kind === "error") console.error(`[refresh] ERROR: ${e.error}`);
  });

  const html = renderReport(readSnapshot(id));
  writeReport(id, html);

  config.lastRunDate = today;
  saveConfig(config);

  const path = reportPath(id);
  console.log(`[refresh] done. Report: ${path}`);
  appendRunLog(`refresh ok snapshot=${id}`);

  if (!noOpen) {
    execFile("open", [path], (err) => {
      if (err) console.error(`[refresh] could not auto-open report: ${err.message}`);
    });
  }
}

main().catch((e) => {
  console.error("[refresh] fatal:", e);
  appendRunLog(`refresh fatal: ${(e as Error).message}`);
  process.exit(1);
});
