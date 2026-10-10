import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BBOX, ORIGIN, RIVER_WIDTH, ROAD_WIDTH, centroid, clipLine, clipShape, dropOutlinesWithParts, extrude, line, lineWidth, metres, polygons, ring, tenths, toPlane } from "./osm-pack.mjs";

/**
 * Bakes central Kuala Lumpur from OpenStreetMap into public/city/kl.json: the
 * buildings, towers, parks, water, roads and rivers a three.js scene extrudes in
 * the browser. One Overpass request, then packing. From the repo root:
 *
 *   node frontend/scripts/bake-city.mjs                   fetch from Overpass
 *   node frontend/scripts/bake-city.mjs --from osm.json   pack a saved answer
 *   node frontend/scripts/bake-city.mjs --save osm.json   keep the answer for --from
 *
 * Run it again to pick up newer mapping. Coordinates are whole decimetres on a
 * flat plane, x east and y north of the Petronas Towers; rings are open and flat
 * [x0, y0, x1, y1, ...]. The data is (c) OpenStreetMap contributors under the
 * ODbL, and the output carries that notice. Keep raw answers out of the repo.
 */

const here = dirname(fileURLToPath(import.meta.url));
const TARGET = join(here, "../public/city/kl.json");
const ENDPOINT = "https://overpass-api.de/api/interpreter";
// Below this a man_made=tower is a mast or water tower, not a landmark.
const LANDMARK_TOWER = 100;
const PARK = { leisure: ["park", "garden", "pitch"], landuse: ["grass", "recreation_ground", "cemetery", "forest"], natural: ["wood", "scrub"] };
// Values that mean nothing stands there yet; a proposed part would also hide the real outline.
const ABSENT = new Set(["no", "proposed"]);
const LINK = /^(motorway|trunk|primary|secondary|tertiary)_link$/;

const QUERY = `[out:json][timeout:180][bbox:${BBOX.join(",")}];
(
  wr["building"];
  wr["building:part"];
  nw["man_made"="tower"]["height"];
  way["highway"~"^(${Object.keys(ROAD_WIDTH).join("|")}|(motorway|trunk|primary|secondary|tertiary)_link)$"];
  wr["leisure"~"^(${PARK.leisure.join("|")})$"];
  wr["landuse"~"^(${PARK.landuse.join("|")})$"];
  wr["natural"~"^(${[...PARK.natural, "water"].join("|")})$"];
  wr["water"];
  way["waterway"~"^(river|canal)$"];
);
out body geom;`;

async function fetchOverpass() {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "User-Agent": "when-haze-stop-bake/0.1" },
      body: new URLSearchParams({ data: QUERY }),
    });
    if (response.ok) return response.json();
    // Overpass sheds load with 429 and 504 and asks callers to back off, not hammer it.
    if (![429, 504].includes(response.status) || attempt === 2) {
      throw new Error(`overpass answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const wait = 30_000 * 2 ** attempt;
    console.log(`overpass answered ${response.status}; retrying in ${wait / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

// Sorts an element into what the scene draws, by the same tags the query asks for.
function kind(element) {
  const tags = element.tags ?? {};
  if (tags.man_made === "tower" && (metres(tags.height) ?? 0) >= LANDMARK_TOWER) return "tower";
  if (tags["building:part"] && !ABSENT.has(tags["building:part"])) return "part";
  if (tags.building && !ABSENT.has(tags.building)) return "building";
  if (element.type === "node") return undefined;
  if (tags.natural === "water" || tags.water) return "water";
  if (Object.entries(PARK).some(([key, values]) => values.includes(tags[key]))) return "park";
  if (element.type !== "way") return undefined;
  // The scene draws every line on the surface, so anything underground or roofed over would float on top of the city.
  if (Number.parseFloat(tags.layer) < 0 || tags.covered === "yes") return undefined;
  if (RIVER_WIDTH[tags.waterway]) return tags.tunnel === "culvert" ? undefined : "river";
  const tunnel = tags.tunnel && tags.tunnel !== "no";
  if ((ROAD_WIDTH[tags.highway] || LINK.test(tags.highway ?? "")) && tags.area !== "yes" && tags.indoor !== "yes" && !tunnel) return "road";
  return undefined;
}

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const data = option("--from") ? JSON.parse(await readFile(option("--from"), "utf8")) : await fetchOverpass();
if (data.remark) throw new Error(`overpass remarked: ${data.remark}`);
if (option("--save")) await writeFile(option("--save"), JSON.stringify(data));

// A relation that is emitted owns its outer ways, so those ways are not drawn a second time.
const claimed = new Set();
const sorted = data.elements.toSorted((a, b) => (a.type === "relation" ? 0 : 1) - (b.type === "relation" ? 0 : 1));
const found = { building: [], part: [], tower: [], park: [], water: [], road: [], river: [] };
for (const element of sorted) {
  const what = kind(element);
  if (!what || claimed.has(`${what}:${element.id}`)) continue;
  const tags = element.tags;
  if (what === "tower") {
    const [x, y] = element.type === "node" ? toPlane(element.lat, element.lon) : centroid(ring(element.geometry) ?? line(element.geometry));
    found.tower.push({ x: Math.round(x), y: Math.round(y), h: tenths(metres(tags.height)) });
    continue;
  }
  if (what === "road" || what === "river") {
    const w = lineWidth(tags, what);
    found[what].push(...clipLine(line(element.geometry)).map((p) => ({ w, p })));
    continue;
  }
  const shapes = polygons(element);
  if (element.type === "relation" && shapes.length) {
    for (const member of element.members) if (member.type === "way" && (member.role || "outer") === "outer") claimed.add(`${what}:${member.ref}`);
  }
  found[what].push(...(what === "park" || what === "water" ? shapes.flatMap(clipShape) : extrude(tags, shapes)));
}

const buildings = [...dropOutlinesWithParts(found.building, found.part), ...found.part];
const city = {
  attribution: "© OpenStreetMap contributors",
  license: "ODbL 1.0",
  licenseUrl: "https://www.openstreetmap.org/copyright",
  osmBase: data.osm3s.timestamp_osm_base,
  origin: ORIGIN,
  bbox: BBOX,
  buildings,
  towers: found.tower,
  parks: found.park,
  water: found.water,
  roads: found.road,
  rivers: found.river,
};
await mkdir(dirname(TARGET), { recursive: true });
await writeFile(TARGET, JSON.stringify(city));
console.log(
  `wrote ${TARGET}: ${buildings.length} buildings (${found.building.length - (buildings.length - found.part.length)} outlines replaced by ${found.part.length} parts, ${buildings.filter((b) => b.e).length} estimated), ` +
    `${found.tower.length} towers, ${found.park.length} parks, ${found.water.length} water, ${found.road.length} roads, ${found.river.length} rivers`,
);
