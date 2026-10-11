import { DOMAIN, WEATHER } from "./grid";
import type { WeatherGrid } from "./transport";

/**
 * The stored wind and rain at one place, a UTC day at a time. Pure.
 *
 * The same bilinear blend between the four grid points around a place that
 * the transport model moves its particles by, so a model trained on these
 * numbers sees the wind the smoke was carried on.
 */

export interface DayWind {
  day: string;
  /** Mean transport wind over the day's stored hours, metres a second: east is positive u, north positive v. */
  u: number;
  v: number;
  /** Rain over the day's stored hours, millimetres. */
  rainMm: number;
  hours: number;
}

const HOUR_MS = 3_600_000;

/** One entry per UTC day the grid has hours of. A place outside the grid has none. */
export function dailyWindAt(grid: WeatherGrid, lat: number, lon: number): DayWind[] {
  const x = Math.min(WEATHER.nx - 1 - 1e-9, (lon - DOMAIN.lon0) / WEATHER.step);
  const y = Math.min(WEATHER.ny - 1 - 1e-9, (lat - DOMAIN.lat0) / WEATHER.step);
  if (x < 0 || y < 0 || lon > DOMAIN.lon1 || lat > DOMAIN.lat1) return [];
  const i = Math.floor(x);
  const j = Math.floor(y);
  const ax = x - i;
  const ay = y - j;
  const points = WEATHER.nx * WEATHER.ny;

  const days = new Map<string, DayWind>();
  for (let hour = 0; hour < grid.hours; hour++) {
    const at = hour * points + j * WEATHER.nx + i;
    const blend = (field: Float32Array): number =>
      field[at] * (1 - ax) * (1 - ay) + field[at + 1] * ax * (1 - ay) + field[at + WEATHER.nx] * (1 - ax) * ay + field[at + WEATHER.nx + 1] * ax * ay;
    const day = new Date(grid.start.getTime() + hour * HOUR_MS).toISOString().slice(0, 10);
    const entry = days.get(day) ?? { day, u: 0, v: 0, rainMm: 0, hours: 0 };
    entry.u += blend(grid.u);
    entry.v += blend(grid.v);
    entry.rainMm += blend(grid.rain);
    entry.hours += 1;
    days.set(day, entry);
  }
  return [...days.values()].map((entry) => ({ ...entry, u: entry.u / entry.hours, v: entry.v / entry.hours }));
}
