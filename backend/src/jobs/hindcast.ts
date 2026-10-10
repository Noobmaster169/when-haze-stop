import type { Pool } from "pg";

import { ensembleMean } from "../haze/ensemble";
import { emissionsFor } from "../haze/fires";
import { addHours, cellsWithin, hoursBetween, WEATHER_POINTS } from "../haze/grid";
import { MODEL_VERSION } from "../haze/run";
import { REACH_KM, smokeFrom } from "../haze/smoke";
import type { Weather } from "../haze/transport";
import { TerminalError } from "../lib/errors";
import { childLogger } from "../lib/logger";
import { smokeHindcasts } from "../repositories";
import type { SmokeHindcast } from "../repositories/smoke-hindcasts.repo";
import { type Instrument, listInstruments } from "../services/instruments";
import { loadRunInput } from "./forecast";

/**
 * The transport model replayed at the start of each stored day, so the learned
 * model can read what the physics would have said then. What is stored is the
 * ensemble-mean smoke within 50 km as a trailing day mean, in the model's own
 * units and before calibration: the history mostly has no readings to calibrate
 * on, and the learned model fits its own gain.
 *
 * Inputs come through `loadRunInput`, the same door as the live run and the
 * backtest, so a day sees only the fire days complete at its issue time. The
 * wind is the stored analysis, which the `model` name says.
 */

const log = childLogger({ module: "jobs.hindcast" });

export const HINDCAST_MODEL = `${MODEL_VERSION}-analysis`;
/** The learned model's second target is the day after tomorrow, so the smoke two days on is the last number it needs. */
export const AHEAD_HOURS = 48;
/** Smoke released before the run started is missing, so a run with less wind behind it than this says little. */
export const SPIN_UP_HOURS = 72;

export type DaySkip = "no-wind" | "short-spin-up" | "short-ahead";

/** The first `hours` of a weather grid, so the ensemble is not run past what is read. */
function clipped(weather: Weather, hours: number): Weather {
  const points = hours * WEATHER_POINTS;
  return { hours, u: weather.u.subarray(0, points), v: weather.v.subarray(0, points), rain: weather.rain.subarray(0, points) };
}

export async function hindcastDay(pool: Pool, asOf: Date, instruments: Instrument[]): Promise<{ rows: SmokeHindcast[]; outside: number } | DaySkip> {
  const input = await loadRunInput(pool, asOf);
  // A run that starts after the issue time has no wind behind the day at all, not a short one.
  if (!input || input.start > asOf) return "no-wind";
  const now = hoursBetween(input.start, asOf);
  if (now < SPIN_UP_HOURS) return "short-spin-up";
  const hours = now + AHEAD_HOURS + 1;
  if (input.weather.hours < hours) return "short-ahead";

  const weather = clipped(input.weather, hours);
  const smoke = smokeFrom(ensembleMean(emissionsFor(input.fires, input.start, asOf, hours), weather), hours);
  const rows: SmokeHindcast[] = [];
  let outside = 0;
  for (const instrument of instruments) {
    const cells = cellsWithin(instrument.lat, instrument.lon, REACH_KM);
    if (cells.length === 0) {
      outside += 1;
      continue;
    }
    rows.push({
      asOf,
      instrumentId: instrument.id,
      smokeNow: smoke.near(cells, now),
      smoke24h: smoke.near(cells, now + 24),
      smoke48h: smoke.near(cells, now + AHEAD_HOURS),
      model: HINDCAST_MODEL,
    });
  }
  if (outside > 0) log.debug({ asOf: asOf.toISOString(), outside }, "instruments outside the region got no smoke");
  return { rows, outside };
}

export interface HindcastOptions {
  /** First and last UTC day, inclusive, as YYYY-MM-DD. */
  from: string;
  to: string;
  /** For tests. A run without it lists the instruments from the database. */
  instruments?: Instrument[];
}

export interface HindcastSummary {
  days: number;
  stored: number;
  rows: number;
  skipped: number;
  short: number;
  ms: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function issueTime(day: string, name: string): Date {
  if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) throw new TerminalError(`${name} must be a UTC day as YYYY-MM-DD, not "${day}"`);
  return new Date(`${day}T00:00:00Z`);
}

export async function runHindcast(pool: Pool, options: HindcastOptions): Promise<HindcastSummary> {
  const from = issueTime(options.from, "from");
  const to = issueTime(options.to, "to");
  if (from > to) throw new TerminalError(`from (${options.from}) is after to (${options.to})`);

  const started = Date.now();
  const instruments = options.instruments ?? (await listInstruments(pool));
  const done = await smokeHindcasts.storedDays(pool, HINDCAST_MODEL);
  const summary: HindcastSummary = { days: 0, stored: 0, rows: 0, skipped: 0, short: 0, ms: 0 };
  for (let asOf = from; asOf <= to; asOf = addHours(asOf, 24)) {
    summary.days += 1;
    if (done.has(asOf.toISOString())) {
      summary.skipped += 1;
      continue;
    }
    const dayStarted = Date.now();
    const result = await hindcastDay(pool, asOf, instruments);
    if (typeof result === "string") {
      summary.short += 1;
      log.info({ asOf: asOf.toISOString(), why: result }, "day skipped");
      continue;
    }
    await smokeHindcasts.insertMany(pool, result.rows);
    summary.stored += 1;
    summary.rows += result.rows.length;
    log.info({ asOf: asOf.toISOString(), rows: result.rows.length, outside: result.outside, ms: Date.now() - dayStarted }, "day stored");
  }
  summary.ms = Date.now() - started;
  return summary;
}

export function formatHindcast(summary: HindcastSummary): string {
  return `hindcast: ${summary.days} days, ${summary.stored} stored (${summary.rows} rows), ${summary.skipped} already stored, ${summary.short} without enough wind, ${Math.round(summary.ms / 1000)} s`;
}
