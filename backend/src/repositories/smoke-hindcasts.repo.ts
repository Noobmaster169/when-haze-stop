import type { Queryable } from "../db";

/**
 * The transport model's smoke near an instrument, run with the fires and wind
 * known at an issue time. `pnpm haze:hindcast` writes it over the stored
 * history; the model package reads it as a feature. Append-only: a method
 * change is a new `model` name, never a rewrite.
 */

export interface SmokeHindcast {
  asOf: Date;
  instrumentId: string;
  smokeNow: number;
  smoke24h: number;
  smoke48h: number;
  model: string;
}

/** Returns how many were new. A row already stored is left as it was. */
export async function insertMany(pool: Queryable, rows: SmokeHindcast[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { rowCount } = await pool.query(
    `insert into smoke_hindcasts (as_of, instrument_id, smoke_now, smoke_24h, smoke_48h, model)
     select * from unnest($1::timestamptz[], $2::text[], $3::real[], $4::real[], $5::real[], $6::text[])
     on conflict do nothing`,
    [rows.map((row) => row.asOf), rows.map((row) => row.instrumentId), rows.map((row) => row.smokeNow), rows.map((row) => row.smoke24h), rows.map((row) => row.smoke48h), rows.map((row) => row.model)],
  );
  return rowCount ?? 0;
}

/** The issue times a method already has, as ISO strings, so a rerun of the job skips them. */
export async function storedDays(pool: Queryable, model: string): Promise<Set<string>> {
  const { rows } = await pool.query<{ as_of: Date }>("select distinct as_of from smoke_hindcasts where model = $1", [model]);
  return new Set(rows.map((row) => row.as_of.toISOString()));
}

/** The instruments a method already has for each issue time, keyed by ISO string, so a rerun runs a day again only for instruments added since. */
export async function storedInstruments(pool: Queryable, model: string): Promise<Map<string, Set<string>>> {
  const { rows } = await pool.query<{ as_of: Date; instrument_ids: string[] }>(
    "select as_of, array_agg(instrument_id) as instrument_ids from smoke_hindcasts where model = $1 group by as_of",
    [model],
  );
  return new Map(rows.map((row) => [row.as_of.toISOString(), new Set(row.instrument_ids)]));
}
