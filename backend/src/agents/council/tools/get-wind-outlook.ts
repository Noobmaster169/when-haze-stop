import { z } from "zod";

import { mean } from "../../../suppression/attribution";
import type { CouncilContext } from "../context";
import { type CouncilTool, type ToolResult, ug } from "./types";

const Input = z.object({});
type Input = z.infer<typeof Input>;

const compass = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
/** Where a wind blows from, given its eastward and northward parts. */
const from = (u: number, v: number) => compass[Math.round((((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360) / 45) % 8];

export const getWindOutlook: CouncilTool<Input> = {
  name: "get_wind_outlook",
  description: "How each wind member was made, its ceiling, and its mean wind at smoke height and total rain over the horizon in each source region, the strait and KL.",
  schema: Input,
  run(_input, ctx: CouncilContext): ToolResult {
    const { attribution } = ctx;
    const lines = attribution.members.map((member, m) => {
      const wind = attribution.winds.find((item) => item.member === member.id);
      const places = (wind?.places ?? []).map((place) => `${place.name}: from the ${from(place.u, place.v)} at ${Math.hypot(place.u, place.v).toFixed(1)} m/s, rain ${Math.round(place.rainMm)} mm`);
      return `${member.id} (${member.label}); ceiling ${ug(mean(attribution.ceiling[m]))}.\n  ${places.join("; ")}`;
    });
    return { ok: true, text: [`Wind at smoke height (925 to 850 hPa) over the ${attribution.days}-day horizon.`, ...lines].join("\n"), preview: `${attribution.members.length} wind members` };
  },
};
