import { type Anchor, bilinearWeights, fadeAt, pullAt, sampleAt, spreadErrors } from "./field";
import { cellCentre, distanceKm, DOMAIN, FIELD, inDomain } from "./grid";
import { ridged, solve } from "./solve";

/**
 * The field pulled to given values at given points, exactly.
 *
 * Spreading each point's own difference the way station errors are spread
 * lands near the neighbourhood's mean difference, not on each point: the
 * inverse distance average at a point still mixes in every neighbour. So the
 * values to spread are solved for instead. The spread is linear in them, and
 * the bilinear sample at each point is linear in the spread, so one matrix
 * says what each point's value contributes at every other point, and the
 * values that bring every point to its target are one solve away.
 */

/** A place with the PM2.5 the field should show there. */
export interface Target {
  lat: number;
  lon: number;
  pm25: number;
}

/** Two points a cell apart have nearly the same row; this much on the diagonal keeps the solve steady and costs well under 1 ug/m3 at a point. */
export const RIDGE = 0.02;

function cellOf(lat: number, lon: number): number {
  return Math.floor((lat - DOMAIN.lat0) / FIELD.step) * FIELD.nx + Math.floor((lon - DOMAIN.lon0) / FIELD.step);
}

/** Two points in one cell cannot be told apart by the field, so they become one, at the mean place with the mean target. */
export function mergeByCell(points: Target[]): Target[] {
  const groups = new Map<number, Target[]>();
  for (const point of points) {
    const cell = cellOf(point.lat, point.lon);
    const group = groups.get(cell);
    if (group) group.push(point);
    else groups.set(cell, [point]);
  }
  return [...groups.values()].map((group) => {
    const mean = (pick: (point: Target) => number): number => group.reduce((sum, point) => sum + pick(point), 0) / group.length;
    return { lat: mean((point) => point.lat), lon: mean((point) => point.lon), pm25: mean((point) => point.pm25) };
  });
}

/** Row i, column j: what one unit spread from point j reads back at point i, through `spreadErrors` and the bilinear sample. */
export function pointWeights(points: { lat: number; lon: number }[]): number[][] {
  const n = points.length;
  const weights = points.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (const { cell, weight } of bilinearWeights(points[i].lat, points[i].lon)) {
      if (weight === 0) continue;
      const centre = cellCentre(cell);
      const pulls = new Array<number>(n);
      let total = 0;
      let nearest = Infinity;
      for (let j = 0; j < n; j++) {
        const km = distanceKm(centre.lat, centre.lon, points[j].lat, points[j].lon);
        if (km < nearest) nearest = km;
        pulls[j] = pullAt(km);
        total += pulls[j];
      }
      const scale = (fadeAt(nearest) * weight) / total;
      for (let j = 0; j < n; j++) weights[i][j] += scale * pulls[j];
    }
  }
  return weights;
}

/** The values to spread so that each point reads back its `delta`: a ridged solve, then one more on what the ridge left over. */
export function valuesFor(weights: number[][], delta: number[]): number[] {
  const system = ridged(weights, RIDGE);
  const first = solve(system, delta);
  const left = delta.map((value, i) => value - weights[i].reduce((sum, weight, j) => sum + weight * first[j], 0));
  const more = solve(system, left);
  return first.map((value, i) => value + more[i]);
}

/**
 * A point outside the region is skipped; with none left the field is
 * returned as it is. The bilinear sample at every point of the result is its
 * target to well within 1 ug/m3.
 */
export function correctToPoints(pm25: Float32Array, points: Target[]): Float32Array {
  const merged = mergeByCell(points.filter((point) => inDomain(point.lat, point.lon)));
  if (merged.length === 0) return pm25;
  const delta = merged.map((point) => point.pm25 - sampleAt(pm25, point.lat, point.lon));
  const values = valuesFor(pointWeights(merged), delta);
  const anchors: Anchor[] = merged.map((point, i) => ({ lat: point.lat, lon: point.lon, error: values[i] }));
  const spread = spreadErrors(anchors);
  const corrected = new Float32Array(pm25.length);
  for (let cell = 0; cell < pm25.length; cell++) corrected[cell] = pm25[cell] + spread[cell];
  return corrected;
}
