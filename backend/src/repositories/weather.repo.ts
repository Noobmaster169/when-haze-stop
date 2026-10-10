import type { Queryable } from "../db";
import { addHours, hoursBetween, WEATHER_POINTS } from "../haze/grid";
import type { WeatherGrid } from "../haze/transport";

/** Transport wind and rain, one row an hour. A newer fetch replaces an hour, as a forecast becomes an analysis. */

interface HourRow {
  valid_at: Date;
  u_ms: number[];
  v_ms: number[];
  rain_mm: number[];
}

export async function upsertGrid(db: Queryable, grid: WeatherGrid): Promise<void> {
  for (let hour = 0; hour < grid.hours; hour++) {
    const slice = (field: Float32Array): number[] => Array.from(field.subarray(hour * WEATHER_POINTS, (hour + 1) * WEATHER_POINTS));
    await db.query(
      `insert into weather_hours (valid_at, u_ms, v_ms, rain_mm) values ($1, $2, $3, $4)
       on conflict (valid_at) do update
         set u_ms = excluded.u_ms, v_ms = excluded.v_ms, rain_mm = excluded.rain_mm, fetched_at = now()`,
      [addHours(grid.start, hour), slice(grid.u), slice(grid.v), slice(grid.rain)],
    );
  }
}

/**
 * The hours from `from` on, as one unbroken grid. Stops at the first missing
 * hour, because the model steps an hour at a time and cannot step over a gap.
 * Null where `from` itself is not stored.
 */
export async function load(db: Queryable, from: Date, to: Date): Promise<WeatherGrid | null> {
  const { rows } = await db.query<HourRow>(
    "select valid_at, u_ms, v_ms, rain_mm from weather_hours where valid_at between $1 and $2 order by valid_at",
    [from, to],
  );
  let hours = 0;
  // A row on an older, smaller grid counts as missing: the next fetch replaces it.
  while (hours < rows.length && hoursBetween(from, rows[hours].valid_at) === hours && rows[hours].u_ms.length === WEATHER_POINTS) hours++;
  if (hours === 0) return null;

  const grid: WeatherGrid = {
    start: from,
    hours,
    u: new Float32Array(hours * WEATHER_POINTS),
    v: new Float32Array(hours * WEATHER_POINTS),
    rain: new Float32Array(hours * WEATHER_POINTS),
  };
  for (let hour = 0; hour < hours; hour++) {
    grid.u.set(rows[hour].u_ms, hour * WEATHER_POINTS);
    grid.v.set(rows[hour].v_ms, hour * WEATHER_POINTS);
    grid.rain.set(rows[hour].rain_mm, hour * WEATHER_POINTS);
  }
  return grid;
}

export async function earliestAt(db: Queryable): Promise<Date | null> {
  const { rows } = await db.query<{ at: Date | null }>("select min(valid_at) as at from weather_hours");
  return rows[0]?.at ?? null;
}

/** The wind at the hours asked for, for the map's animation. Hours not stored are left out. */
export async function windAt(db: Queryable, hours: Date[]): Promise<{ validAt: Date; u: number[]; v: number[] }[]> {
  if (hours.length === 0) return [];
  const { rows } = await db.query<HourRow>("select valid_at, u_ms, v_ms, rain_mm from weather_hours where valid_at = any($1) order by valid_at", [hours]);
  return rows.filter((row) => row.u_ms.length === WEATHER_POINTS).map((row) => ({ validAt: row.valid_at, u: row.u_ms, v: row.v_ms }));
}

/** How many hours of wind are stored on the current grid. */
export async function hoursStored(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ hours: string }>("select count(*) as hours from weather_hours where array_length(u_ms, 1) = $1", [WEATHER_POINTS]);
  return Number(rows[0]?.hours ?? 0);
}
