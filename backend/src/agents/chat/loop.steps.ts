import { z } from "zod";

import type { ChatToolCall } from "../../contracts";
import type { ToolOutcome } from "./tools";

/**
 * One step of a turn: what the model may say, and how a finished step reads to
 * it on the next one. Split from loop.ts, which runs the steps.
 */

/** A step's calls run together, so three lookups cost one model call and not three. */
export const MAX_CALLS = 4;

const Call = z.object({
  /** A string and not an enum of the registry: an unknown name is refused by `callTool` with the list, which teaches better than a schema error. */
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  /** One sentence on why this call, shown to the reader beside it. */
  thought: z.string().max(400).default(""),
});
export type Call = z.infer<typeof Call>;

/**
 * One flat object, not a discriminated union.
 *
 * The provider refuses `oneOf` at the top level of a tool schema, so the
 * discriminant is a field and the narrowing happens in code. Every field that
 * belongs to only one of the two shapes carries a default, so a step that
 * leaves the other one out still parses and the loop decides what it meant.
 *
 * Order matters: the model writes the object in this order, and `answer` last
 * is what lets the page stream it.
 */
export const Step = z.object({
  action: z.enum(["tool", "final"]),
  /** On a tool step: one to four calls, run together. */
  calls: z.array(Call).max(MAX_CALLS).default([]),
  /** On a final step. */
  answer: z.string().default("").describe("The answer, in Markdown, written for the person. Empty on a tool step."),
});
export type Step = z.infer<typeof Step>;

/** A finished call as the loop holds it: what goes on the wire, plus what only the loop reads. */
export interface FinishedCall extends ChatToolCall {
  /** The text the model reads back. */
  text: string;
  /** A skill it put in front of the agent. */
  skill: string | null;
}

export function finish(call: Call, outcome: ToolOutcome, durationMs: number): FinishedCall {
  return {
    tool: call.tool,
    args: call.args,
    thought: call.thought,
    ok: outcome.ok,
    preview: outcome.preview,
    source: outcome.source ?? null,
    durationMs,
    text: outcome.text,
    skill: outcome.skill ?? null,
  };
}

/** Drops what only the loop needed, so the wire carries the contract and nothing more. */
export function forWire(call: FinishedCall): ChatToolCall {
  const { text: _text, skill: _skill, ...rest } = call;
  return rest;
}

/** What one finished call looks like to the model on the next step. */
export function transcribe(call: FinishedCall): string {
  // A loaded skill is under "Skills loaded" from the next step on; twice would only crowd the question.
  if (call.skill) return `### you called ${call.tool}\nresult: ${call.preview}. Its text is under "Skills loaded".`;
  return `### you called ${call.tool} ${JSON.stringify(call.args)}\nwhy: ${call.thought}\nresult${call.ok ? "" : " (it did not work)"}:\n${call.text}`;
}
