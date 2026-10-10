import type { Pool } from "pg";

import { withTx } from "../db";
import { addHours, hoursBetween } from "../haze/grid";
import { HORIZON_HOURS, runModel, type RunStation } from "../haze/run";
import { childLogger } from "../lib/logger";
import { fires, forecasts, readings, stations, weather } from "../repositories";
import type { RunKind } from "../repositories/forecasts.repo";

/** One run of the model as of one hour: load what was known then, run, store. */

const log = childLogger({ module: "jobs.forecast" });

/** Smoke lives up to six days, so the run starts far enough back to hold everything still in the air. */
const LOOKBACK_DAYS = 8;

/** Returns the new run's id, or null where the run already exists or cannot be made yet. */
export async function runForecast(pool: Pool, asOf: Date, kind: RunKind): Promise<number | null> {
  if (await forecasts.exists(pool, asOf, kind)) return null;

  const earliest = await weather.earliestAt(pool);
  if (!earliest) {
    log.warn("no weather stored yet, so there is nothing to carry the smoke");
    return null;
  }
  const wanted = addHours(asOf, -24 * LOOKBACK_DAYS);
  const start = wanted > earliest ? wanted : earliest;
  const grid = await weather.load(pool, start, addHours(asOf, HORIZON_HOURS));
  if (!grid || hoursBetween(start, asOf) >= grid.hours) {
    log.warn({ asOf: asOf.toISOString() }, "the stored weather does not reach this hour");
    return null;
  }

  const cells = await fires.since(pool, addHours(start, -24).toISOString().slice(0, 10));
  const known = await readings.between(pool, start, asOf);
  const series = new Map<string, Float32Array>();
  for (const reading of known) {
    let values = series.get(reading.stationId);
    if (!values) {
      values = new Float32Array(grid.hours).fill(NaN);
      series.set(reading.stationId, values);
    }
    values[hoursBetween(start, reading.observedAt)] = reading.api;
  }
  const placed: RunStation[] = (await stations.list(pool)).map((station) => ({
    id: station.id,
    lat: station.lat,
    lon: station.lon,
    readings: series.get(station.id) ?? new Float32Array(grid.hours).fill(NaN),
  }));

  const started = Date.now();
  const output = runModel({ asOf, start, weather: grid, fires: cells, stations: placed });
  const runId = await withTx(pool, async (tx) => {
    const id = await forecasts.insertRun(tx, asOf, kind, output.calibration);
    await forecasts.insertFrames(tx, id, output.frames);
    await forecasts.insertStationForecasts(tx, id, output.forecasts);
    return id;
  });
  log.info(
    { runId, kind, asOf: asOf.toISOString(), ms: Date.now() - started, frames: output.frames.length, stations: output.forecasts.length, fit: output.calibration.rankCorrelation },
    "forecast run stored",
  );
  return runId;
}
