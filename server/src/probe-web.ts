import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runModule } from "./agent.js";

/**
 * De-risk gate: confirms the Agent SDK can actually perform live web research
 * (WebSearch/WebFetch) through the local Claude Code login before we build the
 * pipeline on top of it.
 */
async function main() {
  const dir = mkdtempSync(join(tmpdir(), "cm-probe-"));
  console.log("[probe] asking the agent to fetch one current, cited headline…");

  const result = await runModule({
    system:
      "You are a research probe. Use WebSearch and/or WebFetch to find ONE recent, real news item " +
      "from a reputable outlet (Reuters, AP, BBC, etc.). Return ONLY a fenced ```json block: " +
      '{ "headline": string, "publisher": string, "url": string, "date": string }. No prose.',
    user: "Find one reputable news headline from the last few days and return it as JSON with its URL and date.",
    cwd: dir,
    model: "sonnet",
    maxTurns: 8,
    onEvent: (e) => {
      if (e.kind === "tool") console.log(`[probe]   tool: ${e.name}(${e.summary})`);
    },
  });

  rmSync(dir, { recursive: true, force: true });

  const usedWebTool = result.toolCalls.some((t) => t.name === "WebSearch" || t.name === "WebFetch");
  console.log(`[probe] web tool used: ${usedWebTool} | tool calls: ${result.toolCalls.length}`);
  console.log("[probe] output:\n" + result.text);

  if (usedWebTool && /https?:\/\//.test(result.text)) {
    console.log("[probe] PASS — live web research works through the SDK.");
    process.exit(0);
  } else {
    console.error("[probe] FAIL — no web tool used or no URL returned. Pipeline must use a fallback.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[probe] ERROR:", e);
  process.exit(1);
});
