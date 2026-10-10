import type { z } from "zod";

import type { CouncilContext } from "../context";

/**
 * A council tool: the chat's tool shape, reading the council's frozen world
 * instead of the database. Every one answers in milliseconds.
 */

export interface ToolResult {
  ok: boolean;
  /** What the seat reads back. */
  text: string;
  /** One line for the replay's satellite node. */
  preview: string;
  /** Set by `load_skill`: the skill now in front of the seat. */
  skill?: string;
}

export interface CouncilTool<I> {
  name: string;
  description: string;
  schema: z.ZodType<I>;
  run(input: I, ctx: CouncilContext): ToolResult;
}

export function refused(reason: string): ToolResult {
  return { ok: false, text: `The call was refused: ${reason}`, preview: reason };
}

export const pct = (share: number) => `${(100 * share).toFixed(2)}%`;
export const ug = (value: number) => `${value.toFixed(2)} ug/m3`;
