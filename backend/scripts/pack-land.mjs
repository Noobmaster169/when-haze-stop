import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies the land outlines of the model's region from the frontend basemap
 * (Natural Earth, public domain) into src/haze/land-outline.ts, so the fire
 * screen can tell land from sea without reading another package at run time.
 *
 *   node scripts/pack-land.mjs
 *
 * Run it again after the basemap changes. The packing is the basemap's own:
 * each ring is its first point in hundredths of a degree, then steps.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, "../../frontend/public/basemap.json");
const TARGET = join(here, "../src/haze/land-outline.ts");
// The model's region, with a degree to spare so a coast just outside still counts.
const BOX = { lon0: 95, lat0: -7, lon1: 121, lat1: 9 };

function bounds(steps) {
  let lon = 0;
  let lat = 0;
  const box = { lon0: Infinity, lat0: Infinity, lon1: -Infinity, lat1: -Infinity };
  for (let index = 0; index < steps.length; index += 2) {
    lon += steps[index];
    lat += steps[index + 1];
    box.lon0 = Math.min(box.lon0, lon / 100);
    box.lon1 = Math.max(box.lon1, lon / 100);
    box.lat0 = Math.min(box.lat0, lat / 100);
    box.lat1 = Math.max(box.lat1, lat / 100);
  }
  return box;
}

const basemap = JSON.parse(await readFile(SOURCE, "utf8"));
const rings = basemap.land.flat().filter((steps) => {
  const box = bounds(steps);
  return box.lon1 >= BOX.lon0 && box.lon0 <= BOX.lon1 && box.lat1 >= BOX.lat0 && box.lat0 <= BOX.lat1;
});

const body = `/**
 * Land outlines over the model's region, from Natural Earth (public domain) by
 * way of frontend/public/basemap.json. Written by scripts/pack-land.mjs; do not
 * edit by hand. Each ring is its first point in hundredths of a degree, then
 * the steps to each next point.
 */
export const LAND_RINGS: readonly (readonly number[])[] = ${JSON.stringify(rings)};
`;
await writeFile(TARGET, body);
console.log(`wrote ${rings.length} rings to ${TARGET}`);
