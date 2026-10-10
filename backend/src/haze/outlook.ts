import type { DayOutlook } from "../contracts";
import { chanceAbove, type Quantiles } from "./chance";
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

/** Errors for a forecast this many hours ahead at a station that is or is not already hazy. */
export type ErrorsFor = (leadHours: number, hazy: boolean) => Quantiles;

function peak(values: Hourly[]): number | null {
  return values.length === 0 ? null : Math.max(...values.map((value) => value.api));
}

export function dayOutlooks(asOf: Date, readings: Hourly[], forecast: Hourly[], errorsFor: ErrorsFor): DayOutlook[] {
  const latest = readings.at(-1)?.api ?? null;
  const hazy = latest !== null && latest > 100;
  const days: DayOutlook[] = [];

  for (let offset = 0; offset < OUTLOOK_DAYS; offset++) {
    const day = localDay(addHours(asOf, 24 * offset));
    const observedPeak = peak(readings.filter((reading) => localDay(reading.at) === day));
    const forecastPeak = peak(forecast.filter((value) => localDay(value.at) === day));
    // Today is scored as a one-day forecast: what is left of it is at most that far ahead.
    const errors = errorsFor(Math.max(24, 24 * offset), hazy);

    const chance: Record<string, number> = {};
    for (const line of LINES) {
      if (observedPeak !== null && observedPeak > line) chance[line] = 1;
      else if (forecastPeak !== null) chance[line] = chanceAbove(forecastPeak, line, errors);
      else chance[line] = 0;
    }
    days.push({
      day,
      observedPeak,
      forecastPeak: forecastPeak === null ? null : Math.round(forecastPeak),
      low: forecastPeak === null ? null : Math.max(0, Math.round(forecastPeak + errors[0])),
      high: forecastPeak === null ? null : Math.round(forecastPeak + errors[4]),
      chance,
    });
  }
  return days;
}
