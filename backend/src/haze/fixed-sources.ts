import type { Detection } from "./fires";

/**
 * Takes out the hotspots that sit on a known fixed heat source: a gas flare, a
 * smelter, a power plant, a volcano. They are hot every day of the year and
 * burn no vegetation, so in the model they would be smoke that never existed.
 *
 * NASA labels them in its archive. In two wet-season and dry-season samples of
 * that archive the fixed land sources were a steady 60 to 70 detections per
 * five days from one satellite, whatever the fires around them were doing.
 */

/** One 0.01 degree cell (about 1 km) the labelled archive marked as a fixed source. */
export interface FixedSite {
  lat100: number;
  lon100: number;
}

/** A cell counts once the archive has marked it on this many separate days, so a single mislabelled pass masks nothing. */
export const FIXED_MIN_DAYS = 3;

export type FixedMask = ReadonlySet<number>;

function keyOf(lat100: number, lon100: number): number {
  return (lat100 + 9000) * 36_000 + (lon100 + 18_000);
}

/**
 * Each site and the eight cells around it. A VIIRS pixel is 375 m at best and
 * twice that at the edge of a pass, so the same flare lands in a neighbouring
 * cell from one day to the next.
 */
export function fixedMask(sites: FixedSite[]): FixedMask {
  const mask = new Set<number>();
  for (const site of sites) {
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLon = -1; dLon <= 1; dLon++) mask.add(keyOf(site.lat100 + dLat, site.lon100 + dLon));
    }
  }
  return mask;
}

export function withoutFixedSources(detections: Detection[], mask: FixedMask): { burning: Detection[]; fixed: number } {
  if (mask.size === 0) return { burning: detections, fixed: 0 };
  const burning = detections.filter((hit) => !mask.has(keyOf(Math.floor(hit.lat * 100), Math.floor(hit.lon * 100))));
  return { burning, fixed: detections.length - burning.length };
}
