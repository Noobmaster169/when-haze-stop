import { DOMAIN } from "./grid";
import { VEGETATION_ROWS } from "./vegetation-data";

/**
 * Whether the ground at a point is vegetation, from ESA WorldCover 2021 at
 * 0.01 degree (about 1 km). A satellite hotspot is heat, and heat on a
 * refinery, a smelter, a town, an open-cut mine or a ship in a coastal
 * anchorage is not haze from burning vegetation.
 *
 * Measured on the week to 10 October 2026: of hotspots of 100 MW or more,
 * none fell on ground this calls bare; of the heat left in Malaysia after
 * NASA's fixed-source labels, three fifths did. The labels are still needed:
 * a gas flare at a well in a plantation sits on ground that is vegetation.
 */

const STEP = 0.01;
const NX = Math.round((DOMAIN.lon1 - DOMAIN.lon0) / STEP);
const NY = Math.round((DOMAIN.lat1 - DOMAIN.lat0) / STEP);

let grid: Uint8Array | undefined;

function unpack(): Uint8Array {
  const cells = new Uint8Array(NX * NY);
  VEGETATION_ROWS.forEach((runs, row) => {
    let column = 0;
    runs.split(",").forEach((length, index) => {
      const count = Number(length);
      // Runs alternate vegetation and not, starting with vegetation.
      if (index % 2 === 0) cells.fill(1, row * NX + column, row * NX + column + count);
      column += count;
    });
  });
  return cells;
}

/** Outside the region nothing is known, so it says true and leaves the call to `inDomain`, as `nearLand` does. */
export function onVegetation(lat: number, lon: number): boolean {
  const row = Math.floor((lat - DOMAIN.lat0) / STEP);
  const column = Math.floor((lon - DOMAIN.lon0) / STEP);
  if (row < 0 || row >= NY || column < 0 || column >= NX) return true;
  grid ??= unpack();
  return grid[row * NX + column] === 1;
}
