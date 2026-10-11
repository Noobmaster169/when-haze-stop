import type { Pool } from "pg";

import { addHours, hoursBetween, WEATHER_POINTS } from "../haze/grid";
import { TerminalError } from "../lib/errors";
import { childLogger } from "../lib/logger";
import { weather } from "../repositories";
import type { WeatherClient } from "../sources";
import { addDays, dayOf } from "./days";
import { recordFetch } from "./record-fetch";

const log = childLogger({ module: "jobs.history-weather" });

/** Open-Meteo counts a request by its days. Two weeks at a time stays inside the free tier. */
const WEATHER_DAYS = 14;

/**
 * Stores wind and rain from `fromDay` up to the first hour already stored,
 * newest span first, so the stored hours stay one unbroken run however early
 * this is stopped. Hours the hourly fetch stored are never asked for again.
 */
export async function ingestWeatherHistory(deps: { pool: Pool; weather: WeatherClient }, fromDay: string, now: Date): Promise<number> {
  let stored = 0;
  for (;;) {
    const until = (await weather.earliestAt(deps.pool)) ?? new Date(`${dayOf(now)}T00:00:00Z`);
    const lastDay = dayOf(addHours(until, -1));
    if (lastDay < fromDay) return stored;
    const firstDay = addDays(lastDay, -(WEATHER_DAYS - 1)) > fromDay ? addDays(lastDay, -(WEATHER_DAYS - 1)) : fromDay;
    const detail = await recordFetch(deps.pool, "open-meteo-history", async () => {
      const grid = await deps.weather.history(firstDay, lastDay);
      const wanted = hoursBetween(grid.start, until);
      // A span that stops short would leave a hole the model cannot step over, and every later run would start behind it.
      if (grid.hours < wanted) throw new TerminalError(`Open-Meteo history for ${firstDay} to ${lastDay} stops ${wanted - grid.hours} hours short`);
      await weather.upsertGrid(deps.pool, { ...grid, hours: wanted });
      return { points: WEATHER_POINTS, hours: wanted, from: grid.start.toISOString(), to: addHours(grid.start, wanted - 1).toISOString() };
    });
    log.info(detail, "weather history stored");
    stored += detail.hours;
  }
}
