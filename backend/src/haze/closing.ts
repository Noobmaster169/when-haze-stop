import type { DayOutlook } from "../contracts";
import { localDay } from "./outlook";

/**
 * What the forecast says about the lines that close schools, read the same way
 * by the alerts and by an area's card so the two never disagree.
 *
 * The lines are the Education Ministry's of 8 October 2026 (haze/guidelines.ts):
 * schools close where the index passes 180, from 9 October, and where it stays
 * above 150 three days in a row, from 12 October. A day counts as above 150 when
 * its peak hour is, which warns earlier than a daily average would.
 */

export const CLOSE_LINE = 180;
export const SUSTAINED_LINE = 150;
const SUSTAINED_FROM = "2026-10-12";
export const CLEAR_LINE = 100;
/** A forecast is acted on at this chance, so a wrong alert stays rare. */
export const LIKELY = 0.6;

export interface ClosingInput {
  /** The newest reading. */
  api: number | null;
  /** Today first. */
  days: DayOutlook[];
  /** The observed peak of yesterday, or null when it is not known. */
  yesterdayPeak: number | null;
}

export interface ClosingOutlook {
  /** Tomorrow's day and its chance of passing 180. */
  tomorrow: DayOutlook | null;
  passChance: number;
  /** Tomorrow's chance of being the third day in a row above 150, or 0 when yesterday and today are not both above. */
  thirdDayChance: number;
  /** The first later day likely back under 100, while the air is above it now. */
  clearingDay: DayOutlook | null;
}

function above(day: DayOutlook | undefined, line: number): boolean {
  if (!day) return false;
  if (day.observedPeak !== null && day.observedPeak > line) return true;
  return (day.chance[line] ?? 0) >= LIKELY;
}

export function closingOutlook({ api, days, yesterdayPeak }: ClosingInput): ClosingOutlook {
  const tomorrow = days[1] ?? null;
  const passChance = tomorrow?.chance[CLOSE_LINE] ?? 0;
  const counting = tomorrow !== null && tomorrow.day >= SUSTAINED_FROM && yesterdayPeak !== null && yesterdayPeak > SUSTAINED_LINE && above(days[0], SUSTAINED_LINE);
  const thirdDayChance = counting ? (tomorrow.chance[SUSTAINED_LINE] ?? 0) : 0;
  const clearingDay = api !== null && api > CLEAR_LINE ? (days.slice(1).find((day) => day.forecastPeak !== null && (day.chance[CLEAR_LINE] ?? 1) <= 1 - LIKELY) ?? null) : null;
  return { tomorrow, passChance, thirdDayChance, clearingDay };
}

export function weekday(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

export function percent(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

/** The highest reading on a Malaysian calendar day, or null when none was stored. */
export function dayPeak(readings: { at: string; api: number }[], day: string): number | null {
  const values = readings.filter((reading) => localDay(new Date(reading.at)) === day).map((reading) => reading.api);
  return values.length === 0 ? null : Math.max(...values);
}
