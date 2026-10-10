import { z } from "zod";

import { stationOutlook } from "../../../services/outlook";
import { resolveStation } from "../../../services/places";
import { reading, stationLabel, when } from "./format";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** What a place reads now and has read over the last day, from the nearest station of either network. */

const Input = z.object({ place: z.string().min(2).max(80).describe("A town, district, venue or DOE station name in Malaysia.") });
type Input = z.infer<typeof Input>;

export const getAirQuality: ChatTool<Input> = {
  name: "get_air_quality",
  description:
    "Returns the current official reading for a place, with its range over the last 24 hours: DOE's API at the nearest Malaysian station, or NEA's 24-hour PSI for a Singapore region. " +
    "Use it for any question about how the air is now, in Malaysia or Singapore.",
  schema: Input,

  async run(input, ctx): Promise<ToolOutcome> {
    const found = await resolveStation(ctx.pool, ctx.geocoder, input.place);
    if (!found) return refused(`no place named "${input.place}" was found inside the map's region`);
    const outlook = await stationOutlook(ctx.pool, found.station.id);
    const last = outlook?.readings.at(-1);
    if (!outlook || !last) return refused(`${found.station.name} has no readings stored yet`);

    const day = outlook.readings.slice(-24).map((item) => item.api);
    const station = found.station;
    const where = `${station.name}, ${station.state} (${stationLabel(station)}${found.via ? `, the nearest to ${found.via}` : ""})`;
    const pm25 = outlook.pm25 ? ` NEA's measured one-hour PM2.5 there was ${outlook.pm25.value} ug/m3 at ${when(outlook.pm25.at)}.` : "";
    return {
      ok: true,
      text: `${where}: ${reading(last.api, station.network)} at ${when(last.at)} Malaysian time. Over the last 24 hours it ranged from ${Math.min(...day)} to ${Math.max(...day)}.${pm25}`,
      preview: `${station.name} ${last.api} at ${when(last.at)}`,
      source: station.network === "nea" ? "NEA Singapore" : "DOE",
    };
  },
};
