import type { FireCell } from "../contracts";
import type { Queryable } from "../db";
import type { FireCellDay } from "../haze/fires";

/** Fire radiative power per cell and day. A later fetch can only raise a cell, never lower it. */

interface FireRow {
  day: string;
  lat10: number;
  lon10: number;
  frp_mw: number;
}

/**
 * The seven-day file is refetched whole, so most cells are already here. A
 * day's sum only grows as more satellite passes arrive, which is why the
 * larger value wins.
 */
export async function upsertMany(db: Queryable, cells: FireCellDay[]): Promise<void> {
  if (cells.length === 0) return;
  await db.query(
    `insert into fire_cells (day, lat10, lon10, frp_mw)
     select * from unnest($1::date[], $2::int[], $3::int[], $4::real[])
     on conflict (day, lat10, lon10) do update set frp_mw = greatest(fire_cells.frp_mw, excluded.frp_mw)`,
    [cells.map((cell) => cell.day), cells.map((cell) => cell.lat10), cells.map((cell) => cell.lon10), cells.map((cell) => cell.frpMw)],
  );
}

export async function since(db: Queryable, day: string): Promise<FireCellDay[]> {
  const { rows } = await db.query<FireRow>("select to_char(day, 'YYYY-MM-DD') as day, lat10, lon10, frp_mw from fire_cells where day >= $1", [day]);
  return rows.map((row) => ({ day: row.day, lat10: row.lat10, lon10: row.lon10, frpMw: row.frp_mw }));
}

/** The strongest cells over a span of days, for the map: each cell at its largest day. */
export async function strongest(db: Queryable, fromDay: string, limit: number): Promise<FireCell[]> {
  const { rows } = await db.query<{ lat10: number; lon10: number; frp_mw: number }>(
    `select lat10, lon10, max(frp_mw) as frp_mw from fire_cells where day >= $1
      group by lat10, lon10 order by max(frp_mw) desc limit $2`,
    [fromDay, limit],
  );
  // The cell's centre, which is where a dot for it belongs.
  return rows.map((row) => ({ lat: row.lat10 / 10 + 0.05, lon: row.lon10 / 10 + 0.05, frpMw: Math.round(row.frp_mw) }));
}

/** The newest UTC day with any detection, or null before the first fetch. */
export async function newestDay(db: Queryable): Promise<string | null> {
  const { rows } = await db.query<{ day: string | null }>("select to_char(max(day), 'YYYY-MM-DD') as day from fire_cells");
  return rows[0]?.day ?? null;
}

/** The burning cells and their total fire power on one UTC day. */
export async function dayTotal(db: Queryable, day: string): Promise<{ cells: number; frpMw: number }> {
  const { rows } = await db.query<{ cells: string; frp: number | null }>("select count(*) as cells, sum(frp_mw) as frp from fire_cells where day = $1", [day]);
  return { cells: Number(rows[0]?.cells ?? 0), frpMw: Math.round(Number(rows[0]?.frp ?? 0)) };
}
