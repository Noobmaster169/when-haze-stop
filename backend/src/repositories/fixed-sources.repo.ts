import type { Queryable } from "../db";
import type { FixedSite } from "../haze/fixed-sources";

/** Where and when NASA's labelled archive saw a fixed heat source. Insert only. */

export interface FixedSighting {
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: string;
  lat100: number;
  lon100: number;
  kind: "volcano" | "static" | "offshore";
}

/** Returns how many were new. A cell and day already here is left as it is. */
export async function insertMany(db: Queryable, sightings: FixedSighting[]): Promise<number> {
  if (sightings.length === 0) return 0;
  const { rowCount } = await db.query(
    `insert into fixed_source_days (day, lat100, lon100, kind)
     select * from unnest($1::date[], $2::int[], $3::int[], $4::text[])
     on conflict (day, lat100, lon100) do nothing`,
    [sightings.map((seen) => seen.day), sightings.map((seen) => seen.lat100), sightings.map((seen) => seen.lon100), sightings.map((seen) => seen.kind)],
  );
  return rowCount ?? 0;
}

/** The cells marked on at least `minDays` separate days. */
export async function sites(db: Queryable, minDays: number): Promise<FixedSite[]> {
  const { rows } = await db.query<FixedSite>("select lat100, lon100 from fixed_source_days group by lat100, lon100 having count(*) >= $1", [minDays]);
  return rows;
}
