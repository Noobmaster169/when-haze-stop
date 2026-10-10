import type { Weather } from "../haze/transport";

/**
 * Wind for past the end of the forecast.
 *
 * Kalimantan smoke takes two to three days to reach KL and suppression takes
 * days to bite, while the forecast reaches about three and a half days. Over
 * the forecast alone the most any plan could remove is under 1 ug/m3; over 14
 * days it is 3 to 21 (docs/council/01b-spike-plans.md). So after the forecast
 * the wind is a replay of a past window of stored analysis: an analogue, one
 * per wind member, labelled as such wherever it is shown. Nothing here changes
 * the engine; it only hands it a longer `Weather`.
 */

export const ANALOGUE_DAYS = 10;

/** The forecast, then `analogue` repeated until `hours`. Both share the weather grid's point layout. */
export function extendWeather(forecast: Weather, analogue: Weather, hours: number, points: number): Weather {
  const u = new Float32Array(hours * points);
  const v = new Float32Array(hours * points);
  const rain = new Float32Array(hours * points);
  const known = Math.min(forecast.hours, hours);
  u.set(forecast.u.subarray(0, known * points));
  v.set(forecast.v.subarray(0, known * points));
  rain.set(forecast.rain.subarray(0, known * points));
  for (let hour = known, k = 0; hour < hours; hour++, k = (k + 1) % analogue.hours) {
    const from = k * points;
    u.set(analogue.u.subarray(from, from + points), hour * points);
    v.set(analogue.v.subarray(from, from + points), hour * points);
    rain.set(analogue.rain.subarray(from, from + points), hour * points);
  }
  return { hours, u, v, rain };
}

/**
 * Where each analogue window starts: the most recent whole windows before the
 * data's hour, newest first. The newest is the likeliest to share the season's
 * pattern; the older ones are how the wind could turn.
 */
export function analogueStarts(asOf: Date, members: number): Date[] {
  return Array.from({ length: members }, (_, k) => new Date(asOf.getTime() - (k + 1) * ANALOGUE_DAYS * 86_400_000));
}
