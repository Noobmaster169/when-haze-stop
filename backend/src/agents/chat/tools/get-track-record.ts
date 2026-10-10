import { z } from "zod";

import { scores } from "../../../repositories";
import type { ChatTool, ToolOutcome } from "./types";

/** How the forecast has done against the readings that followed, and against assuming no change. */

const Input = z.object({});
type Input = z.infer<typeof Input>;

export const getTrackRecord: ChatTool<Input> = {
  name: "get_track_record",
  description:
    "Returns how accurate this app's forecasts have been at 24, 48 and 72 hours ahead, beside the accuracy of simply assuming no change. " +
    "Use it whenever an answer leans on a forecast, so you can say how far to trust it.",
  schema: Input,

  async run(_input, ctx): Promise<ToolOutcome> {
    const { leads } = await scores.byLead(ctx.pool);
    const checked = leads.filter((lead) => lead.cases > 0);
    if (checked.length === 0) {
      return {
        ok: true,
        text: "No forecast has been checked against a later reading yet, so there is no track record. In its first test, 6 to 10 October 2026, the model was about as accurate as assuming no change.",
        preview: "no checked forecasts yet",
        source: "Haze model",
      };
    }
    const lines = checked.map(
      (lead) => `- ${lead.leadHours} hours ahead: average miss ${lead.model} API points for the model, ${lead.persistence} for assuming no change (${lead.cases} checked forecasts).`,
    );
    return {
      ok: true,
      text: [...lines, "A lower miss is better. Where the two are close, the forecast adds little beyond the current reading."].join("\n"),
      preview: checked.map((lead) => `${lead.leadHours}h: ${lead.model} vs ${lead.persistence}`).join(", "),
      source: "Haze model",
    };
  },
};
