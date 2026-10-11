/**
 * The pure half of bake-city.mjs: OpenStreetMap geometry and tags to decimetre
 * shapes around the Petronas Towers, clipped to the box, with heights in metres.
 * No network or disk here, so a saved Overpass answer always packs to the same bytes.
 */

export const BBOX = [3.135, 101.68, 3.17, 101.725];
export const ORIGIN = [3.15785, 101.71165];
const METRES_PER_DEGREE_LON = 111320 * Math.cos((ORIGIN[0] * Math.PI) / 180);
const METRES_PER_DEGREE_LAT = 110574;
// A storey, for buildings mapped with levels rather than a height.
const STOREY = 3.2;
const HOUSES = new Set(["house", "detached", "semidetached_house", "terrace", "bungalow", "residential"]);
const SHELTERS = new Set(["roof", "carport", "shed", "garage", "garages", "hut", "kiosk"]);
export const ROAD_WIDTH = { motorway: 14, trunk: 14, primary: 11, secondary: 9, tertiary: 8, unclassified: 6, residential: 6, living_street: 6, service: 4, pedestrian: 5, footway: 2 };
export const RIVER_WIDTH = { river: 20, canal: 8 };

export function metres(value) {
  if (!value) return undefined;
  const feet = /^\s*(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in))?\s*$/i.exec(value);
  if (feet) return (Number(feet[1]) + Number(feet[2] ?? 0) / 12) * 0.3048;
  const plain = /^\s*(\d+(?:[.,]\d+)?)\s*(?:m|metres?|meters?)?\s*$/i.exec(value);
  return plain ? Number(plain[1].replace(",", ".")) : undefined;
}

const count = (value) => (Number.isFinite(Number.parseFloat(value)) ? Math.max(0, Number.parseFloat(value)) : undefined);

export const tenths = (value) => Math.round(value * 10) / 10;

export function extrude(tags, shapes) {
  const levels = count(tags["building:levels"]);
  const minLevel = count(tags["building:min_level"]);
  const m = metres(tags.min_height) ?? (minLevel === undefined ? 0 : minLevel * STOREY);
  const measured = metres(tags.height) ?? (levels === undefined ? undefined : (levels + (count(tags["roof:levels"]) ?? 0)) * STOREY);
  const use = tags.building ?? tags["building:part"];
  // The guess stands on the base, so a raised part with no height still has a body.
  const h = measured ?? m + (HOUSES.has(use) ? 7 : SHELTERS.has(use) ? 4 : 10);
  if (tenths(h) <= tenths(m)) return [];
  return shapes.map((shape) => ({ h: tenths(h), ...(tenths(m) > 0 ? { m: tenths(m) } : {}), ...(measured === undefined ? { e: 1 } : {}), ...shape }));
}

export function lineWidth(tags, what) {
  const tagged = metres(tags.width);
  if (tagged >= 1 && tagged <= 40) return tenths(tagged);
  return what === "road" ? (ROAD_WIDTH[tags.highway] ?? 6) : RIVER_WIDTH[tags.waterway];
}

export function toPlane(lat, lon) {
  return [Math.round((lon - ORIGIN[1]) * METRES_PER_DEGREE_LON * 10), Math.round((lat - ORIGIN[0]) * METRES_PER_DEGREE_LAT * 10)];
}

const [WEST, SOUTH] = toPlane(BBOX[0], BBOX[1]);
const [EAST, NORTH] = toPlane(BBOX[2], BBOX[3]);

function deduplicate(points) {
  const flat = [];
  for (let index = 0; index < points.length; index += 2) {
    if (flat.length && flat.at(-2) === points[index] && flat.at(-1) === points[index + 1]) continue;
    flat.push(points[index], points[index + 1]);
  }
  return flat;
}

export const line = (geometry) => deduplicate(geometry.flatMap(({ lat, lon }) => toPlane(lat, lon)));

function openRing(points) {
  const flat = deduplicate(points);
  if (flat.length >= 4 && flat[0] === flat.at(-2) && flat[1] === flat.at(-1)) flat.length -= 2;
  const distinct = new Set();
  for (let index = 0; index < flat.length; index += 2) distinct.add(`${flat[index]},${flat[index + 1]}`);
  return distinct.size >= 3 ? flat : null;
}

export const ring = (geometry) => openRing(line(geometry));

// Rivers and their banks run tens of kilometres past the box; only the part over the scene is kept.
function clipRing(flat) {
  let points = flat;
  for (const [axis, limit, sign] of [[0, WEST, 1], [0, EAST, -1], [1, SOUTH, 1], [1, NORTH, -1]]) {
    const kept = [];
    for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
      const [a, b] = [[points[j], points[j + 1]], [points[i], points[i + 1]]];
      const aIn = sign * (a[axis] - limit) >= 0;
      const bIn = sign * (b[axis] - limit) >= 0;
      if (aIn !== bIn) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        kept.push(Math.round(a[0] + t * (b[0] - a[0])), Math.round(a[1] + t * (b[1] - a[1])));
      }
      if (bIn) kept.push(...b);
    }
    points = kept;
  }
  return openRing(points);
}

export function clipShape(shape) {
  const o = clipRing(shape.o);
  const holes = (shape.i ?? []).map(clipRing).filter(Boolean);
  if (!o) return [];
  return [holes.length ? { o, i: holes } : { o }];
}

// Liang-Barsky per segment; a line that leaves the box and comes back becomes two pieces.
export function clipLine(flat) {
  const pieces = [];
  for (let index = 2; index < flat.length; index += 2) {
    const [x0, y0, dx, dy] = [flat[index - 2], flat[index - 1], flat[index] - flat[index - 2], flat[index + 1] - flat[index - 1]];
    let [t0, t1] = [0, 1];
    for (const [p, q] of [[-dx, x0 - WEST], [dx, EAST - x0], [-dy, y0 - SOUTH], [dy, NORTH - y0]]) {
      if (p === 0 && q < 0) t0 = 2;
      if (p < 0) t0 = Math.max(t0, q / p);
      if (p > 0) t1 = Math.min(t1, q / p);
    }
    if (t0 > t1) continue;
    const [sx, sy] = [Math.round(x0 + t0 * dx), Math.round(y0 + t0 * dy)];
    const last = pieces.at(-1);
    if (t0 === 0 && last?.at(-2) === sx && last.at(-1) === sy) last.push(Math.round(x0 + t1 * dx), Math.round(y0 + t1 * dy));
    else pieces.push([sx, sy, Math.round(x0 + t1 * dx), Math.round(y0 + t1 * dy)]);
  }
  return pieces.map(deduplicate).filter((piece) => piece.length >= 4);
}

function inside(x, y, flat) {
  let hit = false;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [flat[i], flat[i + 1], flat[j], flat[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function centroid(flat) {
  let [area, cx, cy] = [0, 0, 0];
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const cross = flat[j] * flat[i + 1] - flat[i] * flat[j + 1];
    area += cross;
    cx += (flat[j] + flat[i]) * cross;
    cy += (flat[j + 1] + flat[i + 1]) * cross;
  }
  if (area !== 0) return [cx / (3 * area), cy / (3 * area)];
  const sum = (offset) => flat.filter((_, k) => k % 2 === offset).reduce((a, b) => a + b, 0) / (flat.length / 2);
  return [sum(0), sum(1)];
}

// Joins a relation's member ways end to end into closed rings; a ring that cannot close is dropped.
function assemble(members, role) {
  const key = (point) => `${point.lat},${point.lon}`;
  const open = members.filter((member) => member.type === "way" && (member.role || "outer") === role && member.geometry?.length >= 2 && member.geometry.every(Boolean)).map((member) => member.geometry);
  const rings = [];
  while (open.length) {
    let chain = open.shift();
    while (key(chain[0]) !== key(chain.at(-1))) {
      const end = key(chain.at(-1));
      const index = open.findIndex((way) => key(way[0]) === end || key(way.at(-1)) === end);
      if (index === -1) break;
      const [next] = open.splice(index, 1);
      chain = chain.concat((key(next[0]) === end ? next : next.toReversed()).slice(1));
    }
    const closed = key(chain[0]) === key(chain.at(-1)) ? ring(chain) : null;
    if (closed) rings.push(closed);
  }
  return rings;
}

export function polygons(element) {
  if (element.type === "way") {
    const outer = element.nodes[0] === element.nodes.at(-1) ? ring(element.geometry) : null;
    return outer ? [{ o: outer }] : [];
  }
  if (element.tags.type !== "multipolygon") return [];
  const inners = assemble(element.members, "inner");
  return assemble(element.members, "outer").map((o) => {
    const holes = inners.filter((hole) => inside(hole[0], hole[1], o));
    return holes.length ? { o, i: holes } : { o };
  });
}

// Drops every outline with a part inside it: Simple 3D Buildings renders the parts instead.
export function dropOutlinesWithParts(outlines, parts) {
  const CELL = 500;
  const grid = new Map();
  outlines.forEach((outline, index) => {
    const xs = outline.o.filter((_, k) => k % 2 === 0);
    const ys = outline.o.filter((_, k) => k % 2 === 1);
    for (let cx = Math.floor(Math.min(...xs) / CELL); cx <= Math.floor(Math.max(...xs) / CELL); cx += 1) {
      for (let cy = Math.floor(Math.min(...ys) / CELL); cy <= Math.floor(Math.max(...ys) / CELL); cy += 1) {
        grid.set(`${cx},${cy}`, [...(grid.get(`${cx},${cy}`) ?? []), index]);
      }
    }
  });
  const covered = new Set();
  for (const part of parts) {
    const [x, y] = centroid(part.o);
    for (const index of grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? []) {
      if (inside(x, y, outlines[index].o)) covered.add(index);
    }
  }
  return outlines.filter((_, index) => !covered.has(index));
}
