import { z } from "zod";

import { DOMAIN, WEATHER, WEATHER_POINTS } from "../haze/grid";
import type { WeatherGrid } from "../haze/transport";
import { RetryableError, TerminalError, UpstreamError } from "../lib/errors";
import { fetchPatiently, fetchText, pause } from "./http";

/**
 * Open-Meteo: the wind that carries the smoke and the rain that removes it.
 *
 * Smoke travels around a kilometre up, so the transport wind is the mean of
 * the 925 and 850 hPa levels. Over a week of DOE readings that matched better
 * (0.77) than the wind at 100 m (0.66). Past hours are the forecast model's
 * own analysis; future hours are its forecast.
 */

export interface WeatherClient {
  /** Hourly over the whole grid, from `pastDays` ago to `forecastDays` ahead. */
  grid(pastDays: number, forecastDays: number): Promise<WeatherGrid>;
  /** Hourly over the whole grid for whole UTC days in the past, both days included. */
  history(firstDay: string, lastDay: string): Promise<WeatherGrid>;
}

const BASE = "https://api.open-meteo.com/v1/forecast";
/** The same model's past runs, kept from 2022 on. The reanalysis archive has no wind at these levels. */
const HISTORY_BASE = "https://historical-forecast-api.open-meteo.com/v1/forecast";
const FIELDS = "wind_speed_925hPa,wind_direction_925hPa,wind_speed_850hPa,wind_direction_850hPa,precipitation";
const TIMEOUT_MS = 60_000;
/** One request per row of the grid, spaced out to stay well inside the free tier. */
const SPACING_MS = 1500;
/**
 * Open-Meteo counts a request by its locations and days: two weeks of a 25
 * point row is 25 calls, against 5,000 an hour for one address. At this
 * spacing the history takes about 3,750 of them an hour and leaves the rest
 * to the hourly fetch, which the map depends on.
 */
const HISTORY_SPACING_MS = 24_000;
/** "Hourly API request limit exceeded. Please try again in the next hour." is answered until the hour turns. */
const LIMIT_WAIT_MS = 10 * 60_000;
const LIMIT_WAITS = 7;

const series = z.array(z.number().nullable());
const Location = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    wind_speed_925hPa: series,
    wind_direction_925hPa: series,
    wind_speed_850hPa: series,
    wind_direction_850hPa: series,
    precipitation: series,
  }),
});
const Row = z.array(Location).length(WEATHER.nx);
type Location = z.infer<typeof Location>;

/** Meteorological direction is where the wind comes from, clockwise from north. */
function component(speed: number, fromDeg: number): { u: number; v: number } {
  const angle = (fromDeg * Math.PI) / 180;
  return { u: -speed * Math.sin(angle), v: -speed * Math.cos(angle) };
}

/** The hours every point of a row has all its values for, counted from the first. */
function completeHours(row: Location[]): number {
  let hours = row[0].hourly.time.length;
  for (const { hourly } of row) {
    for (const values of [hourly.wind_speed_925hPa, hourly.wind_direction_925hPa, hourly.wind_speed_850hPa, hourly.wind_direction_850hPa]) {
      const gap = values.findIndex((value) => value === null);
      if (gap >= 0 && gap < hours) hours = gap;
    }
  }
  return hours;
}

export function assembleGrid(rows: Location[][]): WeatherGrid {
  // The model's last hours are empty for some variables. The grid stops where any point does.
  const hours = Math.min(...rows.map(completeHours));
  if (hours === 0) throw new TerminalError("Open-Meteo returned no complete hour");
  const grid: WeatherGrid = {
    start: new Date(`${rows[0][0].hourly.time[0]}:00Z`),
    hours,
    u: new Float32Array(hours * WEATHER_POINTS),
    v: new Float32Array(hours * WEATHER_POINTS),
    rain: new Float32Array(hours * WEATHER_POINTS),
  };
  rows.forEach((row, j) => {
    row.forEach(({ hourly }, i) => {
      for (let hour = 0; hour < hours; hour++) {
        const low = component(hourly.wind_speed_925hPa[hour] as number, hourly.wind_direction_925hPa[hour] as number);
        const high = component(hourly.wind_speed_850hPa[hour] as number, hourly.wind_direction_850hPa[hour] as number);
        const at = hour * WEATHER_POINTS + j * WEATHER.nx + i;
        grid.u[at] = (low.u + high.u) / 2;
        grid.v[at] = (low.v + high.v) / 2;
        grid.rain[at] = hourly.precipitation[hour] ?? 0;
      }
    });
  });
  return grid;
}

/** Tries per row before the whole fetch is given up. A dropped connection on one of fifteen rows should not cost the hour. */
const ATTEMPTS = 3;
const RETRY_WAIT_MS = 5_000;

async function fetchRow(url: string, what: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchText(url, what, TIMEOUT_MS);
    } catch (error) {
      if (!(error instanceof RetryableError) || attempt >= ATTEMPTS) throw error;
      await pause(RETRY_WAIT_MS * attempt);
    }
  }
}

/**
 * One row, read. Open-Meteo now and then answers 200 with a sentence about an
 * unexpected error where the JSON should be, and the same request works a
 * moment later.
 */
async function fetchParsedRow(url: string, what: string, fetchOne: (url: string, what: string) => Promise<string>): Promise<Location[]> {
  for (let attempt = 1; ; attempt++) {
    const text = await fetchOne(url, what);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (error) {
      if (attempt >= ATTEMPTS) throw new RetryableError(`${what} answered "${text.slice(0, 80)}"`, { cause: error });
      await pause(RETRY_WAIT_MS * attempt);
      continue;
    }
    const parsed = Row.safeParse(body);
    if (!parsed.success) throw new TerminalError("Open-Meteo answered in a shape this client does not know", { cause: parsed.error });
    return parsed.data;
  }
}

/** Hundreds of requests in a row: a dropped connection should cost a wait and not the run, and so should the hourly limit. */
async function fetchHistoryRow(url: string, what: string): Promise<string> {
  for (let waited = 0; ; waited++) {
    try {
      return await fetchPatiently(url, what, TIMEOUT_MS);
    } catch (error) {
      // The daily limit lifts tomorrow, which is the next run's business, not a wait.
      if (!(error instanceof UpstreamError) || error.status !== 429 || /daily/i.test(error.message) || waited >= LIMIT_WAITS) throw error;
      await pause(LIMIT_WAIT_MS);
    }
  }
}

/** One request per row of the grid; `span` is the part of the query that says which hours. */
async function fetchGrid(base: string, span: string, what: string, spacingMs: number, fetchOne: (url: string, what: string) => Promise<string> = fetchRow): Promise<WeatherGrid> {
  const lons = Array.from({ length: WEATHER.nx }, (_, i) => DOMAIN.lon0 + i * WEATHER.step);
  const rows: Location[][] = [];
  for (let j = 0; j < WEATHER.ny; j++) {
    const lat = DOMAIN.lat0 + j * WEATHER.step;
    const url = `${base}?latitude=${lons.map(() => lat).join(",")}&longitude=${lons.join(",")}&hourly=${FIELDS}&${span}&wind_speed_unit=ms&timezone=GMT`;
    rows.push(await fetchParsedRow(url, what, fetchOne));
    if (j < WEATHER.ny - 1) await pause(spacingMs);
  }
  return assembleGrid(rows);
}

export function openMeteoClient(): WeatherClient {
  return {
    async grid(pastDays, forecastDays) {
      return fetchGrid(BASE, `past_days=${pastDays}&forecast_days=${forecastDays}`, "Open-Meteo forecast", SPACING_MS);
    },
    async history(firstDay, lastDay) {
      const grid = await fetchGrid(HISTORY_BASE, `start_date=${firstDay}&end_date=${lastDay}`, "Open-Meteo history", HISTORY_SPACING_MS, fetchHistoryRow);
      // The caller asks span after span, and the last row of one must not run into the first of the next.
      await pause(HISTORY_SPACING_MS);
      return grid;
    },
  };
}
