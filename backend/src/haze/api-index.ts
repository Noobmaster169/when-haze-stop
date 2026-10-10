/**
 * DOE's Air Pollutant Index and the PM2.5 concentration behind it.
 *
 * In a haze episode the API DOE publishes each hour is the PM2.5 sub-index of
 * the 24 hour running mean concentration (APIMS: "API is calculated based on
 * 24hr running average of the most dominant parameter"). The sub-index is
 * linear inside each band, and the bands are very unequal: 101 to 150 spans
 * only 50.5 to 55.4 ug/m3, so a reading crosses it in an hour or two and 151
 * is the commonest value in a haze week.
 *
 * Smoke adds concentration, not index points, so the model works in ug/m3 and
 * converts at the edges.
 *
 * Source: DOE, "Air Pollutant Index Calculation", APIMS, January 2025,
 * https://eqms.doe.gov.my/Documents/APIMS/API_Calculation.pdf
 */

/** The band edges as [ug/m3, API]. DOE's 0.1 gaps between bands are closed so the curve is continuous. */
const KNOTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [12.0, 50],
  [50.4, 100],
  [55.4, 150],
  [150.4, 200],
  [250.4, 300],
  [350.4, 400],
  [500.4, 500],
];

function interpolate(value: number, from: 0 | 1): number {
  const to = from === 0 ? 1 : 0;
  if (value <= 0) return 0;
  for (let k = 1; k < KNOTS.length; k++) {
    if (value <= KNOTS[k][from] || k === KNOTS.length - 1) {
      // Past the last edge the top band's slope carries on: an index above 500 has happened in Malaysia.
      const [a, b] = [KNOTS[k - 1], KNOTS[k]];
      return a[to] + ((value - a[from]) * (b[to] - a[to])) / (b[from] - a[from]);
    }
  }
  return 0;
}

/** The API a 24 hour mean PM2.5 concentration gives, unrounded. */
export function pm25ToApi(ugm3: number): number {
  return interpolate(ugm3, 0);
}

/** The 24 hour mean PM2.5 concentration an API reading stands for. */
export function apiToPm25(api: number): number {
  return interpolate(api, 1);
}
