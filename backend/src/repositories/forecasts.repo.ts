import type { RunSummary } from "../contracts";
import type { Queryable } from "../db";
import type { Calibration } from "../haze/calibrate";
import { GRID_KEY } from "../haze/grid";
import { MODEL_VERSION } from "../haze/run";

/** Runs of the model: the map frames and the station forecasts each one wrote. */

export type RunKind = "live" | "backfill";

interface RunRow {
  id: string;
  as_of: Date;
  made_at: Date;
  fit: { rankCorrelation: number | null; pairs: number };
}

function toSummary(row: RunRow): RunSummary {
  return { id: Number(row.id), asOf: row.as_of.toISOString(), madeAt: row.made_at.toISOString(), rankCorrelation: row.fit.rankCorrelation, pairs: row.fit.pairs };
}

export async function exists(db: Queryable, asOf: Date, kind: RunKind): Promise<boolean> {
  const { rowCount } = await db.query("select 1 from forecast_runs where as_of = $1 and kind = $2 and grid = $3 and model = $4", [asOf, kind, GRID_KEY, MODEL_VERSION]);
  return (rowCount ?? 0) > 0;
}

/** `learnedVersion` names the learned model whose forecast the run's future frames were corrected to, null when none was. */
export async function insertRun(db: Queryable, asOf: Date, kind: RunKind, calibration: Calibration, grid: string = GRID_KEY, learnedVersion: string | null = null): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    "insert into forecast_runs (as_of, kind, intercept, slope, fit, grid, model, learned_version) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id",
    [asOf, kind, calibration.intercept, calibration.slope, JSON.stringify({ rankCorrelation: calibration.rankCorrelation, pairs: calibration.pairs, fallback: calibration.fallback }), grid, MODEL_VERSION, learnedVersion],
  );
  return Number(rows[0].id);
}

export async function insertFrames(db: Queryable, runId: number, frames: { validAt: Date; field: Uint8Array }[]): Promise<void> {
  if (frames.length === 0) return;
  await db.query("insert into forecast_frames (run_id, valid_at, field) select $1, * from unnest($2::timestamptz[], $3::bytea[])", [
    runId,
    frames.map((frame) => frame.validAt),
    frames.map((frame) => Buffer.from(frame.field)),
  ]);
}

/** `physics` is the calibrated smoke at the station, PM2.5 per hour on the same indices as `api`; absent for a run that did not compute it. */
export async function insertStationForecasts(db: Queryable, runId: number, forecasts: { stationId: string; api: Float32Array; physics?: Float32Array }[]): Promise<void> {
  for (const forecast of forecasts) {
    await db.query("insert into station_forecasts (run_id, station_id, api, physics) values ($1, $2, $3, $4)", [
      runId,
      forecast.stationId,
      Array.from(forecast.api),
      forecast.physics ? Array.from(forecast.physics) : null,
    ]);
  }
}

/** The newest run on the current grid and method by what it knew, which is the one the map and the assistant read. */
export async function latest(db: Queryable): Promise<RunSummary | null> {
  const { rows } = await db.query<RunRow>("select id, as_of, made_at, fit from forecast_runs where grid = $1 and model = $2 order by as_of desc, id desc limit 1", [GRID_KEY, MODEL_VERSION]);
  return rows[0] ? toSummary(rows[0]) : null;
}

export interface StoredFrame {
  validAt: Date;
  field: Buffer;
}

/**
 * The map's timeline: for every hour in the window, the frame from the run
 * that knew the most. Hours before a run's `asOf` are therefore what was
 * observed, and hours after the newest run's are its forecast. Only runs on
 * the current grid and method: a frame on an older grid cannot be drawn on this
 * one, and an older method's frames would not join up with this one's.
 */
export async function timeline(db: Queryable, from: Date, to: Date): Promise<StoredFrame[]> {
  const { rows } = await db.query<{ valid_at: Date; field: Buffer }>(
    `select distinct on (f.valid_at) f.valid_at, f.field
       from forecast_frames f join forecast_runs r on r.id = f.run_id
      where f.valid_at between $1 and $2 and r.grid = $3 and r.model = $4
      order by f.valid_at, r.as_of desc, r.id desc`,
    [from, to, GRID_KEY, MODEL_VERSION],
  );
  return rows.map((row) => ({ validAt: row.valid_at, field: row.field }));
}

/** A station's hourly forecast from one run, starting an hour after the run's `asOf`. */
export async function stationForecast(db: Queryable, runId: number, stationId: string): Promise<number[] | null> {
  const { rows } = await db.query<{ api: number[] }>("select api from station_forecasts where run_id = $1 and station_id = $2", [runId, stationId]);
  return rows[0]?.api ?? null;
}

/** The calibrated smoke at a station from one run, PM2.5 per hour from an hour after `asOf`; null for a run made before it was stored. */
export async function stationPhysics(db: Queryable, runId: number, stationId: string): Promise<number[] | null> {
  const { rows } = await db.query<{ physics: number[] | null }>("select physics from station_forecasts where run_id = $1 and station_id = $2", [runId, stationId]);
  return rows[0]?.physics ?? null;
}

/** The learned model version a run's future frames were corrected to, null where none was. */
export async function learnedVersion(db: Queryable, runId: number): Promise<string | null> {
  const { rows } = await db.query<{ learned_version: string | null }>("select learned_version from forecast_runs where id = $1", [runId]);
  return rows[0]?.learned_version ?? null;
}

export async function stationForecasts(db: Queryable, runId: number): Promise<Map<string, number[]>> {
  const { rows } = await db.query<{ station_id: string; api: number[] }>("select station_id, api from station_forecasts where run_id = $1", [runId]);
  return new Map(rows.map((row) => [row.station_id, row.api]));
}

/** The first hour any run drew a field for, or null before the first run. */
export async function earliestFrameAt(db: Queryable): Promise<Date | null> {
  const { rows } = await db.query<{ at: Date | null }>("select min(valid_at) as at from forecast_frames");
  return rows[0]?.at ?? null;
}
