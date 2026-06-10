import { query, type Options, type PermissionMode } from "@anthropic-ai/claude-agent-sdk";

/**
 * Thin wrapper over the Claude Agent SDK. Inference is powered by the user's
 * local Claude Code login (the SDK spawns the `claude` CLI) — no ANTHROPIC_API_KEY
 * required. Tools (Read/Write/Glob/Grep/Bash/WebSearch/WebFetch) are enabled but
 * file/bash access is scoped to the per-case `cwd` passed in by the caller.
 */

export type StreamEvent =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; summary: string }
  | { kind: "status"; text: string };

export interface RunModuleArgs {
  /** Module-specific system prompt (replaces the default Claude Code prompt). */
  system: string;
  /** The task/user prompt. */
  user: string;
  /** Working directory the agent's file/bash tools are scoped to (the case folder). */
  cwd: string;
  /** Model alias, e.g. "sonnet" | "opus". */
  model?: string;
  /** Max agentic turns. */
  maxTurns?: number;
  /** Called for each streamed event (assistant text, tool use, status). */
  onEvent?: (e: StreamEvent) => void;
}

// Tools the agent is allowed to use. File/bash tools are bounded to `cwd`.
const ALLOWED_TOOLS = [
  "Read",
  "Write",
  "Glob",
  "Grep",
  "Bash",
  "WebSearch",
  "WebFetch",
];

function summarizeToolInput(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "Read":
    case "Write":
      return String(i.file_path ?? "");
    case "Glob":
    case "Grep":
      return String(i.pattern ?? "");
    case "Bash":
      return String(i.command ?? "").slice(0, 200);
    case "WebSearch":
      return String(i.query ?? "");
    case "WebFetch":
      return String(i.url ?? "");
    default:
      return "";
  }
}

export interface RunModuleResult {
  /** Final assembled text returned by the agent (the `result` of the run). */
  text: string;
  toolCalls: { name: string; summary: string }[];
  model: string;
  isError: boolean;
}

export async function runModule(args: RunModuleArgs): Promise<RunModuleResult> {
  const { system, user, cwd, model = "sonnet", maxTurns = 12, onEvent } = args;

  const options: Options = {
    systemPrompt: system,
    cwd,
    model,
    maxTurns,
    allowedTools: ALLOWED_TOOLS,
    // No human at a TTY in a server context — never block on a permission prompt.
    permissionMode: "bypassPermissions" as PermissionMode,
  };

  const toolCalls: { name: string; summary: string }[] = [];
  let finalText = "";
  let isError = false;

  for await (const message of query({ prompt: user, options })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text" && block.text) {
          onEvent?.({ kind: "text", text: block.text });
        } else if (block.type === "tool_use") {
          const summary = summarizeToolInput(block.name, block.input);
          toolCalls.push({ name: block.name, summary });
          onEvent?.({ kind: "tool", name: block.name, summary });
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        finalText = message.result;
      } else {
        isError = true;
        onEvent?.({ kind: "status", text: `Run ended: ${message.subtype}` });
      }
    }
  }

  return { text: finalText, toolCalls, model, isError };
}
