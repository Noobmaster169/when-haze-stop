import type { FieldGrid } from "@/lib/api/haze-schemas";

/**
 * Reading the map's packed frames. Pure.
 *
 * A frame is one byte a cell holding API / 2, row-major from the south-west
 * corner. Wind is two signed bytes a point, metres a second times eight.
 */

export const API_PER_BYTE = 2;
export const WIND_PER_BYTE = 1 / 8;

export function decodeBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function inGrid(grid: FieldGrid, lon: number, lat: number): boolean {
  return lon >= grid.lon0 && lon <= grid.lon0 + grid.nx * grid.step && lat >= grid.lat0 && lat <= grid.lat0 + grid.ny * grid.step;
}

/** Where a point falls among cell centres: the cell below-left, and how far toward the next one. */
function corner(grid: FieldGrid, lon: number, lat: number, centred: boolean): { index: number; ax: number; ay: number } {
  const shift = centred ? 0.5 : 0;
  const fx = Math.max(0, Math.min(grid.nx - 1.001, (lon - grid.lon0) / grid.step - shift));
  const fy = Math.max(0, Math.min(grid.ny - 1.001, (lat - grid.lat0) / grid.step - shift));
  const column = Math.floor(fx);
  const row = Math.floor(fy);
  return { index: row * grid.nx + column, ax: fx - column, ay: fy - row };
}

/** A frame's value at a point, in API, blended between the four cells around it. */
export function sampleField(bytes: Uint8Array, grid: FieldGrid, lon: number, lat: number): number {
  const { index, ax, ay } = corner(grid, lon, lat, true);
  const south = bytes[index] * (1 - ax) + bytes[index + 1] * ax;
  const north = bytes[index + grid.nx] * (1 - ax) + bytes[index + grid.nx + 1] * ax;
  return (south * (1 - ay) + north * ay) * API_PER_BYTE;
}

/** The wind at a point, metres a second, eastward then northward. Wind values sit on grid corners, not centres. */
export function sampleWind(uv: Int8Array, grid: FieldGrid, lon: number, lat: number): [number, number] {
  const { index, ax, ay } = corner(grid, lon, lat, false);
  const at = (point: number, part: 0 | 1): number => uv[point * 2 + part];
  const blend = (part: 0 | 1): number =>
    (at(index, part) * (1 - ax) + at(index + 1, part) * ax) * (1 - ay) + (at(index + grid.nx, part) * (1 - ax) + at(index + grid.nx + 1, part) * ax) * ay;
  return [blend(0) * WIND_PER_BYTE, blend(1) * WIND_PER_BYTE];
}

/**
 * The two frames a moment sits between, and how far it is from the first to
 * the second. Before the first or after the last, it is that frame alone.
 */
export function bracket(times: number[], at: number): { from: number; to: number; share: number } {
  if (times.length === 0) return { from: 0, to: 0, share: 0 };
  if (at <= times[0]) return { from: 0, to: 0, share: 0 };
  const last = times.length - 1;
  if (at >= times[last]) return { from: last, to: last, share: 0 };
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (times[middle] <= at) low = middle;
    else high = middle;
  }
  return { from: low, to: high, share: (at - times[low]) / (times[high] - times[low]) };
}
