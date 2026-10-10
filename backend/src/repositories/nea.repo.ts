import type { Queryable } from "../db";
import { type NeaHour, type NeaRegion } from "../sources/nea";

/** Singapore's hourly regional readings. An hour already stored is left as it was first read. */

interface NeaRow {
  region: NeaRegion;
  observed_at: Date;
  pm25_hourly: number | null;
  pm25_24h: number | null;
  psi_24h: number | null;
}

function toHour(row: NeaRow): NeaHour {
  return { region: row.region, observedAt: row.observed_at, pm25Hourly: row.pm25_hourly, pm2524h: row.pm25_24h, psi24h: row.psi_24h };
}

/**
 * Returns how many were new. A row that arrives with only one feed's values
 * is completed by the other feed's later fetch, which is the one update this
 * table allows: a null filled in, never a number changed.
 */
export async function insertMany(db: Queryable, hours: NeaHour[]): Promise<number> {
  if (hours.length === 0) return 0;
  const { rows } = await db.query<{ inserted: boolean }>(
    `insert into nea_hours (region, observed_at, pm25_hourly, pm25_24h, psi_24h)
     select * from unnest($1::text[], $2::timestamptz[], $3::int[], $4::int[], $5::int[])
     on conflict (region, observed_at) do update
       set pm25_hourly = coalesce(nea_hours.pm25_hourly, excluded.pm25_hourly),
           pm25_24h = coalesce(nea_hours.pm25_24h, excluded.pm25_24h),
           psi_24h = coalesce(nea_hours.psi_24h, excluded.psi_24h)
     returning (xmax = 0) as inserted`,
    [hours.map((h) => h.region), hours.map((h) => h.observedAt), hours.map((h) => h.pm25Hourly), hours.map((h) => h.pm2524h), hours.map((h) => h.psi24h)],
  );
  return rows.filter((row) => row.inserted).length;
}

export async function newestAt(db: Queryable): Promise<Date | null> {
  const { rows } = await db.query<{ at: Date | null }>("select max(observed_at) as at from nea_hours");
  return rows[0]?.at ?? null;
}

/** The newest hour with a one-hour PM2.5 for one region, or null. */
export async function latestPm25(db: Queryable, region: NeaRegion): Promise<{ at: Date; value: number } | null> {
  const { rows } = await db.query<{ observed_at: Date; pm25_hourly: number }>(
    "select observed_at, pm25_hourly from nea_hours where region = $1 and pm25_hourly is not null order by observed_at desc limit 1",
    [region],
  );
  return rows[0] ? { at: rows[0].observed_at, value: rows[0].pm25_hourly } : null;
}

/** Every region's hours since an instant, oldest first. */
export async function since(db: Queryable, from: Date): Promise<NeaHour[]> {
  const { rows } = await db.query<NeaRow>(
    "select region, observed_at, pm25_hourly, pm25_24h, psi_24h from nea_hours where observed_at >= $1 order by observed_at, region",
    [from],
  );
  return rows.map(toHour);
}

/** Every region's hours after an instant up to another, oldest first. */
export async function between(db: Queryable, after: Date, until: Date): Promise<NeaHour[]> {
  const { rows } = await db.query<NeaRow>(
    "select region, observed_at, pm25_hourly, pm25_24h, psi_24h from nea_hours where observed_at > $1 and observed_at <= $2 order by observed_at, region",
    [after, until],
  );
  return rows.map(toHour);
}
