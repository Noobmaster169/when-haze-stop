import { z } from "zod";

import { addHours, DOMAIN, WEATHER, WEATHER_POINTS } from "../../../haze/grid";
import { compass, windFrom } from "../../../haze/regions";
import { forecasts, weather } from "../../../repositories";
import { resolveStation } from "../../../services/places";
import { when } from "./format";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** The wind that carries smoke over a place, now and over the next three days. */

const Input = z.object({ place: z.string().min(2).max(80).describe("A town, district, venue or DOE station name in Malaysia.") });
type Input = z.infer<typeof Input>;

const EVERY_HOURS = 12;
const AHEAD_HOURS = 72;

export const getWind: ChatTool<Input> = {
  name: "get_wind",
  description:
    "Returns the wind that carries smoke over a place in Malaysia (about 750 to 1500 m up, not the wind at street level): the direction it blows from and its speed, now and every 12 hours for three days, with rain. " +
    "Use it with get_fires to say whether smoke is being carried toward or away from a place.",
  schema: Input,

  async run(input, ctx): Promise<ToolOutcome> {
    const found = await resolveStation(ctx.pool, ctx.geocoder, input.place);
    if (!found) return refused(`no place named "${input.place}" was found inside the map's region`);
    const run = await forecasts.latest(ctx.pool);
    if (!run) return refused("the model has not run yet, so no wind is stored");
    // From the hour of the newest readings, so the wind lines up with the forecast it drove.
    const now = new Date(run.asOf);
    const grid = await weather.load(ctx.pool, now, addHours(now, AHEAD_HOURS));
    if (!grid) return refused("no wind is stored for this hour yet");

    const column = Math.min(WEATHER.nx - 1, Math.max(0, Math.round((found.station.lon - DOMAIN.lon0) / WEATHER.step)));
    const row = Math.min(WEATHER.ny - 1, Math.max(0, Math.round((found.station.lat - DOMAIN.lat0) / WEATHER.step)));
    const point = row * WEATHER.nx + column;
    const lines: string[] = [];
    let first = "";
    for (let hour = 0; hour < grid.hours; hour += EVERY_HOURS) {
      const u = grid.u[hour * WEATHER_POINTS + point];
      const v = grid.v[hour * WEATHER_POINTS + point];
      const rain = grid.rain.subarray(hour * WEATHER_POINTS, Math.min(grid.hours, hour + EVERY_HOURS) * WEATHER_POINTS);
      let fallen = 0;
      for (let index = point; index < rain.length; index += WEATHER_POINTS) fallen += rain[index];
      const wind = `from the ${compass(windFrom(u, v))} at ${Math.round(Math.hypot(u, v) * 3.6)} km/h`;
      if (hour === 0) first = wind;
      lines.push(`- ${when(addHours(now, hour))}: ${wind}; ${fallen.toFixed(1)} mm of rain over the following 12 hours.`);
    }
    return {
      ok: true,
      text: [`Smoke-carrying wind over ${found.station.name}, ${found.station.state}, in Malaysian time (Open-Meteo forecast, mean of the 925 and 850 hPa levels).`, ...lines].join("\n"),
      preview: `${found.station.name}: ${first}`,
      source: "Open-Meteo",
    };
  },
};
