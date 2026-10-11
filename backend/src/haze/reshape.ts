import { addHours } from "./grid";
import { localDay, type ModelDay } from "./outlook";

/**
 * The hourly line joined to the blended days, the smoothing of section 3.1
 * of the one-forecast design. Pure, in ug/m3.
 *
 * The hourly forecast owns its first twelve hours, where it is proven. Each
 * blended day peaks at its median, at the simulation's hour when the smoke
 * varies over the day and at 09:00 Malaysian time otherwise, and follows the
 * simulation's shape after the peak. Between the proven hours and the first
 * peak, and between each day's last hour and the next peak, the line runs
 * straight: a 24 hour mean cannot step, so the line never does.
 */

export interface ReshapeInput {
  asOf: Date;
  /** PM2.5 per hour from asOf + 1, the hourly forecast converted with apiToPm25. */
  hourly: number[];
  /** Calibrated smoke PM2.5 per hour, same indices, or null for a run before migration 009. */
  physics: number[] | null;
  /** The blended band of each Malaysian day after today, by day. */
  learned: ReadonlyMap<string, ModelDay>;
}

/** The hourly forecast is clearly better than no change this far ahead, so these hours are its own. */
export const PROVEN_HOURS = 12;
/** 09:00 Malaysian time, when a 24 hour mean typically peaks after an overnight build-up. */
export const DEFAULT_PEAK_HOUR_UTC = 1;
/** Below this much variation over a day the simulation has no timing to offer. */
export const SMOKE_VARIES_UGM3 = 1;

export interface DaySlice {
  day: string;
  first: number;
  last: number;
  /** The UTC hour of the day at index `first`. */
  firstUtcHour: number;
}

/** The index ranges of `hours` hourly values from asOf + 1, one per Malaysian day, in order. */
export function daySlices(asOf: Date, hours: number): DaySlice[] {
  const slices: DaySlice[] = [];
  for (let index = 0; index < hours; index++) {
    const at = addHours(asOf, index + 1);
    const day = localDay(at);
    const current = slices.at(-1);
    if (current && current.day === day) current.last = index;
    else slices.push({ day, first: index, last: index, firstUtcHour: at.getUTCHours() });
  }
  return slices;
}

function argmax(values: number[]): number {
  let best = 0;
  for (let index = 1; index < values.length; index++) if (values[index] > values[best]) best = index;
  return best;
}

function varies(dayPhysics: number[]): boolean {
  return Math.max(...dayPhysics) - Math.min(...dayPhysics) >= SMOKE_VARIES_UGM3;
}

/** The series index of the day's peak: the simulation's hour when its smoke varies, else 09:00 Malaysian time, else the day's first hour. */
export function peakHourOf(dayPhysics: number[], slice: DaySlice): number {
  if (varies(dayPhysics)) return slice.first + argmax(dayPhysics);
  const nine = slice.first + ((DEFAULT_PEAK_HOUR_UTC - slice.firstUtcHour + 24) % 24);
  return nine <= slice.last ? nine : slice.first;
}

/** Rule 2 over the day: the median less the simulation's distance below its own peak, scaled to stop at p10; flat at the median when the smoke does not vary. */
function shapeDay(out: number[], slice: DaySlice, dayPhysics: number[], row: ModelDay): void {
  const peak = Math.max(...dayPhysics);
  const low = Math.min(...dayPhysics);
  const ratio = varies(dayPhysics) ? Math.min(1, Math.max(0, (row.p50 - row.p10) / (peak - low))) : 0;
  dayPhysics.forEach((value, offset) => {
    out[slice.first + offset] = row.p50 - (peak - value) * ratio;
  });
}

/** Fills the indices strictly between `from` and `to` on the straight line between their values. */
function straight(out: number[], from: number, fromValue: number, to: number): void {
  for (let index = from + 1; index < to; index++) out[index] = fromValue + ((out[to] - fromValue) * (index - from)) / (to - from);
}

/**
 * The hourly series smoothed onto the blended days. An empty `learned` map
 * returns `hourly` as it was. A day after today with no row keeps its hourly
 * values; whether to show them is the caller's call.
 */
export function reshapeToLearned(input: ReshapeInput): number[] {
  const { asOf, hourly, physics, learned } = input;
  const out = [...hourly];
  if (learned.size === 0 || hourly.length === 0) return out;
  const today = localDay(asOf);
  const slices = daySlices(asOf, hourly.length);
  const todaySlice = slices.find((slice) => slice.day === today);
  // Where the proven hours end: the twelfth, or today's last when today is shorter, or before the series when today is over.
  let from = Math.min(PROVEN_HOURS - 1, todaySlice?.last ?? -1, hourly.length - 1);
  let fromValue = from >= 0 ? out[from] : hourly[0];
  for (const slice of slices) {
    if (slice.day <= today) continue;
    const row = learned.get(slice.day);
    if (!row) {
      from = slice.last;
      fromValue = out[from];
      continue;
    }
    const dayPhysics = Array.from({ length: slice.last - slice.first + 1 }, (_, offset) => physics?.[slice.first + offset] ?? 0);
    shapeDay(out, slice, dayPhysics, row);
    const peakAt = peakHourOf(dayPhysics, slice);
    straight(out, from, fromValue, peakAt);
    // The straight run may come down from a higher day; the median is this day's maximum.
    for (let index = slice.first; index < peakAt; index++) out[index] = Math.min(out[index], row.p50);
    from = slice.last;
    fromValue = out[from];
  }
  return out;
}
