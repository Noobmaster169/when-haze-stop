import { z } from "zod";

import { mean } from "../../../suppression/attribution";
import type { CouncilContext } from "../context";
import { type CouncilTool, pct, refused, type ToolResult, ug } from "./types";

const Input = z.object({ ids: z.array(z.string().min(1).max(16)).min(1).max(8).describe("Complex ids, as [\"C014\", \"C121\"].") });
type Input = z.infer<typeof Input>;

export const getInfluence: CouncilTool<Input> = {
  name: "get_influence",
  description:
    "For each complex: how much of KL's coming smoke it causes in every wind member, in ug/m3 and as a share of the ceiling, and how many hours its day-1 smoke takes to reach KL. Use it before arguing about where the smoke comes from.",
  schema: Input,
  run(input, ctx: CouncilContext): ToolResult {
    const { attribution } = ctx;
    const lines = input.ids.map((id) => {
      const byMember = attribution.contributions.get(id);
      if (!byMember) return `${id}: not computed; it is too small or too far to reach KL measurably.`;
      const parts = byMember.map((byDay, m) => {
        const total = byDay.slice(1).reduce((sum, series) => sum + mean(series), 0);
        const first = byDay[1];
        let peak = 0;
        for (const value of first) peak = Math.max(peak, value);
        const arrives = peak > 0 ? first.findIndex((value) => value >= 0.1 * peak) + 1 : null;
        const share = total / Math.max(1e-9, mean(attribution.ceiling[m]));
        return `W${m + 1} ${ug(total)} (${pct(share)} of the ceiling)${arrives === null ? "" : `, day-1 smoke arrives after ${arrives} h`}`;
      });
      return `${id}: ${parts.join("; ")}.`;
    });
    if (lines.every((line) => line.includes("not computed"))) return refused(`none of ${input.ids.join(", ")} has a computed influence`);
    return { ok: true, text: lines.join("\n"), preview: `influence of ${input.ids.join(", ")}` };
  },
};
