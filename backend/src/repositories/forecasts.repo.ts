import type { RunSummary } from "../contracts";
import type { Queryable } from "../db";
import type { Calibration } from "../haze/calibrate";

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
  const { rowCount } = await db.query("select 1 from forecast_runs where as_of = $1 and kind = $2", [asOf, kind]);
  return (rowCount ?? 0) > 0;
}

export async function insertRun(db: Queryable, asOf: Date, kind: RunKind, calibration: Calibration): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    "insert into forecast_runs (as_of, kind, intercept, slope, fit) values ($1, $2, $3, $4, $5) returning id",
    [asOf, kind, calibration.intercept, calibration.slope, JSON.stringify({ rankCorrelation: calibration.rankCorrelation, pairs: calibration.pairs, fallback: calibration.fallback })],
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

export async function insertStationForecasts(db: Queryable, runId: number, forecasts: { stationId: string; api: Float32Array }[]): Promise<void> {
  for (const forecast of forecasts) {
    await db.query("insert into station_forecasts (run_id, station_id, api) values ($1, $2, $3)", [runId, forecast.stationId, Array.from(forecast.api)]);
  }
}

/** The newest run by what it knew, which is the one the map and the assistant read. */
export async function latest(db: Queryable): Promise<RunSummary | null> {
  const { rows } = await db.query<RunRow>("select id, as_of, made_at, fit from forecast_runs order by as_of desc, id desc limit 1");
  return rows[0] ? toSummary(rows[0]) : null;
}

export interface StoredFrame {
  validAt: Date;
  field: Buffer;
}

/**
 * The map's timeline: for every hour in the window, the frame from the run
 * that knew the most. Hours before a run's `asOf` are therefore what was
 * observed, and hours after the newest run's are its forecast.
 */
export async function timeline(db: Queryable, from: Date, to: Date): Promise<StoredFrame[]> {
  const { rows } = await db.query<{ valid_at: Date; field: Buffer }>(
    `select distinct on (f.valid_at) f.valid_at, f.field
       from forecast_frames f join forecast_runs r on r.id = f.run_id
      where f.valid_at between $1 and $2
      order by f.valid_at, r.as_of desc, r.id desc`,
    [from, to],
  );
  return rows.map((row) => ({ validAt: row.valid_at, field: row.field }));
}

/** A station's hourly forecast from one run, starting an hour after the run's `asOf`. */
export async function stationForecast(db: Queryable, runId: number, stationId: string): Promise<number[] | null> {
  const { rows } = await db.query<{ api: number[] }>("select api from station_forecasts where run_id = $1 and station_id = $2", [runId, stationId]);
  return rows[0]?.api ?? null;
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
