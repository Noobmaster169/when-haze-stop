import { z } from "zod";

import { distanceKm } from "../../../haze/grid";
import { bearing, compass, REGIONS, regionOf } from "../../../haze/regions";
import { fires } from "../../../repositories";
import { resolveStation } from "../../../services/places";
import { dayName } from "./format";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** Where the fires are and how strongly they burn, from NASA's satellites. */

const Input = z.object({
  place: z.string().max(80).optional().describe("Optional. A place in Malaysia, to also get how far and in which direction the fires lie from it."),
});
type Input = z.infer<typeof Input>;

const DAYS = 3;
const NEAR_KM = 500;

export const getFires: ChatTool<Input> = {
  name: "get_fires",
  description:
    "Returns the satellite fire detections of the newest three days over Sumatra, the peninsula and Borneo: how many burning cells and how much fire power each day in each region. " +
    "With a place, also how many burn within 500 km of it and how far and in which direction the strongest lies. Use it to explain where haze comes from.",
  schema: Input,

  async run(input, ctx): Promise<ToolOutcome> {
    const newest = await fires.newestDay(ctx.pool);
    if (!newest) return refused("no fire detections are stored yet");
    // Counted back from the newest stored day and not from the clock, so a late fetch still answers with what there is.
    const from = new Date(Date.parse(`${newest}T00:00:00Z`) - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    const cells = (await fires.since(ctx.pool, from)).map((cell) => ({ ...cell, lat: cell.lat10 / 10 + 0.05, lon: cell.lon10 / 10 + 0.05 }));

    const days = [...new Set(cells.map((cell) => cell.day))].sort();
    const lines = days.map((day) => {
      const parts = REGIONS.map((region) => {
        const here = cells.filter((cell) => cell.day === day && regionOf(cell.lat, cell.lon) === region);
        return `${region} ${here.length} cells, ${Math.round(here.reduce((sum, cell) => sum + cell.frpMw, 0))} MW`;
      });
      return `- ${dayName(day)} (UTC day): ${parts.join("; ")}.`;
    });

    const text = [`Burning 0.1 degree cells (about 11 km) and their summed fire radiative power, from the VIIRS instruments on three satellites.`, ...lines];
    const found = input.place ? await resolveStation(ctx.pool, ctx.geocoder, input.place) : null;
    if (found) {
      const latest = days[days.length - 1];
      const away = cells
        .filter((cell) => cell.day === latest)
        .map((cell) => ({ ...cell, km: distanceKm(found.station.lat, found.station.lon, cell.lat, cell.lon) }));
      const near = away.filter((cell) => cell.km <= NEAR_KM);
      const strongest = [...away].sort((a, b) => b.frpMw - a.frpMw)[0];
      text.push(`Within ${NEAR_KM} km of ${found.station.name} on ${dayName(latest)}: ${near.length} cells, ${Math.round(near.reduce((sum, cell) => sum + cell.frpMw, 0))} MW.`);
      if (strongest) {
        const direction = compass(bearing(found.station.lat, found.station.lon, strongest.lat, strongest.lon));
        text.push(`The strongest fire that day is ${Math.round(strongest.km)} km to the ${direction} of ${found.station.name}, in ${regionOf(strongest.lat, strongest.lon)}.`);
      }
    }
    text.push("The newest day is incomplete until every satellite has passed. Cloud hides fires from the satellites.");

    const last = cells.filter((cell) => cell.day === days[days.length - 1]).length;
    return { ok: true, text: text.join("\n"), preview: `${last} burning cells on ${dayName(days[days.length - 1])}`, source: "NASA FIRMS" };
  },
};
