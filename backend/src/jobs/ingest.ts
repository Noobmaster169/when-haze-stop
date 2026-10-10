import type { Pool } from "pg";

import { burningCells } from "../haze/burning";
import { FIXED_MIN_DAYS, fixedMask } from "../haze/fixed-sources";
import { addHours, WEATHER_POINTS } from "../haze/grid";
import { childLogger } from "../lib/logger";
import { fires, fixedSources, readings, stations, weather } from "../repositories";
import type { LlmClient } from "../agents";
import type { DoeClient, FiresClient, MetarClient, NeaClient, PushSender, StatementsClient, WeatherClient } from "../sources";
import { recordFetch } from "./record-fetch";

/** Fetch what the sources have and store it. Each function is one source, so one being down does not stop the others. */

const log = childLogger({ module: "jobs.ingest" });

export interface IngestDeps {
  pool: Pool;
  doe: DoeClient;
  fires: FiresClient;
  weather: WeatherClient;
  metar: MetarClient;
  nea: NeaClient;
  /** The statement channels and the model that reads them. Without them the cycle reads no statements. */
  statements?: { channels: StatementsClient[]; llm: LlmClient };
  /** Sends alerts to devices. Null or absent when no VAPID keys are set. */
  push?: PushSender | null;
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
  await recordFetch(deps.pool, "doe-stations", async () => {
    const found = await deps.doe.stations();
    await stations.upsertMany(deps.pool, found.map((station) => ({ ...station, network: "doe" as const })));
    return { stations: found.length, states: new Set(found.map((station) => station.stateId)).size };
  });

  const newest = await readings.newestAt(deps.pool, "doe");
  const behindDays = newest ? Math.ceil((now.getTime() - newest.getTime()) / 86_400_000) : DOE_MAX_DAYS;
  const days = Math.max(1, Math.min(DOE_MAX_DAYS, behindDays));

  const detail = await recordFetch(deps.pool, "doe-readings", async () => {
    let requests = 0;
    let empty = 0;
    let received = 0;
    let added = 0;
    let latest = 0;
    for (const stateId of await stations.stateIds(deps.pool)) {
      for (let back = 0; back < days; back++) {
        const found = await deps.doe.readings(stateId, addHours(topOfHour(now), -24 * back));
        requests += 1;
        if (found.length === 0) empty += 1;
        received += found.length;
        for (const reading of found) latest = Math.max(latest, reading.observedAt.getTime());
        added += await readings.insertMany(deps.pool, found);
      }
    }
    // An empty answer is a state with no readings or the portal shedding load; many of them mean the second.
    return { daysBack: days, requests, emptyAnswers: empty, received, added, ...(latest ? { newestReading: new Date(latest).toISOString() } : {}) };
  });
  log.info(detail, "readings stored");
  return detail.added;
}

export async function ingestFires(deps: IngestDeps): Promise<number> {
  const detail = await recordFetch(deps.pool, "firms", async () => {
    const detections = await deps.fires.recent();
    const { cells, glint, offshore, fixed, notVegetation, unconfirmed } = burningCells(detections, fixedMask(await fixedSources.sites(deps.pool, FIXED_MIN_DAYS)));
    await fires.upsertMany(deps.pool, cells);
    const days = cells.map((cell) => cell.day).sort();
    return {
      detections: detections.length,
      glintDropped: glint,
      offshoreDropped: offshore,
      fixedDropped: fixed,
      notVegetationDropped: notVegetation,
      unconfirmedDropped: unconfirmed,
      cellDays: cells.length,
      ...(days.length > 0 ? { firstDay: days[0], lastDay: days[days.length - 1] } : {}),
    };
  });
  log.info(detail, "fire cells stored");
  return detail.cellDays;
}

export async function ingestWeather(deps: IngestDeps): Promise<number> {
  const detail = await recordFetch(deps.pool, "open-meteo", async () => {
    const grid = await deps.weather.grid(WEATHER_PAST_DAYS, WEATHER_FORECAST_DAYS);
    await weather.upsertGrid(deps.pool, grid);
    return {
      points: WEATHER_POINTS,
      hours: grid.hours,
      from: grid.start.toISOString(),
      to: addHours(grid.start, grid.hours - 1).toISOString(),
    };
  });
  log.info(detail, "weather stored");
  return detail.hours;
}

/**
 * Works out the burning part of the days the live files hold again, under the
 * current screen and list of fixed sources, and stores it in place of what was
 * stored. The hourly fetch only ever raises a stored value, so a changed
 * screen reaches days already stored only through here or the archive replay
 * (`pnpm haze:history`, which needs FIRMS_MAP_KEY and covers every day).
 * The oldest day in the files is left alone: they begin part way through it.
 * Only `burning_mw` changes; the fire power as fetched stays as it was.
 */
export async function rescreenRecentFires(deps: Pick<IngestDeps, "pool" | "fires">): Promise<number> {
  const detail = await recordFetch(deps.pool, "firms", async () => {
    const detections = await deps.fires.recent();
    const oldest = detections.reduce((first, hit) => (hit.day < first ? hit.day : first), "9999-12-31");
    const { cells, glint, offshore, fixed, notVegetation, unconfirmed } = burningCells(detections, fixedMask(await fixedSources.sites(deps.pool, FIXED_MIN_DAYS)));
    const whole = cells.filter((cell) => cell.day > oldest);
    await fires.upsertMany(deps.pool, whole, { rescreen: true });
    return { detections: detections.length, glintDropped: glint, offshoreDropped: offshore, fixedDropped: fixed, notVegetationDropped: notVegetation, unconfirmedDropped: unconfirmed, cellDays: whole.length, rescreenedFrom: oldest };
  });
  log.info(detail, "recent fire days screened again");
  return detail.cellDays;
}
