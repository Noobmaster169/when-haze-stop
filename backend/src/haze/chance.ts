/**
 * How likely a forecast is to pass a line, from how wrong forecasts have been.
 *
 * An error distribution is five quantiles of (reading minus forecast). The
 * chance of passing a line is the share of that distribution that would lift
 * the forecast over it.
 */

/** The 10th, 25th, 50th, 75th and 90th percentile of past errors, in API points. */
export type Quantiles = [number, number, number, number, number];

const LEVELS = [0.1, 0.25, 0.5, 0.75, 0.9];

/**
 * The errors of the first hindcast, 6 to 10 October 2026, by lead and by
 * whether the station was already above 100. They stand in until the scores
 * table has enough cases of its own for a lead.
 */
const FIRST_HINDCAST: Record<24 | 48 | 72, { all: Quantiles; hazy: Quantiles }> = {
  24: { all: [-12.8, -4.6, 4.2, 15.2, 28.5], hazy: [-21.9, -6.7, 3.5, 13.8, 24.1] },
  48: { all: [-11.8, -2.5, 6.7, 23, 48.2], hazy: [-36.7, -2.5, 7, 18.7, 29.8] },
  72: { all: [-15.1, -0.2, 13.1, 36, 75.6], hazy: [-45.2, -1.3, 12.8, 23.7, 36.6] },
};

export function leadBucket(leadHours: number): 24 | 48 | 72 {
  return leadHours <= 36 ? 24 : leadHours <= 60 ? 48 : 72;
}

export function firstHindcast(leadHours: number, hazy: boolean): Quantiles {
  const bucket = FIRST_HINDCAST[leadBucket(leadHours)];
  return hazy ? bucket.hazy : bucket.all;
}

/** The share of the distribution at or below `error`, straight lines between the quantiles and beyond them. */
function share(error: number, quantiles: Quantiles): number {
  let k = 0;
  while (k < quantiles.length - 2 && error > quantiles[k + 1]) k++;
  const span = quantiles[k + 1] - quantiles[k];
  if (span <= 0) return error >= quantiles[k] ? LEVELS[k + 1] : LEVELS[k];
  return LEVELS[k] + ((error - quantiles[k]) / span) * (LEVELS[k + 1] - LEVELS[k]);
}

/** Never 0 or 1: five quantiles cannot rule anything out. */
export function chanceAbove(forecast: number, line: number, quantiles: Quantiles): number {
  const chance = 1 - share(line - forecast, quantiles);
  return Math.round(Math.min(0.99, Math.max(0.01, chance)) * 100) / 100;
}
