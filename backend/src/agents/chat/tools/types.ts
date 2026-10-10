import type { z } from "zod";

import type { Queryable } from "../../../db";

/**
 * What every tool is: a name, a sentence the prompt shows the model, a zod
 * schema for its arguments, and one async function.
 *
 * The seam is narrow on purpose. A tool reads what it is handed on the
 * context and reports what it found; the loop decides what happens next.
 */

export interface ToolContext {
  /** The database. Hand a tool a read-only pool here if it runs anything a model wrote. */
  pool: Queryable;
  conversationId: string;
  /** Set when the person may stop the turn. A slow tool should pass it on to whatever it awaits. */
  signal?: AbortSignal;
}

/**
 * What a tool hands back.
 *
 * `text` goes to the model and `preview` goes to the page; they are different
 * because a model reads 200 rows better than prose and a person reads one
 * sentence better than 200 rows.
 */
export interface ToolOutcome {
  ok: boolean;
  /** What the loop feeds back as the tool's result. */
  text: string;
  /** One line for the collapsed "Tools used" block. */
  preview: string;
  /** Set by `load_skill`: the skill now in front of the agent, which stays there for the conversation. */
  skill?: string;
}

export interface ChatTool<I> {
  name: string;
  /** One or two sentences. Goes straight into the prompt, so it is written for a model to act on. */
  description: string;
  schema: z.ZodType<I>;
  run(input: I, ctx: ToolContext): Promise<ToolOutcome>;
}

/** A tool that refused, in the shape the loop feeds back so the model can try again. */
export function refused(reason: string): ToolOutcome {
  return { ok: false, text: `The call was refused: ${reason}`, preview: reason };
}
