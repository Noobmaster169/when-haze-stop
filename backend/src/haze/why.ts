import { compass } from "./regions";

/**
 * The one-line reason under a learned day: what the smoke simulation says
 * about that day at that station. Pure.
 *
 * It names only what the simulation holds, the hour the smoke peaks and the
 * wind it comes on; it never names a fire or a place, which would be invented.
 */

/** Below this much variation in the day's calibrated smoke, the simulation has nothing to say about the day's shape. */
export const SMOKE_MATTERS_UGM3 = 5;

export const LITTLE_SMOKE = "Little simulated smoke reaches here; the forecast rests on the current level and trend.";

export interface WhyInput {
  /** Calibrated smoke PM2.5 for the day's hours, ug/m3. */
  physicsDay: number[];
  /** Malaysian clock hour, 0 to 23, at which the day's smoke peaks. */
  hourOfPeak: number;
  /** Where the wind at the station blows from at that hour, degrees clockwise from north; null when no wind is stored. */
  windFromDeg: number | null;
}

export function whyFor(input: WhyInput): string {
  const { physicsDay, hourOfPeak, windFromDeg } = input;
  const swing = physicsDay.length === 0 ? 0 : Math.max(...physicsDay) - Math.min(...physicsDay);
  if (swing < SMOKE_MATTERS_UGM3) return LITTLE_SMOKE;
  const hour = `${String(hourOfPeak).padStart(2, "0")}:00`;
  const wind = windFromDeg === null ? "" : ` on a ${compass(windFromDeg)} wind`;
  return `Simulated smoke peaks around ${hour}${wind}.`;
}
