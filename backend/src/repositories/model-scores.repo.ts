import type { Network } from "../contracts";
import type { Queryable } from "../db";

/**
 * The learned model's stored forecasts beside what came in: the rows the
 * Simulation page and the Model page score. Read-only; model-forecasts.repo.ts
 * writes the rows.
 */

export interface ScoreRow {
  asOf: Date;
  instrumentId: string;
  network: Network;
  day: string;
  /** 1 for the day after the issue time's Malaysian day, 2 for the day after that. */
  leadDays: number;
  p10: number;
  p50: number;
  p90: number;
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
  p10: number;
  p50: number;
  p90: number;
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
       select m.as_of, m.instrument_id, m.day, m.p10, m.p50, m.p90, m.model_version, s.network,
              m.day - ((m.as_of at time zone 'UTC') + interval '8 hours')::date as lead_days
         from model_forecasts m
         join stations s on s.id = m.instrument_id
         cross join newest n
        where m.model_version = $3 and m.day < ((n.at at time zone 'UTC') + interval '8 hours')::date
     )
     select f.as_of, f.instrument_id, f.network, to_char(f.day, 'YYYY-MM-DD') as day, f.lead_days, f.p10, f.p50, f.p90, f.model_version,
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
    p10: row.p10,
    p50: row.p50,
    p90: row.p90,
    modelVersion: row.model_version,
    observed: row.observed,
    persistence: row.persistence,
    v2: row.v2,
  }));
}
