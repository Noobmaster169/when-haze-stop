import { z } from "zod";

import type { CouncilContext } from "../context";
import { type CouncilTool, refused, type ToolResult } from "./types";

const Input = z.object({ ids: z.array(z.string().min(1).max(16)).min(1).max(10) });
type Input = z.infer<typeof Input>;

export const getLogistics: CouncilTool<Input> = {
  name: "get_logistics",
  description: "For each complex: whose soil it is, the nearest staging airfield and its distance, and the distance to open sea for the scooper (which needs a 1.3 km open-water run within about 25 km; large rivers are not mapped and must be confirmed).",
  schema: Input,
  run(input, ctx: CouncilContext): ToolResult {
    const lines = input.ids.map((id) => {
      const complex = ctx.complex(id);
      const logistics = ctx.logistics(id);
      if (!complex || !logistics) return `${id}: no logistics worked out.`;
      const scoop = logistics.coastKm <= 25 ? "sea within the scooper's reach" : "sea beyond the scooper's reach unless a river run is confirmed";
      return `${id} (${complex.place.country}, ${complex.place.province}): staging ${logistics.staging.name} ${Math.round(logistics.staging.km)} km; open sea ${Math.round(logistics.coastKm)} km, ${scoop}; ${Math.round(logistics.kmToTarget)} km from KL.`;
    });
    if (lines.every((line) => line.includes("no logistics"))) return refused("none of those complexes has logistics worked out");
    return { ok: true, text: lines.join("\n"), preview: `logistics for ${input.ids.length}` };
  },
};
