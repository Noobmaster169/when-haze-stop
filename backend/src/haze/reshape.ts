import { addHours } from "./grid";
import { localDay, type ModelDay } from "./outlook";

/**
 * The hourly line bent to the learned model's day peaks, rules 1 to 4 of the
 * one-forecast design. Pure, in ug/m3.
 *
 * The learned model knows how much; the smoke simulation knows when. So on a
 * day the model has a row for, the line's maximum is the model's median and
 * the hours inside the day follow the simulation's timing, scaled so the dip
 * never passes the model's 10th percentile. Today stays the hourly forecast,
 * which is proven at the next twelve hours.
 */

export interface ReshapeInput {
  asOf: Date;
  /** PM2.5 per hour from asOf + 1, the hourly forecast converted with apiToPm25. */
  hourly: number[];
  /** Calibrated smoke PM2.5 per hour, same indices, or null for a run before migration 009. */
  physics: number[] | null;
  learned: ReadonlyMap<string, ModelDay>;
}

/** The line moves from one source's level to the next over at most this many hours. */
export const RAMP_HOURS = 3;

interface DaySlice {
  day: string;
  first: number;
  last: number;
}

/** The index ranges of `hours` hourly values from asOf + 1, one per Malaysian day, in order. */
function daySlices(asOf: Date, hours: number): DaySlice[] {
  const slices: DaySlice[] = [];
  for (let index = 0; index < hours; index++) {
    const day = localDay(addHours(asOf, index + 1));
    const current = slices.at(-1);
    if (current && current.day === day) current.last = index;
    else slices.push({ day, first: index, last: index });
  }
  return slices;
}

function argmax(values: number[]): number {
  let best = 0;
  for (let index = 1; index < values.length; index++) if (values[index] > values[best]) best = index;
  return best;
}

/** Rule 2: the day's hours at the simulation's timing, peaking at p50 and dipping no lower than p10. Returns the peak's index. */
function shapeDay(out: number[], slice: DaySlice, physics: number[] | null, row: ModelDay): number {
  const smoke: number[] = [];
  for (let index = slice.first; index <= slice.last; index++) smoke.push(physics?.[index] ?? 0);
  const peak = Math.max(...smoke);
  const low = Math.min(...smoke);
  const ratio = peak > low ? Math.min(1, Math.max(0, (row.p50 - row.p10) / (peak - low))) : 0;
  smoke.forEach((value, offset) => {
    out[slice.first + offset] = row.p50 - (peak - value) * ratio;
  });
  return slice.first + argmax(smoke);
}

/**
 * Rule 3: a linear run from the hour before the day to the shaped value, over
 * the first RAMP_HOURS, ending early at the day's peak hour so the peak is
 * never moved. On a learned day the ramp starts no higher than the median,
 * because rule 1 says the median is the day's maximum even when today ends
 * above it.
 */
function ramp(out: number[], slice: DaySlice, peakAt: number, cap: number | null): void {
  if (slice.first === 0) return;
  const hours = Math.min(RAMP_HOURS, peakAt - slice.first, out.length - 1 - slice.first);
  if (hours <= 0) return;
  const from = cap === null ? out[slice.first - 1] : Math.min(out[slice.first - 1], cap);
  const to = out[slice.first + hours];
  for (let offset = 0; offset < hours; offset++) out[slice.first + offset] = from + ((to - from) * (offset + 1)) / (hours + 1);
}

/** The hourly series with every learned day after today bent to the model's peak. An empty `learned` map returns `hourly` as it was. */
export function reshapeToLearned(input: ReshapeInput): number[] {
  const { asOf, hourly, physics, learned } = input;
  const out = [...hourly];
  if (learned.size === 0) return out;
  const today = localDay(asOf);
  let previousLearned = false;
  for (const slice of daySlices(asOf, hourly.length)) {
    if (slice.day === today) continue;
    const row = learned.get(slice.day) ?? null;
    const peakAt = row ? shapeDay(out, slice, physics, row) : slice.first + argmax(hourly.slice(slice.first, slice.last + 1));
    if ((row !== null) !== previousLearned) ramp(out, slice, peakAt, row?.p50 ?? null);
    previousLearned = row !== null;
  }
  return out;
}
