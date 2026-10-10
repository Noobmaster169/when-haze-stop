import type { Queryable } from "../db";
import { GRID_KEY } from "../haze/grid";
import { MODEL_VERSION } from "../haze/run";

/**
 * The Suppression Council's reads and writes: what the council needs from the
 * stored model runs and fires, and (later) its own runs and event log.
 */

export interface RunCalibration {
  asOf: Date;
  intercept: number;
  slope: number;
}

/** The newest model run on the current grid and method, with the line that turns its smoke into ug/m3. */
export async function latestCalibration(db: Queryable): Promise<RunCalibration | null> {
  const { rows } = await db.query<{ as_of: Date; intercept: number; slope: number }>(
    "select as_of, intercept, slope from forecast_runs where grid = $1 and model = $2 order by as_of desc, id desc limit 1",
    [GRID_KEY, MODEL_VERSION],
  );
  return rows[0] ? { asOf: rows[0].as_of, intercept: rows[0].intercept, slope: rows[0].slope } : null;
}

/** For every cell that burned between the two days, how many days it burned. */
export async function daysBurning(db: Queryable, fromDay: string, toDay: string): Promise<Map<string, number>> {
  const { rows } = await db.query<{ lat10: number; lon10: number; days: number }>(
    `select lat10, lon10, count(distinct day)::int as days from fire_cells
      where day between $1 and $2 and coalesce(burning_mw, frp_mw) > 0 group by lat10, lon10`,
    [fromDay, toDay],
  );
  return new Map(rows.map((row) => [`${row.lat10}|${row.lon10}`, row.days]));
}
