import type { Network } from "../contracts";
import type { Queryable } from "../db";

/**
 * The learned model's forecasts: one row per instrument, Malaysian day and
 * issue time, with the band it gave. Append-only, so every version's record
 * stays and the Simulation page can score each as its days come in.
 */

export interface ModelDay {
  p10: number;
  p50: number;
  p90: number;
}

export interface ModelForecastRow extends ModelDay {
  asOf: Date;
  instrumentId: string;
  /** A Malaysian calendar day, `YYYY-MM-DD`. */
  day: string;
  modelVersion: string;
}

export interface InstrumentForecast {
  asOf: Date;
  modelVersion: string;
  days: Map<string, ModelDay>;
}

/** Returns how many were new. A row already stored is left as it was. */
export async function insertMany(db: Queryable, rows: ModelForecastRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { rowCount } = await db.query(
    `insert into model_forecasts (as_of, instrument_id, day, p10, p50, p90, model_version)
     select * from unnest($1::timestamptz[], $2::text[], $3::date[], $4::real[], $5::real[], $6::real[], $7::text[])
     on conflict do nothing`,
    [rows.map((row) => row.asOf), rows.map((row) => row.instrumentId), rows.map((row) => row.day), rows.map((row) => row.p10), rows.map((row) => row.p50), rows.map((row) => row.p90), rows.map((row) => row.modelVersion)],
  );
  return rowCount ?? 0;
}

interface LatestRow {
  as_of: Date;
  model_version: string;
  day: string;
  p10: number;
  p50: number;
  p90: number;
}

/** The instrument's newest forecast: the rows of its newest issue time, from the version stored most recently. */
export async function latestFor(db: Queryable, instrumentId: string): Promise<InstrumentForecast | null> {
  const { rows } = await db.query<LatestRow>(
    `with newest as (
       select as_of, model_version from model_forecasts where instrument_id = $1 order by as_of desc, made_at desc limit 1
     )
     select m.as_of, m.model_version, to_char(m.day, 'YYYY-MM-DD') as day, m.p10, m.p50, m.p90
       from model_forecasts m join newest n on n.as_of = m.as_of and n.model_version = m.model_version
      where m.instrument_id = $1 order by m.day`,
    [instrumentId],
  );
  if (rows.length === 0) return null;
  return { asOf: rows[0].as_of, modelVersion: rows[0].model_version, days: new Map(rows.map((row) => [row.day, { p10: row.p10, p50: row.p50, p90: row.p90 }])) };
}

/** Whether a version's forecast issued at this time is already stored, so the hourly job asks the service once per issue. */
export async function hasIssue(db: Queryable, asOf: Date, modelVersion: string): Promise<boolean> {
  const { rows } = await db.query<{ one: number }>("select 1 as one from model_forecasts where as_of = $1 and model_version = $2 limit 1", [asOf, modelVersion]);
  return rows.length > 0;
}

/** The version stored most recently and when its first forecast was made, or null before any. */
export async function newestVersion(db: Queryable): Promise<{ modelVersion: string; since: Date } | null> {
  const { rows } = await db.query<{ model_version: string; since: Date }>(
    `select model_version, min(made_at) as since from model_forecasts
      where model_version = (select model_version from model_forecasts order by made_at desc limit 1)
      group by model_version`,
  );
  return rows[0] ? { modelVersion: rows[0].model_version, since: rows[0].since } : null;
}

export interface ScoreRow {
  asOf: Date;
  instrumentId: string;
  network: Network;
  day: string;
  /** 1 for the day after the issue time's Malaysian day, 2 for the day after that. */
  leadDays: number;
  p50: number;
  modelVersion: string;
  /** The day's peak reading, null where the station posted nothing that day. */
  observed: number | null;
  /** The newest reading at the issue time, carried forward: "no change". */
  persistence: number | null;
  /** The peak of the hourly run made at the same issue time over that day, null where there was no run. */
  v2: number | null;
}

interface ScoreRowRaw {
  as_of: Date;
  instrument_id: string;
  network: Network;
  day: string;
  lead_days: number;
  p50: number;
  model_version: string;
  observed: number | null;
  persistence: number | null;
  v2: number | null;
}

/**
 * Every stored forecast for a station whose day has passed, at one and two
 * days ahead, with what happened, for one model version. A day has passed
 * once the newest reading anywhere is on a later Malaysian day. `runModel` and
 * `grid` name the hourly run's method and grid to compare with: runs of
 * another grid are not comparable and `forecast_runs` holds one per grid for
 * the same hour. The day's peak is read over a half-open `observed_at` range,
 * 16:00 UTC the day before to 16:00 UTC that day, so the
 * `(station_id, observed_at)` index serves it.
 */
export async function scorable(db: Queryable, modelVersion: string, runModel: string, grid: string): Promise<ScoreRow[]> {
  const { rows } = await db.query<ScoreRowRaw>(
    `with newest as (select max(observed_at) as at from readings),
     f as (
       select m.as_of, m.instrument_id, m.day, m.p50, m.model_version, s.network,
              m.day - ((m.as_of at time zone 'UTC') + interval '8 hours')::date as lead_days
         from model_forecasts m
         join stations s on s.id = m.instrument_id
         cross join newest n
        where m.model_version = $3 and m.day < ((n.at at time zone 'UTC') + interval '8 hours')::date
     )
     select f.as_of, f.instrument_id, f.network, to_char(f.day, 'YYYY-MM-DD') as day, f.lead_days, f.p50, f.model_version,
            (select max(r.api) from readings r
              where r.station_id = f.instrument_id
                and r.observed_at >= (f.day - interval '8 hours') at time zone 'UTC'
                and r.observed_at < (f.day + interval '16 hours') at time zone 'UTC') as observed,
            (select r.api from readings r
              where r.station_id = f.instrument_id and r.observed_at <= f.as_of order by r.observed_at desc limit 1) as persistence,
            (select max(x.api) from forecast_runs fr
               join station_forecasts sf on sf.run_id = fr.id
               cross join lateral unnest(sf.api) with ordinality as x(api, h)
              where fr.as_of = f.as_of and fr.kind = 'live' and fr.model = $1 and fr.grid = $2 and sf.station_id = f.instrument_id
                and ((fr.as_of at time zone 'UTC') + make_interval(hours => x.h::int) + interval '8 hours')::date = f.day) as v2
       from f
      where f.lead_days between 1 and 2
      order by f.as_of, f.instrument_id, f.day`,
    [runModel, grid, modelVersion],
  );
  return rows.map((row) => ({
    asOf: row.as_of,
    instrumentId: row.instrument_id,
    network: row.network,
    day: row.day,
    leadDays: Number(row.lead_days),
    p50: row.p50,
    modelVersion: row.model_version,
    observed: row.observed,
    persistence: row.persistence,
    v2: row.v2,
  }));
}
