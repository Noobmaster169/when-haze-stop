import type { StoredDay } from "@/lib/api/haze-schemas";

import { type BandKey, bandKey, pm25ToApi } from "./scale";

/**
 * How the History strip reads a stored day: one column of four marks, for the
 * four kinds of data a forecast is trained and checked on. Pure.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_HOURS = 24;

/** A square root, so a quiet day still shows as a bar beside a day twenty times its size. Nothing for a day with no fire. */
export function fireHeight(frpMw: number, largest: number): number {
  return frpMw <= 0 ? 0 : Math.max(8, Math.sqrt(frpMw / largest) * 100);
}

/** Whether the day's wind is all there, part there, or not stored. */
export function windState(day: StoredDay): "full" | "part" | "none" {
  if (day.windHours >= DAY_HOURS) return "full";
  return day.windHours > 0 ? "part" : "none";
}

/** The share of the reporting airports whose observer called it haze or smoke, or null when none reported. */
export function hazeShare(day: StoredDay): number | null {
  return day.airports > 0 ? day.hazeAirports / day.airports : null;
}

/** The band the day's median PM2.5 falls in, or null when nothing measured it. */
export function airBand(day: StoredDay): BandKey | null {
  return day.pm25 === null ? null : bandKey(pm25ToApi(day.pm25));
}

/** Where each month starts along the strip, named with its year where a year starts or the strip does. */
export function monthMarks(days: readonly StoredDay[]): { index: number; label: string }[] {
  const marks: { index: number; label: string }[] = [];
  days.forEach((entry, index) => {
    if (index > 0 && !entry.day.endsWith("-01")) return;
    const month = Number(entry.day.slice(5, 7));
    marks.push({ index, label: index === 0 || month === 1 ? `${MONTHS[month - 1]} ${entry.day.slice(0, 4)}` : MONTHS[month - 1] });
  });
  // A strip that starts late in a month would write that month's name over the next one's.
  return marks.length > 1 && marks[1].index - marks[0].index < 10 ? marks.slice(1) : marks;
}

const count = (value: number): string => value.toLocaleString("en-GB");

/** The day in three lines, one fact each, for under its name and for its tooltip. */
export function dayLines(day: StoredDay): string[] {
  const share = hazeShare(day);
  return [
    day.cells > 0 ? `${count(day.cells)} fire cells, ${count(day.frpMw)} MW` : "No fires stored",
    share === null ? "No airport reports" : `Haze at ${day.hazeAirports} of ${day.airports} airports`,
    day.pm25 === null ? "No PM2.5 measured" : `PM2.5 ${Math.round(day.pm25)} ug/m3 at ${count(day.monitors)} ${day.monitors === 1 ? "instrument" : "instruments"}`,
  ];
}
