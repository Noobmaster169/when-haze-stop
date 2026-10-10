import type { Detection } from "./fires";
import { nearLand } from "./land";

/**
 * Takes out the hotspots that are not vegetation burning, before they become
 * smoke in the model or dots on the map.
 *
 * Sun glint: on a clear morning a satellite can see the sun's reflection off
 * the sea as a wall of "fires", every pixel at the 4 micron channel's ceiling.
 * In the first week, three passes (3, 7 and 9 October, all near 06:20 UTC)
 * put over 3,000 of these between Riau, Johor and the open sea. Real fire
 * clusters, even the densest in Kalimantan, had at most 9% of their pixels
 * saturated; a glint block has all of them. Small blocks are left alone,
 * because a few intense peat fires can saturate together.
 *
 * Open sea: what is left far from any coast is gas flaring on oil and gas
 * platforms. It is a real heat source but not haze, so it is dropped too.
 */

/** Glint is judged per pass on half-degree blocks. */
const BLOCK_DEGREES = 0.5;
/** Below this many detections a block is never called glint. */
const GLINT_MIN_DETECTIONS = 50;
const GLINT_MIN_SATURATED = 0.9;

export interface Screened {
  kept: Detection[];
  /** Detections dropped as sun glint. */
  glint: number;
  /** Detections dropped as too far out at sea. */
  offshore: number;
}

function blockOf(hit: Detection): string {
  return `${hit.satellite}|${hit.day}|${hit.hour}|${Math.floor(hit.lat / BLOCK_DEGREES)}|${Math.floor(hit.lon / BLOCK_DEGREES)}`;
}

function glintBlocks(detections: Detection[]): Set<string> {
  const tally = new Map<string, { all: number; day: number; saturated: number }>();
  for (const hit of detections) {
    const key = blockOf(hit);
    const block = tally.get(key) ?? { all: 0, day: 0, saturated: 0 };
    block.all += 1;
    if (hit.daytime) block.day += 1;
    if (hit.saturated) block.saturated += 1;
    tally.set(key, block);
  }
  const glint = new Set<string>();
  for (const [key, block] of tally) {
    // The sun has to be up for its reflection to be seen.
    const sunlit = block.day * 2 > block.all;
    if (sunlit && block.all >= GLINT_MIN_DETECTIONS && block.saturated >= GLINT_MIN_SATURATED * block.all) glint.add(key);
  }
  return glint;
}

export function screenDetections(detections: Detection[]): Screened {
  const glint = glintBlocks(detections);
  const kept: Detection[] = [];
  let glinted = 0;
  let offshore = 0;
  for (const hit of detections) {
    if (glint.has(blockOf(hit))) glinted += 1;
    else if (!nearLand(hit.lat, hit.lon)) offshore += 1;
    else kept.push(hit);
  }
  return { kept, glint: glinted, offshore };
}
