import type { Pool } from "pg";

import { config } from "../config";
import { withTx } from "../db";
import { addHours, GRID_KEY, hoursBetween } from "../haze/grid";
import type { LearnedInstrument } from "../haze/learned-frames";
import { HORIZON_HOURS, runModel, type RunInput, type RunStation } from "../haze/run";
import { childLogger } from "../lib/logger";
import { fires, forecasts, modelForecasts, readings, stations, weather } from "../repositories";
import type { RunKind } from "../repositories/forecasts.repo";
import { LEARNED_STALE_HOURS } from "../services/forecast-source";
import { listInstruments } from "../services/instruments";

/** One run of the model as of one hour: load what was known then, run, store. */

const log = childLogger({ module: "jobs.forecast" });

/** Smoke lives up to six days, so the run starts far enough back to hold everything still in the air. */
const LOOKBACK_DAYS = 8;

/**
 * What a run as of `asOf` is allowed to know: weather from the lookback on,
 * fires and readings up to `asOf`. The live run and the backtest both load
 * through here, so a backtest cannot see what a live run would not have.
 * Null where the stored weather does not reach `asOf`.
 */
export async function loadRunInput(pool: Pool, asOf: Date): Promise<RunInput | null> {
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

  // emissionsFor drops the days not yet complete at asOf, so loading later days here leaks nothing.
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
  return { asOf, start, weather: grid, fires: cells, stations: placed };
}

/**
 * The newest learned issue still fresh for a run as of `asOf`, at every
 * instrument it covers, or null where there is none that recent.
 */
async function loadLearned(pool: Pool, asOf: Date): Promise<Pick<RunInput, "instruments" | "learnedVersion"> | null> {
  const issue = await modelForecasts.latestIssue(pool, addHours(asOf, -LEARNED_STALE_HOURS));
  if (!issue) return null;
  const instruments: LearnedInstrument[] = (await listInstruments(pool)).flatMap((instrument) => {
    const days = issue.byInstrument.get(instrument.id);
    return days ? [{ id: instrument.id, lat: instrument.lat, lon: instrument.lon, days }] : [];
  });
  return { instruments, learnedVersion: issue.modelVersion };
}

/**
 * Returns the new run's id, or null where the run already exists or cannot be
 * made yet. Only the live run in live mode is corrected to the learned
 * forecast: a backfilled run would otherwise see an issue newer than its own
 * hour, and in shadow or off the map stays the hourly forecast's.
 */
export async function runForecast(pool: Pool, asOf: Date, kind: RunKind): Promise<number | null> {
  if (await forecasts.exists(pool, asOf, kind)) return null;
  const input = await loadRunInput(pool, asOf);
  if (!input) return null;
  const learned = kind === "live" && config.MODEL_MODE === "live" ? await loadLearned(pool, asOf) : null;

  const started = Date.now();
  const output = runModel({ ...input, ...learned });
  const runId = await withTx(pool, async (tx) => {
    const id = await forecasts.insertRun(tx, asOf, kind, output.calibration, GRID_KEY, output.learnedVersion);
    await forecasts.insertFrames(tx, id, output.frames);
    await forecasts.insertStationForecasts(tx, id, output.forecasts);
    return id;
  });
  log.info(
    { runId, kind, asOf: asOf.toISOString(), ms: Date.now() - started, frames: output.frames.length, stations: output.forecasts.length, fit: output.calibration.rankCorrelation, learned: output.learnedVersion },
    "forecast run stored",
  );
  return runId;
}
