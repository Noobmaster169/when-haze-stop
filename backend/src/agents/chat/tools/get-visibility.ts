import { z } from "zod";

import { distanceKm } from "../../../haze/grid";
import { metar } from "../../../repositories";
import { resolvePoint } from "../../../services/places";
import { FAR_M } from "../../../sources/metar";
import { when } from "./format";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** How far one can see at the airport nearest a place, from its weather reports. */

const Input = z.object({ place: z.string().min(2).max(80).describe("A town, airport, venue or DOE station name in Malaysia, Singapore or Brunei.") });
type Input = z.infer<typeof Input>;

const DAY_MS = 86_400_000;
/** A report older than this is not "now". */
const CURRENT_MS = 3 * 3_600_000;
/** Below this many metres, haze is what a person notices and an airport starts to care. */
const POOR_M = 5000;
const LIST_AT_MOST = 8;

const CODES: Record<string, string> = {
  HZ: "haze", FU: "smoke", BR: "mist", FG: "fog", DU: "dust", SA: "sand",
  RA: "rain", DZ: "drizzle", SH: "showers", TS: "thunderstorm", SQ: "squall",
};

/** "-TSRA HZ" reads as "light thunderstorm, rain; haze", and "VCSH" as "showers nearby". */
export function describeWeather(codes: string | null): string | null {
  if (!codes) return null;
  const words = codes.split(/\s+/).map((group) => {
    const strength = group.startsWith("-") ? "light " : group.startsWith("+") ? "heavy " : "";
    const nearby = group.includes("VC");
    const parts = group.replace(/^[-+]/, "").replace("VC", "").match(/.{2}/g) ?? [];
    return strength + parts.map((part) => CODES[part] ?? part).join(", ") + (nearby ? " nearby" : "");
  });
  return words.join("; ");
}

function distance(metres: number): string {
  return metres >= FAR_M ? "10 km or more" : metres >= 1000 ? `${(metres / 1000).toFixed(1).replace(/\.0$/, "")} km` : `${metres} m`;
}

export const getVisibility: ChatTool<Input> = {
  name: "get_visibility",
  description:
    "Returns the prevailing visibility reported by the airport nearest a place (its METAR): how far one can see now, whether the observer called it haze or smoke, the lowest in the last day, and which airports in the region are under 5 km right now. " +
    "Use it for flight and airport questions, and to show what a reading looks like on the ground. Airlines decide on their own minima, which this does not know.",
  schema: Input,

  async run(input, ctx): Promise<ToolOutcome> {
    const point = await resolvePoint(ctx.pool, ctx.geocoder, input.place);
    if (!point) return refused(`no place named "${input.place}" was found inside the map's region`);
    const airports = await metar.airports(ctx.pool);
    const newest = await metar.newestAt(ctx.pool);
    if (airports.length === 0 || !newest) return refused("no airport reports are stored yet");

    const nearest = airports.map((airport) => ({ ...airport, km: Math.round(distanceKm(point.lat, point.lon, airport.lat, airport.lon)) })).sort((a, b) => a.km - b.km)[0];
    const reports = await metar.forAirport(ctx.pool, nearest.icao, new Date(newest.getTime() - DAY_MS));
    const latest = reports.at(-1);
    if (!latest) return refused(`${nearest.name} has no report in the last day`);

    const seen = reports.filter((report) => report.visibilityM !== null) as (typeof reports[number] & { visibilityM: number })[];
    const lowest = seen.reduce((low, report) => (report.visibilityM < low.visibilityM ? report : low), seen[0]);
    const weather = describeWeather(latest.weather);
    const poor = (await metar.latestEach(ctx.pool, new Date(newest.getTime() - CURRENT_MS)))
      .filter((report) => report.visibilityM !== null && report.visibilityM < POOR_M)
      .sort((a, b) => (a.visibilityM ?? 0) - (b.visibilityM ?? 0))
      .slice(0, LIST_AT_MOST)
      .map((report) => {
        const airport = airports.find((item) => item.icao === report.icao);
        return `${airport?.name ?? report.icao} ${distance(report.visibilityM ?? 0)}${report.weather ? ` (${describeWeather(report.weather)})` : ""}`;
      });

    const lines = [
      `Visibility at ${nearest.name} (${nearest.icao}), ${nearest.km} km from ${point.name}, from its airport weather reports (METAR).`,
      `Now (${when(latest.observedAt)} Malaysian time): ${latest.visibilityM === null ? "not reported" : distance(latest.visibilityM)}${weather ? `, with ${weather} reported` : ", nothing reported in the air"}.`,
    ];
    if (lowest) lines.push(`Lowest in the last 24 hours: ${distance(lowest.visibilityM)} at ${when(lowest.observedAt)}.`);
    lines.push(poor.length > 0 ? `Airports in the region under 5 km right now: ${poor.join("; ")}.` : "No airport in the region is under 5 km right now.");
    lines.push("Airlines and airports decide on their own minima, which this app does not know. A METAR says what the observer saw, not whether flights run.");
    return {
      ok: true,
      text: lines.join("\n"),
      preview: `${nearest.name}: ${latest.visibilityM === null ? "visibility not reported" : distance(latest.visibilityM)}${latest.weather ? ` ${latest.weather}` : ""}`,
      source: "METAR",
    };
  },
};
