import { addHours } from "./grid";
import { localDay, type ModelDay } from "./outlook";

/**
 * The blend: a day's forecast past today is the equal-weight average, in
 * ug/m3, of the learned model's median and the simulation's own forecast of
 * the day's peak. The band keeps the model's width and moves with the centre,
 * so the chances come from a band around what is actually shown.
 */

export const BLEND_WEIGHT = 0.5;

/** The model's row centred on the blend of its median with `simPeak`, the band shifted with it and floored at 0. */
export function blendDay(row: ModelDay, simPeak: number): ModelDay {
  const centre = BLEND_WEIGHT * row.p50 + (1 - BLEND_WEIGHT) * simPeak;
  const shift = centre - row.p50;
  return { p10: Math.max(0, row.p10 + shift), p50: Math.max(0, centre), p90: Math.max(0, row.p90 + shift) };
}

/**
 * Every learned day blended with the peak of `series` (ug/m3 per hour from
 * asOf + 1) over that day's hours. A day the series does not reach keeps the
 * model's row: there is nothing to average it with.
 */
export function blendWithSeries(asOf: Date, series: number[], learned: ReadonlyMap<string, ModelDay>): Map<string, ModelDay> {
  const peaks = new Map<string, number>();
  series.forEach((value, index) => {
    const day = localDay(addHours(asOf, index + 1));
    const peak = peaks.get(day);
    if (peak === undefined || value > peak) peaks.set(day, value);
  });
  const blended = new Map<string, ModelDay>();
  for (const [day, row] of learned) {
    const peak = peaks.get(day);
    blended.set(day, peak === undefined ? row : blendDay(row, peak));
  }
  return blended;
}
