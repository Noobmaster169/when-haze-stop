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
 * The errors of the station forecast (`station-forecast.ts`) replayed on the
 * readings of every hour from 3 to 10 October 2026, by lead and by whether the
 * station was already above 100: 9,792, 8,160 and 6,528 cases at 24, 48 and
 * 72 hours. `all` is the stations at or under 100; its long upper tail is the
 * 101 to 150 band, which a reading crosses in an hour or two. They stand in
 * until the scores table has enough cases of its own for a lead.
 */
const FIRST_HINDCAST: Record<24 | 48 | 72, { all: Quantiles; hazy: Quantiles }> = {
  24: { all: [-12, -4.3, 3.2, 15, 53.2], hazy: [-31.2, -10, -0.8, 6.8, 18.2] },
  48: { all: [-13, -4, 7, 41.9, 77], hazy: [-50.4, -9, 2, 13, 25] },
  72: { all: [-10, -1, 21, 75, 86], hazy: [-60.9, -13, 5, 17.8, 30] },
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

/** A forecast's own 10th, 50th and 90th percentile, in API points, lowest first. */
export type Band = [number, number, number];

const BAND_LEVELS = [0.1, 0.5, 0.9];

/** The share of the band at or below `value`: a straight line between its points and on past them, so a value outside it still moves the chance. */
function bandShare(value: number, band: Band): number {
  const k = value <= band[1] ? 0 : 1;
  const span = band[k + 1] - band[k];
  if (span <= 0) return value < band[k] ? BAND_LEVELS[k] : BAND_LEVELS[k + 1];
  return BAND_LEVELS[k] + ((value - band[k]) / span) * (BAND_LEVELS[k + 1] - BAND_LEVELS[k]);
}

/** The chance a forecast with this band passes `line`. Never 0 or 1: three quantiles cannot rule anything out. */
export function chanceAboveBand(line: number, band: Band): number {
  const chance = 1 - bandShare(line, band);
  return Math.round(Math.min(0.99, Math.max(0.01, chance)) * 100) / 100;
}
