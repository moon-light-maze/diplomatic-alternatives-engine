import type { z } from "zod";

/** Extract the last fenced ```json block, or fall back to the outermost {...}. */
export function extractJson(text: string): string | null {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  if (fences.length > 0) return fences[fences.length - 1][1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return null;
}

export interface ParseResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function parseAndValidate<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  const raw = extractJson(text);
  if (!raw) return { ok: false, error: "no JSON object found in model output" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `JSON.parse failed: ${(e as Error).message}` };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, data: result.data };
}
