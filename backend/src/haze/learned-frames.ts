import { correctToPoints, type Target } from "./field";
import { addHours } from "./grid";
import { localDay, type ModelDay } from "./outlook";

/**
 * The map's future on the learned forecast.
 *
 * Past today, the learned model says how high each instrument's day goes and
 * the smoke simulation says when. Rule 2 of the design joins them: the day's
 * peak is the learned median, the hours follow the calibrated smoke's shape
 * at the instrument, and the dip goes no lower than the learned tenth
 * percentile. Every future frame on a later Malaysian day is then pulled to
 * those values at every instrument with a row, so a station dot, the panel
 * line and the field under it tell one story.
 */

export interface LearnedInstrument {
  id: string;
  lat: number;
  lon: number;
  /** Malaysian day to the learned band for it. */
  days: ReadonlyMap<string, ModelDay>;
}

/** Calibrated smoke PM2.5 at a place at one hour of the run. */
export type PhysicsAt = (lat: number, lon: number, hour: number) => number;

/** Rule 2 at one hour: the learned median less the simulation's distance below its own day peak, scaled to stop at p10. */
export function shaped(row: ModelDay, series: number[], at: number): number {
  const peak = Math.max(...series);
  const min = Math.min(...series);
  const r = peak > min ? Math.max(0, Math.min(1, (row.p50 - row.p10) / (peak - min))) : 0;
  return row.p50 - (peak - at) * r;
}

/** The hours of the Malaysian day `hour` falls on, as indices from `start`, kept within the run's 0 to `end`. */
function dayHours(start: Date, hour: number, end: number): number[] {
  const day = localDay(addHours(start, hour));
  let first = hour;
  while (first > 0 && localDay(addHours(start, first - 1)) === day) first -= 1;
  const hours: number[] = [];
  for (let at = first; at <= end && localDay(addHours(start, at)) === day; at++) hours.push(at);
  return hours;
}

/** What each instrument with a learned row for the Malaysian day of `hour` should read at that hour. */
export function learnedTargets(start: Date, hour: number, instruments: LearnedInstrument[], physicsAt: PhysicsAt, end = Infinity): Target[] {
  const day = localDay(addHours(start, hour));
  const hours = dayHours(start, hour, end);
  const targets: Target[] = [];
  for (const instrument of instruments) {
    const row = instrument.days.get(day);
    if (!row) continue;
    const series = hours.map((at) => physicsAt(instrument.lat, instrument.lon, at));
    targets.push({ lat: instrument.lat, lon: instrument.lon, pm25: shaped(row, series, physicsAt(instrument.lat, instrument.lon, hour)) });
  }
  return targets;
}

export interface LearnedRun {
  start: Date;
  asOf: Date;
  /** The run's last hour, as an index from `start`. */
  end: number;
  instruments: LearnedInstrument[];
  physicsAt: PhysicsAt;
}

/**
 * Corrects a future frame to the learned forecast when its Malaysian day is
 * later than the run's own. Today's frames stay the hourly forecast's, as the
 * panel line does, because a day half over is best told by its readings.
 */
export function learnedCorrector(input: LearnedRun): (hour: number, pm25: Float32Array) => Float32Array {
  const today = localDay(input.asOf);
  return (hour, pm25) => {
    if (localDay(addHours(input.start, hour)) <= today) return pm25;
    return correctToPoints(pm25, learnedTargets(input.start, hour, input.instruments, input.physicsAt, input.end));
  };
}
