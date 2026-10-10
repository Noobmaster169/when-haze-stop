import type { Pool } from "pg";

import { toCellDays } from "../haze/fires";
import { addHours } from "../haze/grid";
import { childLogger } from "../lib/logger";
import { fires, readings, stations, weather } from "../repositories";
import type { DoeClient, FiresClient, WeatherClient } from "../sources";

/** Fetch what the sources have and store it. Each function is one source, so one being down does not stop the others. */

const log = childLogger({ module: "jobs.ingest" });

export interface IngestDeps {
  pool: Pool;
  doe: DoeClient;
  fires: FiresClient;
  weather: WeatherClient;
}

/** DOE serves the 24 hours before an instant, as far back as about a week. */
const DOE_MAX_DAYS = 7;
const WEATHER_PAST_DAYS = 8;
const WEATHER_FORECAST_DAYS = 5;

function topOfHour(at: Date): Date {
  return new Date(Math.floor(at.getTime() / 3_600_000) * 3_600_000);
}

/** Fetches as many days back as it takes to join up with what is stored, so a process that was off for a day leaves no hole. */
export async function ingestReadings(deps: IngestDeps, now: Date): Promise<number> {
  await stations.upsertMany(deps.pool, await deps.doe.stations());
  const newest = await readings.newestAt(deps.pool);
  const behindDays = newest ? Math.ceil((now.getTime() - newest.getTime()) / 86_400_000) : DOE_MAX_DAYS;
  const days = Math.max(1, Math.min(DOE_MAX_DAYS, behindDays));

  let added = 0;
  for (const stateId of await stations.stateIds(deps.pool)) {
    for (let back = 0; back < days; back++) {
      added += await readings.insertMany(deps.pool, await deps.doe.readings(stateId, addHours(topOfHour(now), -24 * back)));
    }
  }
  log.info({ days, added }, "readings stored");
  return added;
}

export async function ingestFires(deps: IngestDeps): Promise<number> {
  const cells = toCellDays(await deps.fires.recent());
  await fires.upsertMany(deps.pool, cells);
  log.info({ cells: cells.length }, "fire cells stored");
  return cells.length;
}

export async function ingestWeather(deps: IngestDeps): Promise<number> {
  const grid = await deps.weather.grid(WEATHER_PAST_DAYS, WEATHER_FORECAST_DAYS);
  await weather.upsertGrid(deps.pool, grid);
  log.info({ hours: grid.hours, from: grid.start.toISOString() }, "weather stored");
  return grid.hours;
}
