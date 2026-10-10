import { LAND_RINGS } from "../haze/land-outline";

/**
 * How far a place is from the sea, for the scooper's reach. Measured to the
 * simplified Natural Earth outline the fire screen uses, whose edges are
 * several km long, so a figure is good to a few km. Large rivers and lakes the
 * CL-415 could also scoop from are not in it, which errs on the side of
 * calling a fire out of reach.
 */

const KM_PER_DEGREE = 111.2;

/** Every coast segment as [lon, lat, lon, lat], in degrees. */
const SEGMENTS: Float64Array = (() => {
  const out: number[] = [];
  for (const steps of LAND_RINGS) {
    const points: number[] = [];
    let lon = 0;
    let lat = 0;
    for (let index = 0; index < steps.length; index += 2) {
      lon += steps[index];
      lat += steps[index + 1];
      points.push(lon / 100, lat / 100);
    }
    for (let k = 0; k + 3 < points.length + 2; k += 2) {
      const next = (k + 2) % points.length;
      out.push(points[k], points[k + 1], points[next], points[next + 1]);
    }
  }
  return Float64Array.from(out);
})();

/** Distance in km from a point to the nearest coast segment, on a plane scaled for the point's latitude. */
export function coastKm(lat: number, lon: number): number {
  const xScale = KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180);
  let best = Number.POSITIVE_INFINITY;
  for (let s = 0; s < SEGMENTS.length; s += 4) {
    const ax = (SEGMENTS[s] - lon) * xScale;
    const ay = (SEGMENTS[s + 1] - lat) * KM_PER_DEGREE;
    const bx = (SEGMENTS[s + 2] - lon) * xScale;
    const by = (SEGMENTS[s + 3] - lat) * KM_PER_DEGREE;
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
