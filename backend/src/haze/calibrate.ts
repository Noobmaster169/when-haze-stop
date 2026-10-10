import { fitLine, spearman } from "./stats";

/**
 * From modelled smoke to an API reading.
 *
 * The model's unit is arbitrary, so each run fits `api = intercept + slope *
 * sqrt(smoke)` to the readings it was allowed to see. The square root is what
 * a week of DOE data fitted best; the intercept is the air on a clear day.
 */

export interface Calibration {
  intercept: number;
  slope: number;
  /** Station-hours the fit was made on. */
  pairs: number;
  rankCorrelation: number | null;
  /** True where there were too few readings to fit, and the last good fit stood in. */
  fallback: boolean;
}

export interface Pair {
  smoke: number;
  api: number;
}

/**
 * The fit from the first live run, 5 to 10 October 2026, over 8,184
 * station-hours. It stands in only until a run has enough readings of its own.
 */
const FIRST_FIT = { intercept: 64.0, slope: 6.79 };
const ENOUGH_PAIRS = 300;

export function calibrate(pairs: Pair[]): Calibration {
  const root = pairs.map((pair) => Math.sqrt(pair.smoke));
  const api = pairs.map((pair) => pair.api);
  const rankCorrelation = spearman(root, api);
  const line = pairs.length >= ENOUGH_PAIRS ? fitLine(root, api) : null;
  // A slope that is not positive says more smoke means cleaner air, which is a fit to noise.
  if (!line || line.slope <= 0) return { ...FIRST_FIT, pairs: pairs.length, rankCorrelation, fallback: true };
  return { ...line, pairs: pairs.length, rankCorrelation, fallback: false };
}

export function toApi(calibration: Pick<Calibration, "intercept" | "slope">, smoke: number): number {
  return calibration.intercept + calibration.slope * Math.sqrt(Math.max(0, smoke));
}
