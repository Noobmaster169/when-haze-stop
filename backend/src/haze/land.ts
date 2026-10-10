import { DOMAIN } from "./grid";
import { LAND_RINGS } from "./land-outline";

/**
 * Land or open sea, for the fire screen.
 *
 * The outlines are simplified (edges of several km), so a fire on a mangrove
 * or peat coast can sit just outside them. "Near land" therefore reaches 10 km
 * past the outline: wide enough for every coast fire seen in the first week,
 * narrow enough to leave out the gas platforms of the Malay Basin, Natuna,
 * Luconia and offshore Brunei, which sit 30 to 160 km out.
 */

const STEP = 0.02;
const NX = Math.round((DOMAIN.lon1 - DOMAIN.lon0) / STEP);
const NY = Math.round((DOMAIN.lat1 - DOMAIN.lat0) / STEP);
/** Ten km in cells of 0.02 degree (2.2 km). */
const REACH_CELLS = 4;

function unpack(steps: readonly number[]): Float64Array {
  const ring = new Float64Array(steps.length);
  let lon = 0;
  let lat = 0;
  for (let index = 0; index < steps.length; index += 2) {
    lon += steps[index];
    lat += steps[index + 1];
    ring[index] = lon / 100;
    ring[index + 1] = lat / 100;
  }
  return ring;
}

/** Cells whose centre lies inside any outline, filled one row at a time between edge crossings. */
function rasterise(): Uint8Array {
  const land = new Uint8Array(NX * NY);
  const rings = LAND_RINGS.map(unpack);
  for (let row = 0; row < NY; row++) {
    const lat = DOMAIN.lat0 + (row + 0.5) * STEP;
    for (const ring of rings) {
      const crossings: number[] = [];
      const points = ring.length / 2;
      for (let index = 0; index < points; index++) {
        const next = (index + 1) % points;
        const [aLon, aLat, bLon, bLat] = [ring[index * 2], ring[index * 2 + 1], ring[next * 2], ring[next * 2 + 1]];
        if (aLat > lat !== bLat > lat) crossings.push(aLon + ((lat - aLat) * (bLon - aLon)) / (bLat - aLat));
      }
      crossings.sort((a, b) => a - b);
      for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
        const first = Math.max(0, Math.ceil((crossings[pair] - DOMAIN.lon0) / STEP - 0.5));
        const last = Math.min(NX - 1, Math.floor((crossings[pair + 1] - DOMAIN.lon0) / STEP - 0.5));
        for (let column = first; column <= last; column++) land[row * NX + column] = 1;
      }
    }
  }
  return land;
}

/** Land grown outward by REACH_CELLS in every direction. */
function widen(land: Uint8Array): Uint8Array {
  let near = land;
  for (let step = 0; step < REACH_CELLS; step++) {
    const grown = new Uint8Array(near);
    for (let row = 0; row < NY; row++) {
      for (let column = 0; column < NX; column++) {
        if (!near[row * NX + column]) continue;
        for (let j = Math.max(0, row - 1); j <= Math.min(NY - 1, row + 1); j++) {
          for (let i = Math.max(0, column - 1); i <= Math.min(NX - 1, column + 1); i++) grown[j * NX + i] = 1;
        }
      }
    }
    near = grown;
  }
  return near;
}

let mask: Uint8Array | null = null;

/** True on land or within about 10 km of it. Outside the region nothing is known, so it says true and leaves the call to inDomain. */
export function nearLand(lat: number, lon: number): boolean {
  const column = Math.floor((lon - DOMAIN.lon0) / STEP);
  const row = Math.floor((lat - DOMAIN.lat0) / STEP);
  if (column < 0 || column >= NX || row < 0 || row >= NY) return true;
  mask ??= widen(rasterise());
  return mask[row * NX + column] === 1;
}
