import type { Queryable } from "../db";
import { addHours, WEATHER_POINTS } from "../haze/grid";
import type { WeatherGrid } from "../haze/transport";

/**
 * The weather as it was forecast at each fetch. weather_hours keeps only the
 * newest value of an hour, which for a past hour is the analysis, so a replay
 * that reads it knows the real wind. This table keeps what the forecast said
 * before the hour came, so a forecast can be scored on what it really had.
 */

interface FetchRow {
  fetched_at: Date;
  u_ms: number[];
  v_ms: number[];
  rain_mm: number[];
}

export interface StoredFetch {
  fetchedAt: Date;
  u: number[];
  v: number[];
  rain: number[];
}

/** Stores the hours of `grid` after `fetchedAt`, the forecast part. Returns how many were new. */
export async function insertForecastHours(db: Queryable, grid: WeatherGrid, fetchedAt: Date): Promise<number> {
  let added = 0;
  for (let hour = 0; hour < grid.hours; hour++) {
    const validAt = addHours(grid.start, hour);
    if (validAt <= fetchedAt) continue;
    const slice = (field: Float32Array): number[] => Array.from(field.subarray(hour * WEATHER_POINTS, (hour + 1) * WEATHER_POINTS));
    const { rowCount } = await db.query(
      "insert into weather_forecasts (fetched_at, valid_at, u_ms, v_ms, rain_mm) values ($1, $2, $3, $4, $5) on conflict do nothing",
      [fetchedAt, validAt, slice(grid.u), slice(grid.v), slice(grid.rain)],
    );
    added += rowCount ?? 0;
  }
  return added;
}

/** Every fetch that forecast an hour, newest first: how the forecast for it changed as the hour came nearer. */
export async function fetchesFor(db: Queryable, validAt: Date): Promise<StoredFetch[]> {
  const { rows } = await db.query<FetchRow>("select fetched_at, u_ms, v_ms, rain_mm from weather_forecasts where valid_at = $1 order by fetched_at desc", [validAt]);
  return rows.map((row) => ({ fetchedAt: row.fetched_at, u: row.u_ms, v: row.v_ms, rain: row.rain_mm }));
}
