/**
 * The index a 24-hour PM2.5 concentration gives, on DOE's bands. Mirrored by
 * hand from backend/src/haze/api-index.ts (BAND_EDGES, pm25ToApi): the verdict
 * maps arrive as ug/m3 and are coloured on the map's index scale. Pure.
 */

const BAND_EDGES: readonly (readonly [number, number])[] = [
  [0, 0],
  [12.0, 50],
  [50.4, 100],
  [55.4, 150],
  [150.4, 200],
  [250.4, 300],
  [350.4, 400],
  [500.4, 500],
];

export function pm25ToApi(ugm3: number): number {
  if (ugm3 <= 0) return 0;
  for (let k = 1; k < BAND_EDGES.length; k++) {
    if (ugm3 <= BAND_EDGES[k][0] || k === BAND_EDGES.length - 1) {
      // Past the last edge the top band's slope carries on, as the backend does.
      const [a, b] = [BAND_EDGES[k - 1], BAND_EDGES[k]];
      return a[1] + ((ugm3 - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
    }
  }
  return 0;
}

/** The 24-hour PM2.5 at which the index reaches 100, the line the verdict chart draws. */
export const API_100_PM25 = 50.4;

/** One byte per cell, base64, as the verdict maps carry them. */
export function decodeBytes(base64: string): Uint8Array {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);
  return bytes;
}
