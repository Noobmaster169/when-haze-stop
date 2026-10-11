import { z } from "zod";

import { pm25ToApi } from "../../../haze/api-index";
import { mean } from "../../../suppression/attribution";
import type { CouncilContext } from "../context";
import { type CouncilTool, type ToolResult, ug } from "./types";

const Input = z.object({});
type Input = z.infer<typeof Input>;

const OVER_100 = 50.4;
const OVER_200 = 150.4;

export const getTargetAir: CouncilTool<Input> = {
  name: "get_target_air",
  description: "The engine's outlook for KL and surroundings with no plan, per wind member: mean and peak 24-hour PM2.5 and API, hours above API 100 and 200, and the ceiling (what putting out every fire from day 1 could remove).",
  schema: Input,
  run(_input, ctx: CouncilContext): ToolResult {
    const { attribution, target } = ctx;
    const lines = attribution.members.map((member, m) => {
      const series = attribution.baseline[m];
      let peak = 0;
      let over100 = 0;
      let over200 = 0;
      for (const value of series) {
        peak = Math.max(peak, value);
        if (value > OVER_100) over100++;
        if (value > OVER_200) over200++;
      }
      const average = mean(series);
      return `${member.id}: mean ${ug(average)} (API ${Math.round(pm25ToApi(average))}), peak ${ug(peak)} (API ${Math.round(pm25ToApi(peak))}), ${over100} h above API 100, ${over200} h above 200; ceiling ${ug(mean(attribution.ceiling[m]))}.`;
    });
    const header = `${target.name}: the mean of ${target.stationIds.length} DOE stations, over the ${attribution.days * 24} hours after ${attribution.asOf}. The engine's figures, not readings.`;
    return { ok: true, text: [header, ...lines].join("\n"), preview: "KL outlook with no plan" };
  },
};
