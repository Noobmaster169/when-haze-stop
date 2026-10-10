import { z } from "zod";

import { DOMAIN, WEATHER, WEATHER_POINTS } from "../haze/grid";
import type { WeatherGrid } from "../haze/transport";
import { RetryableError, TerminalError } from "../lib/errors";
import { fetchText, pause } from "./http";

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
}

const BASE = "https://api.open-meteo.com/v1/forecast";
const FIELDS = "wind_speed_925hPa,wind_direction_925hPa,wind_speed_850hPa,wind_direction_850hPa,precipitation";
const TIMEOUT_MS = 60_000;
/** One request per row of the grid, spaced out to stay well inside the free tier. */
const SPACING_MS = 1500;

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

async function fetchRow(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchText(url, "Open-Meteo forecast", TIMEOUT_MS);
    } catch (error) {
      if (!(error instanceof RetryableError) || attempt >= ATTEMPTS) throw error;
      await pause(RETRY_WAIT_MS * attempt);
    }
  }
}

export function openMeteoClient(): WeatherClient {
  return {
    async grid(pastDays, forecastDays) {
      const lons = Array.from({ length: WEATHER.nx }, (_, i) => DOMAIN.lon0 + i * WEATHER.step);
      const rows: Location[][] = [];
      for (let j = 0; j < WEATHER.ny; j++) {
        const lat = DOMAIN.lat0 + j * WEATHER.step;
        const url =
          `${BASE}?latitude=${lons.map(() => lat).join(",")}&longitude=${lons.join(",")}` +
          `&hourly=${FIELDS}&past_days=${pastDays}&forecast_days=${forecastDays}&wind_speed_unit=ms&timezone=GMT`;
        const parsed = Row.safeParse(JSON.parse(await fetchRow(url)));
        if (!parsed.success) throw new TerminalError("Open-Meteo answered in a shape this client does not know", { cause: parsed.error });
        rows.push(parsed.data);
        if (j < WEATHER.ny - 1) await pause(SPACING_MS);
      }
      return assembleGrid(rows);
    },
  };
}
