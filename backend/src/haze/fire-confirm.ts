import type { Detection } from "./fires";

/**
 * Keeps the fires the satellites agree on and drops the single faint pixels.
 *
 * Three satellites pass a place about six times a day. A real fire of any size
 * is seen by more than one of those passes, or burns hard enough in one that
 * there is no doubt. What is left over is one weak pixel in an 11 km cell,
 * seen once and never again: a hot roof, a reflection, a burn-off too small
 * and short to make haze.
 *
 * Measured on the week to 10 October 2026: those were 31% of all cell-days and
 * 1.3% of the fire power. Dropping them costs the model almost nothing and
 * takes a third of the dots off the map.
 */

/** A cell-day seen in at least this many satellite passes is a fire, however weak. */
export const CONFIRMING_PASSES = 2;
/** A cell-day seen in one pass is still a fire at this much power, megawatts. */
export const STRONG_MW = 10;

function cellDayOf(hit: Detection): string {
  return `${hit.day}|${Math.floor(hit.lat * 10)}|${Math.floor(hit.lon * 10)}`;
}

export function confirmedFires(detections: Detection[]): { confirmed: Detection[]; unconfirmed: number } {
  const seen = new Map<string, { passes: Set<string>; frpMw: number }>();
  for (const hit of detections) {
    const key = cellDayOf(hit);
    const cell = seen.get(key) ?? { passes: new Set<string>(), frpMw: 0 };
    cell.passes.add(`${hit.satellite}|${hit.hour}`);
    cell.frpMw += hit.frpMw;
    seen.set(key, cell);
  }
  const confirmed = detections.filter((hit) => {
    const cell = seen.get(cellDayOf(hit));
    return cell !== undefined && (cell.passes.size >= CONFIRMING_PASSES || cell.frpMw >= STRONG_MW);
  });
  return { confirmed, unconfirmed: detections.length - confirmed.length };
}
