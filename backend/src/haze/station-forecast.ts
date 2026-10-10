import { apiToPm25, pm25ToApi } from "./api-index";

/**
 * A station's next hours, worked out in PM2.5 and read back as API.
 *
 * DOE's index is the 24 hour running mean of hourly PM2.5, so over one hour it
 * moves by (this hour - the same hour yesterday) / 24. Its recent slope says
 * how much dirtier today's air is than yesterday's at the same time of day,
 * and the hours that have yet to roll out of the window will mostly carry that
 * same difference. So the forecast is the reading plus that slope, carried on
 * and fading.
 *
 * The smoke model's change is not added. Backtested with the wind as it was
 * forecast at the time, adding any share of it made forecasts beyond a day
 * worse than "no change". Readings alone, over every hour of 3 to 10 October
 * 2026: 16 to 30% better than "no change" from 1 to 12 hours ahead, level with
 * it from 24 to 72. See `docs/FORECAST.md`.
 */

/** The slope is read over this many hours: long enough to steady a whole-number index, short enough to be recent. */
export const SLOPE_HOURS = 3;
/** The day-over-day difference fades by this an hour, an e-folding of about nine and a half hours. */
export const FADE = 0.9;

export interface StationForecastInput {
  /** Readings by hour of the run, NaN where there is none. */
  readings: ArrayLike<number>;
  /** The hour of the reading the forecast starts from: `now`, or a little before it if the station is late. */
  anchorHour: number;
  /** The run's own hour. The first value returned is for `now` + 1. */
  now: number;
  /** The last hour to forecast. */
  end: number;
}

/** The slope of the 24 hour mean in ug/m3 an hour, ending at `hour`, or zero where a reading is missing. */
export function windowSlope(readings: ArrayLike<number>, hour: number): number {
  const from = hour - SLOPE_HOURS;
  if (from < 0 || Number.isNaN(readings[hour]) || Number.isNaN(readings[from])) return 0;
  return (apiToPm25(readings[hour]) - apiToPm25(readings[from])) / SLOPE_HOURS;
}

/** The sum of FADE^j for j = 1..lead: how many hours of slope have built up `lead` hours on. */
export function carried(lead: number): number {
  return (FADE * (1 - FADE ** lead)) / (1 - FADE);
}

/** Hourly API from `now` + 1 to `end`. */
export function forecastStation(input: StationForecastInput): Float32Array {
  const { readings, anchorHour, now, end } = input;
  const start = apiToPm25(readings[anchorHour]);
  const slope = windowSlope(readings, anchorHour);
  const api = new Float32Array(end - now);
  for (let hour = now + 1; hour <= end; hour++) api[hour - now - 1] = pm25ToApi(Math.max(0, start + slope * carried(hour - anchorHour)));
  return api;
}
