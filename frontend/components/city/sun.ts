/**
 * Where the sun stands over a place at a moment. Pure.
 *
 * The low-precision solar position of the Astronomical Almanac, good to about
 * a hundredth of a degree from 1950 to 2050, which is far finer than a scene
 * lit by it can show.
 */

export interface SunPosition {
  /** Degrees above the horizon; negative at night. */
  elevation: number;
  /** Degrees clockwise from north. */
  azimuth: number;
}

const RAD = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12);

export function sunPosition(at: number, lat: number, lon: number): SunPosition {
  const days = (at - J2000_MS) / 86_400_000;
  const anomaly = (357.529 + 0.98560028 * days) * RAD;
  const meanLongitude = 280.459 + 0.98564736 * days;
  const longitude = (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439 - 0.00000036 * days) * RAD;

  const ascension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
  const siderealHours = 18.697374558 + 24.06570982441908 * days;
  const hourAngle = (siderealHours * 15 + lon) * RAD - ascension;

  const latitude = lat * RAD;
  const elevation = Math.asin(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle));
  const azimuth = Math.atan2(-Math.sin(hourAngle), Math.tan(declination) * Math.cos(latitude) - Math.sin(latitude) * Math.cos(hourAngle));
  return { elevation: elevation / RAD, azimuth: ((azimuth / RAD) % 360 + 360) % 360 };
}
