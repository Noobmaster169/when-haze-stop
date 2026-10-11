import { z } from "zod";

import { GUIDELINES } from "../../../haze/guidelines";
import type { ChatTool, ToolOutcome } from "./types";

/** The official lines and what crossing each means. */

const Input = z.object({});
type Input = z.infer<typeof Input>;

export const getGuidelines: ChatTool<Input> = {
  name: "get_guidelines",
  description:
    "Returns the official Malaysian API thresholds and the action each one triggers for schools, the public and employers, with who issued them. " +
    "Use it before recommending whether an activity should go ahead.",
  schema: Input,

  run(): Promise<ToolOutcome> {
    const lines = GUIDELINES.map((line) => {
      const over = line.sustainedDays ? `Above ${line.threshold} for ${line.sustainedDays} days in a row` : `Above ${line.threshold}`;
      return `- ${over}, ${line.audience.toLowerCase()}: ${line.action} (${line.issuer}; ${line.source})`;
    });
    return Promise.resolve({
      ok: true,
      text: [
        ...lines,
        "There is no national API threshold for public events, concerts or sport outside schools. Say so, and reason from the lines above.",
        "Airports decide on runway visibility, not on API, and this app has no visibility data.",
      ].join("\n"),
      preview: `${GUIDELINES.length} official lines`,
      source: "Ministry guidance",
    });
  },
};
