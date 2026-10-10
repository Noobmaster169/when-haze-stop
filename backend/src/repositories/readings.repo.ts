import type { Queryable } from "../db";

/** DOE's hourly readings. Append-only in effect: an hour already stored is left as it was first read. */

export interface Reading {
  stationId: string;
  observedAt: Date;
  api: number;
}

interface ReadingRow {
  station_id: string;
  observed_at: Date;
  api: number;
}

function toReading(row: ReadingRow): Reading {
  return { stationId: row.station_id, observedAt: row.observed_at, api: row.api };
}

/** Returns how many were new. Readings for a station not yet known are skipped, not an error. */
export async function insertMany(db: Queryable, readings: Reading[]): Promise<number> {
  if (readings.length === 0) return 0;
  const { rowCount } = await db.query(
    `insert into readings (station_id, observed_at, api)
     select r.station_id, r.observed_at, r.api
       from unnest($1::text[], $2::timestamptz[], $3::int[]) as r(station_id, observed_at, api)
       join stations s on s.id = r.station_id
     on conflict do nothing`,
    [readings.map((reading) => reading.stationId), readings.map((reading) => reading.observedAt), readings.map((reading) => reading.api)],
  );
  return rowCount ?? 0;
}

/** The hour of the newest reading from any station, or null before the first fetch. */
export async function newestAt(db: Queryable): Promise<Date | null> {
  const { rows } = await db.query<{ at: Date | null }>("select max(observed_at) as at from readings");
  return rows[0]?.at ?? null;
}

export async function oldestAt(db: Queryable): Promise<Date | null> {
  const { rows } = await db.query<{ at: Date | null }>("select min(observed_at) as at from readings");
  return rows[0]?.at ?? null;
}

/** Every station's readings in a window, oldest first. */
export async function between(db: Queryable, from: Date, to: Date): Promise<Reading[]> {
  const { rows } = await db.query<ReadingRow>(
    "select station_id, observed_at, api from readings where observed_at between $1 and $2 order by observed_at",
    [from, to],
  );
  return rows.map(toReading);
}

export async function forStation(db: Queryable, stationId: string, from: Date, to: Date): Promise<Reading[]> {
  const { rows } = await db.query<ReadingRow>(
    "select station_id, observed_at, api from readings where station_id = $1 and observed_at between $2 and $3 order by observed_at",
    [stationId, from, to],
  );
  return rows.map(toReading);
}
