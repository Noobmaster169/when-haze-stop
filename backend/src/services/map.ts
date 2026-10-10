import type { Airport, HazeMap } from "../contracts";
import type { Queryable } from "../db";
import { addHours, DOMAIN, FIELD, WEATHER } from "../haze/grid";
import { HORIZON_HOURS } from "../haze/run";
import { fires, forecasts, metar, stations, weather } from "../repositories";

/** Everything the map draws, in one read: the week behind, the days ahead, the stations, the fires and the wind. */

const HISTORY_DAYS = 7;
/** A fire is drawn for this long after it was seen, so the map needs this much before its first frame. */
const FIRE_DAYS = 2;
const FIRE_LIMIT = 1500;
/** Metres a second times eight fits a signed byte up to 15.9 m/s, which no transport wind here reaches. */
const WIND_SCALE = 8;

export function packWind(u: number[], v: number[]): string {
  const bytes = new Int8Array(u.length * 2);
  for (let point = 0; point < u.length; point++) {
    bytes[point * 2] = Math.max(-127, Math.min(127, Math.round(u[point] * WIND_SCALE)));
    bytes[point * 2 + 1] = Math.max(-127, Math.min(127, Math.round(v[point] * WIND_SCALE)));
  }
  return Buffer.from(bytes.buffer).toString("base64");
}

/** Every airport with its reports from an instant to another, or to the newest without one, so the visibility layer can follow the timeline. */
export async function airportsBetween(db: Queryable, from: Date, until: Date | null): Promise<Airport[]> {
  const reports = await metar.hourly(db, from, until);
  return (await metar.airports(db)).map((airport) => ({
    ...airport,
    reports: reports
      .filter((report) => report.icao === airport.icao)
      .map((report) => ({ at: report.observedAt.toISOString(), m: report.visibilityM, wx: report.weather })),
  }));
}

export async function hazeMap(db: Queryable): Promise<HazeMap> {
  const run = await forecasts.latest(db);
  const grid = { lon0: DOMAIN.lon0, lat0: DOMAIN.lat0, nx: FIELD.nx, ny: FIELD.ny, step: FIELD.step };
  const windGrid = { lon0: DOMAIN.lon0, lat0: DOMAIN.lat0, nx: WEATHER.nx, ny: WEATHER.ny, step: WEATHER.step };
  const all = await stations.list(db);
  if (!run) return { run: null, grid, windGrid, stations: all, frames: [], wind: [], fires: [], airports: await airportsBetween(db, addHours(new Date(), -24 * HISTORY_DAYS), null) };

  const asOf = new Date(run.asOf);
  const stored = await forecasts.timeline(db, addHours(asOf, -24 * HISTORY_DAYS), addHours(asOf, HORIZON_HOURS));
  const winds = await weather.windAt(db, stored.map((frame) => frame.validAt));
  const fireFrom = addHours(asOf, -24 * (HISTORY_DAYS + FIRE_DAYS)).toISOString().slice(0, 10);

  return {
    run,
    grid,
    windGrid,
    stations: all,
    frames: stored.map((frame) => ({ validAt: frame.validAt.toISOString(), observed: frame.validAt <= asOf, field: frame.field.toString("base64") })),
    wind: winds.map((hour) => ({ validAt: hour.validAt.toISOString(), uv: packWind(hour.u, hour.v) })),
    fires: await fires.strongestByDay(db, fireFrom, FIRE_LIMIT),
    airports: await airportsBetween(db, addHours(asOf, -24 * HISTORY_DAYS), null),
  };
}
