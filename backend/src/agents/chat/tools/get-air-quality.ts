import { z } from "zod";

import { stationOutlook } from "../../../services/outlook";
import { resolveStation } from "../../../services/places";
import { reading, when } from "./format";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** What a place reads now and has read over the last day, from the nearest DOE station. */

const Input = z.object({ place: z.string().min(2).max(80).describe("A town, district, venue or DOE station name in Malaysia.") });
type Input = z.infer<typeof Input>;

export const getAirQuality: ChatTool<Input> = {
  name: "get_air_quality",
  description:
    "Returns the current official DOE reading (API) for a place in Malaysia, with its range over the last 24 hours. " +
    "Use it for any question about how the air is now.",
  schema: Input,

  async run(input, ctx): Promise<ToolOutcome> {
    const found = await resolveStation(ctx.pool, ctx.geocoder, input.place);
    if (!found) return refused(`no place named "${input.place}" was found inside the map's region`);
    const outlook = await stationOutlook(ctx.pool, found.station.id);
    const last = outlook?.readings.at(-1);
    if (!outlook || !last) return refused(`${found.station.name} has no readings stored yet`);

    const day = outlook.readings.slice(-24).map((item) => item.api);
    const where = `${found.station.name}, ${found.station.state} (DOE station ${found.station.id}${found.via ? `, the nearest to ${found.via}` : ""})`;
    return {
      ok: true,
      text: `${where}: ${reading(last.api)} at ${when(last.at)} Malaysian time. Over the last 24 hours it ranged from ${Math.min(...day)} to ${Math.max(...day)}.`,
      preview: `${found.station.name} ${last.api} at ${when(last.at)}`,
      source: "DOE",
    };
  },
};
