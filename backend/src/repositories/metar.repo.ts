import type { Queryable } from "../db";
import type { MetarReport } from "../sources/metar";

/** Airports and their reports. A report once stored is never rewritten. */

export interface Airport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Observation {
  icao: string;
  observedAt: Date;
  visibilityM: number | null;
  weather: string | null;
  raw: string;
}

interface ObsRow {
  icao: string;
  observed_at: Date;
  visibility_m: number | null;
  weather: string | null;
  raw: string;
}

function toObservation(row: ObsRow): Observation {
  return { icao: row.icao, observedAt: row.observed_at, visibilityM: row.visibility_m, weather: row.weather, raw: row.raw };
}

export async function upsertAirports(db: Queryable, reports: MetarReport[]): Promise<void> {
  const seen = new Map(reports.map((report) => [report.icao, report]));
  for (const report of seen.values()) {
    await db.query(
      `insert into airports (icao, name, lat, lon) values ($1, $2, $3, $4)
       on conflict (icao) do update set name = excluded.name, lat = excluded.lat, lon = excluded.lon, updated_at = now()`,
      [report.icao, report.name, report.lat, report.lon],
    );
  }
}

/** Returns how many were new. */
export async function insertMany(db: Queryable, reports: MetarReport[]): Promise<number> {
  if (reports.length === 0) return 0;
  const { rowCount } = await db.query(
    `insert into metar_obs (icao, observed_at, visibility_m, weather, raw)
     select * from unnest($1::text[], $2::timestamptz[], $3::int[], $4::text[], $5::text[])
     on conflict do nothing`,
    [reports.map((r) => r.icao), reports.map((r) => r.observedAt), reports.map((r) => r.visibilityM), reports.map((r) => r.weather), reports.map((r) => r.raw)],
  );
  return rowCount ?? 0;
}

export async function airports(db: Queryable): Promise<Airport[]> {
  const { rows } = await db.query<Airport>("select icao, name, lat, lon from airports order by icao");
  return rows;
}

export async function newestAt(db: Queryable): Promise<Date | null> {
  const { rows } = await db.query<{ at: Date | null }>("select max(observed_at) as at from metar_obs");
  return rows[0]?.at ?? null;
}

/** One airport's reports since an instant, oldest first. */
export async function forAirport(db: Queryable, icao: string, since: Date): Promise<Observation[]> {
  const { rows } = await db.query<ObsRow>(
    "select icao, observed_at, visibility_m, weather, raw from metar_obs where icao = $1 and observed_at >= $2 order by observed_at",
    [icao, since],
  );
  return rows.map(toObservation);
}

/** Every airport's reports since an instant, thinned to the newest in each hour, oldest first. */
export async function hourly(db: Queryable, since: Date): Promise<Observation[]> {
  const { rows } = await db.query<ObsRow>(
    `select icao, observed_at, visibility_m, weather, raw from (
       select distinct on (icao, date_trunc('hour', observed_at)) icao, observed_at, visibility_m, weather, raw
         from metar_obs where observed_at >= $1
         order by icao, date_trunc('hour', observed_at), observed_at desc
     ) newest order by icao, observed_at`,
    [since],
  );
  return rows.map(toObservation);
}

/** The newest report of every airport since an instant. */
export async function latestEach(db: Queryable, since: Date): Promise<Observation[]> {
  const { rows } = await db.query<ObsRow>(
    `select distinct on (icao) icao, observed_at, visibility_m, weather, raw from metar_obs
      where observed_at >= $1 order by icao, observed_at desc`,
    [since],
  );
  return rows.map(toObservation);
}
