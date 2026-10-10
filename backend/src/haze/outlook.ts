import type { DayOutlook } from "../contracts";
import { apiToPm25, pm25ToApi } from "./api-index";
import { type Band, chanceAbove, chanceAboveBand, type Quantiles } from "./chance";
import { addHours } from "./grid";
import { LINES } from "./guidelines";

/**
 * A station's next few days against the official lines.
 *
 * Days are Malaysian calendar days, because that is how a school or an event
 * is planned. A day's number is its peak, since every rule is about passing a
 * line.
 */

const MALAYSIA_OFFSET_HOURS = 8;
export const OUTLOOK_DAYS = 4;

/** The Malaysian calendar day an instant falls on, `YYYY-MM-DD`. */
export function localDay(at: Date): string {
  return addHours(at, MALAYSIA_OFFSET_HOURS).toISOString().slice(0, 10);
}

export interface Hourly {
  at: Date;
  api: number;
}

/** A learned forecast of a day's peak 24 h PM2.5, ug/m3: its 10th, 50th and 90th percentile. */
export interface ModelDay {
  p10: number;
  p50: number;
  p90: number;
}

/** Errors for a forecast this many hours ahead at a station that is or is not already hazy. */
export type ErrorsFor = (leadHours: number, hazy: boolean) => Quantiles;

/** What a day's forecast says, whichever forecast it came from. */
interface Expected {
  peak: number;
  low: number;
  high: number;
  chanceAbove: (line: number) => number;
}

function peak(values: Hourly[]): number | null {
  return values.length === 0 ? null : Math.max(...values.map((value) => value.api));
}

function fromHourly(forecastPeak: number, errors: Quantiles): Expected {
  return { peak: forecastPeak, low: Math.max(0, forecastPeak + errors[0]), high: forecastPeak + errors[4], chanceAbove: (line) => chanceAbove(forecastPeak, line, errors) };
}

function fromLearned(day: ModelDay): Expected {
  // The chance is read in ug/m3, where the model's quantiles live, because the index bands are very unequal in width; only the displayed numbers are converted.
  const band: Band = [day.p10, day.p50, day.p90];
  return { peak: pm25ToApi(day.p50), low: Math.max(0, pm25ToApi(day.p10)), high: pm25ToApi(day.p90), chanceAbove: (line) => chanceAboveBand(apiToPm25(line), band) };
}

/**
 * `modelDays` is the learned model's forecast by Malaysian day, used for the
 * days after today where it has one. Today stays with the readings and the
 * hourly forecast: a day half over is best described by what it has read.
 */
export function dayOutlooks(asOf: Date, readings: Hourly[], forecast: Hourly[], errorsFor: ErrorsFor, modelDays: ReadonlyMap<string, ModelDay> = new Map()): DayOutlook[] {
  const latest = readings.at(-1)?.api ?? null;
  const hazy = latest !== null && latest > 100;
  const days: DayOutlook[] = [];

  for (let offset = 0; offset < OUTLOOK_DAYS; offset++) {
    const day = localDay(addHours(asOf, 24 * offset));
    const observedPeak = peak(readings.filter((reading) => localDay(reading.at) === day));
    const forecastPeak = peak(forecast.filter((value) => localDay(value.at) === day));
    const learned = offset > 0 ? (modelDays.get(day) ?? null) : null;
    // Today is scored as a one-day forecast: what is left of it is at most that far ahead.
    const expected = learned ? fromLearned(learned) : forecastPeak === null ? null : fromHourly(forecastPeak, errorsFor(Math.max(24, 24 * offset), hazy));

    const chance: Record<string, number> = {};
    for (const line of LINES) {
      if (observedPeak !== null && observedPeak > line) chance[line] = 1;
      else if (expected) chance[line] = expected.chanceAbove(line);
      else chance[line] = 0;
    }
    days.push({
      day,
      observedPeak,
      forecastPeak: expected ? Math.round(expected.peak) : null,
      low: expected ? Math.round(expected.low) : null,
      high: expected ? Math.round(expected.high) : null,
      chance,
      source: learned ? "learned" : "hourly",
      why: null,
    });
  }
  return days;
}
