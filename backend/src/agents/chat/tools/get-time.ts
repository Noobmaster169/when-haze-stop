import { z } from "zod";

import { type ChatTool, refused, type ToolOutcome } from "./types";

/** The example tool: small enough to read in one look, real enough to show every part of the seam. */

const Input = z.object({
  timezone: z.string().min(1).max(64).default("UTC").describe("An IANA zone name such as Asia/Singapore."),
});
type Input = z.infer<typeof Input>;

export const getTime: ChatTool<Input> = {
  name: "get_time",
  description: "Returns the current date and time in one timezone. Use it when an answer depends on what time it is now.",
  schema: Input,

  run(input): Promise<ToolOutcome> {
    let formatted: string;
    try {
      formatted = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "long", timeZone: input.timezone }).format(new Date());
    } catch (error) {
      // An unknown zone is the model's to correct, not a failure of the turn.
      if (error instanceof RangeError) return Promise.resolve(refused(`"${input.timezone}" is not an IANA timezone name`));
      throw error;
    }
    return Promise.resolve({ ok: true, text: `It is ${formatted} in ${input.timezone}.`, preview: formatted });
  },
};
