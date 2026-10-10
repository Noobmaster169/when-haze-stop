import type { FireCell, FireDay } from "../contracts";
import type { Queryable } from "../db";
import type { FireCellDay, StoredCellDay } from "../haze/fires";

/**
 * Fire radiative power per cell and day. A later fetch can only raise what was
 * seen, never lower it. Every read takes the burning part where there is one,
 * so a gas flare stored before it was known as one still stays out of the model.
 */

/** What burns in a cell-day: the screened value, or the fetched one on a row from before the screen. */
const BURNING = "coalesce(burning_mw, frp_mw)";

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
 *
 * `rescreen` is for a replay of the archive against a changed list of fixed
 * sources: the burning part is derived from that list, so it is set to the new
 * answer even where that is lower. What was seen is still only raised.
 */
export async function upsertMany(db: Queryable, cells: StoredCellDay[], options: { rescreen?: boolean } = {}): Promise<void> {
  if (cells.length === 0) return;
  const burning = options.rescreen
    ? "excluded.burning_mw"
    : "case when excluded.burning_mw is null then fire_cells.burning_mw else greatest(coalesce(fire_cells.burning_mw, 0), excluded.burning_mw) end";
  await db.query(
    `insert into fire_cells (day, lat10, lon10, frp_mw, burning_mw)
     select * from unnest($1::date[], $2::int[], $3::int[], $4::real[], $5::real[])
     on conflict (day, lat10, lon10) do update
       set frp_mw = greatest(fire_cells.frp_mw, excluded.frp_mw), burning_mw = ${burning}`,
    [cells.map((cell) => cell.day), cells.map((cell) => cell.lat10), cells.map((cell) => cell.lon10), cells.map((cell) => cell.frpMw), cells.map((cell) => cell.burningMw)],
  );
}

export async function since(db: Queryable, day: string): Promise<FireCellDay[]> {
  const { rows } = await db.query<FireRow>(
    `select to_char(day, 'YYYY-MM-DD') as day, lat10, lon10, ${BURNING} as frp_mw from fire_cells where day >= $1 and ${BURNING} > 0`,
    [day],
  );
  return rows.map((row) => ({ day: row.day, lat10: row.lat10, lon10: row.lon10, frpMw: row.frp_mw }));
}

/** The strongest cells over a span of days, for the map: each cell at its largest day. Open-ended without `toDay`. */
export async function strongest(db: Queryable, fromDay: string, limit: number, toDay = "9999-12-31"): Promise<FireCell[]> {
  const { rows } = await db.query<{ lat10: number; lon10: number; frp_mw: number }>(
    `select lat10, lon10, max(${BURNING}) as frp_mw from fire_cells where day between $1 and $3 and ${BURNING} > 0
      group by lat10, lon10 order by max(${BURNING}) desc limit $2`,
    [fromDay, limit, toDay],
  );
  // The cell's centre, which is where a dot for it belongs.
  return rows.map((row) => ({ lat: row.lat10 / 10 + 0.05, lon: row.lon10 / 10 + 0.05, frpMw: Math.round(row.frp_mw) }));
}

/** The newest UTC day with any detection, or null before the first fetch. */
export async function newestDay(db: Queryable): Promise<string | null> {
  const { rows } = await db.query<{ day: string | null }>(`select to_char(max(day), 'YYYY-MM-DD') as day from fire_cells where ${BURNING} > 0`);
  return rows[0]?.day ?? null;
}

/** The oldest UTC day with anything stored, or null before the first fetch. */
export async function oldestDay(db: Queryable): Promise<string | null> {
  const { rows } = await db.query<{ day: string | null }>("select to_char(min(day), 'YYYY-MM-DD') as day from fire_cells");
  return rows[0]?.day ?? null;
}

/** Every stored day with something burning, oldest first. */
export async function byDay(db: Queryable): Promise<FireDay[]> {
  const { rows } = await db.query<{ day: string; cells: string; frp_mw: number }>(
    `select to_char(day, 'YYYY-MM-DD') as day, count(*) as cells, sum(${BURNING}) as frp_mw
       from fire_cells where ${BURNING} > 0 group by day order by day`,
  );
  return rows.map((row) => ({ day: row.day, cells: Number(row.cells), frpMw: Math.round(row.frp_mw) }));
}

/** The burning cells and their total fire power on one UTC day. */
export async function dayTotal(db: Queryable, day: string): Promise<{ cells: number; frpMw: number }> {
  const { rows } = await db.query<{ cells: string; frp: number | null }>(`select count(*) as cells, sum(${BURNING}) as frp from fire_cells where day = $1 and ${BURNING} > 0`, [day]);
  return { cells: Number(rows[0]?.cells ?? 0), frpMw: Math.round(Number(rows[0]?.frp ?? 0)) };
}
