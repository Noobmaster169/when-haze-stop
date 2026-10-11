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

/** One issue of the learned model for every instrument it forecast, by instrument then Malaysian day. */
export interface LearnedIssue {
  asOf: Date;
  modelVersion: string;
  byInstrument: Map<string, Map<string, ModelDay>>;
}

interface IssueRow {
  as_of: Date;
  model_version: string;
  instrument_id: string;
  day: string;
  p10: number;
  p50: number;
  p90: number;
}

/**
 * The newest issue at or after `notBefore`, from the version stored most
 * recently at that issue, with every instrument's days. Null where no issue is
 * that recent, so a stale issue never shapes a run.
 */
export async function latestIssue(db: Queryable, notBefore: Date): Promise<LearnedIssue | null> {
  const { rows } = await db.query<IssueRow>(
    `with newest as (
       select as_of, model_version from model_forecasts where as_of >= $1 order by as_of desc, made_at desc limit 1
     )
     select m.as_of, m.model_version, m.instrument_id, to_char(m.day, 'YYYY-MM-DD') as day, m.p10, m.p50, m.p90
       from model_forecasts m join newest n on n.as_of = m.as_of and n.model_version = m.model_version
      order by m.instrument_id, m.day`,
    [notBefore],
  );
  if (rows.length === 0) return null;
  const byInstrument = new Map<string, Map<string, ModelDay>>();
  for (const row of rows) {
    let days = byInstrument.get(row.instrument_id);
    if (!days) {
      days = new Map();
      byInstrument.set(row.instrument_id, days);
    }
    days.set(row.day, { p10: row.p10, p50: row.p50, p90: row.p90 });
  }
  return { asOf: rows[0].as_of, modelVersion: rows[0].model_version, byInstrument };
}
