import { fitLine, spearman } from "./stats";

/**
 * From modelled smoke to PM2.5.
 *
 * The model's unit is arbitrary, so each run fits `pm25 = intercept + slope *
 * smoke` to the readings it was allowed to see, each reading first turned back
 * into the 24 hour mean PM2.5 it stands for (`api-index.ts`). Smoke adds mass,
 * so the relation is a straight line in concentration; the intercept is the
 * air on a day with no fire smoke. The square root this replaced was standing
 * in for the bends in DOE's index.
 */

export interface Calibration {
  /** ug/m3 with no modelled smoke. */
  intercept: number;
  /** ug/m3 per unit of modelled smoke. */
  slope: number;
  /** Station-hours the fit was made on. */
  pairs: number;
  rankCorrelation: number | null;
  /** True where there were too few readings to fit, and the last good fit stood in. */
  fallback: boolean;
}

export interface Pair {
  smoke: number;
  /** The reading as 24 hour mean PM2.5. */
  pm25: number;
}

/**
 * The fit of the run as of 10 October 2026 06:00 UTC, over the 7,925
 * station-hours before it (rank correlation 0.83). It stands in only until a
 * run has enough readings of its own.
 */
export const FIRST_FIT = { intercept: 34.67, slope: 0.2945 };
const ENOUGH_PAIRS = 300;

export function calibrate(pairs: Pair[]): Calibration {
  const smoke = pairs.map((pair) => pair.smoke);
  const pm25 = pairs.map((pair) => pair.pm25);
  const rankCorrelation = spearman(smoke, pm25);
  const line = pairs.length >= ENOUGH_PAIRS ? fitLine(smoke, pm25) : null;
  // A slope that is not positive says more smoke means cleaner air, which is a fit to noise.
  if (!line || line.slope <= 0) return { ...FIRST_FIT, pairs: pairs.length, rankCorrelation, fallback: true };
  return { ...line, pairs: pairs.length, rankCorrelation, fallback: false };
}

export function toPm25(calibration: Pick<Calibration, "intercept" | "slope">, smoke: number): number {
  return calibration.intercept + calibration.slope * Math.max(0, smoke);
}
