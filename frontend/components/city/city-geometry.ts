import { LatheGeometry, ShapeUtils, Vector2, Vector3, type BufferGeometry } from "three";

import type { Area, Building, CityData, Line } from "./city-data";
import { MeshBuilder, type Linear } from "./mesh-builder";

/**
 * The baked city turned into two geometries: the solids that cast shadows
 * (buildings and towers) and the flat surfaces that take them (parks, water,
 * roads, rivers). The scene is in metres with y up; the bake's north is -z.
 */

export interface CityColours {
  building: Linear;
  glass: Linear;
  park: Linear;
  water: Linear;
  road: Linear;
  tower: Linear;
}

const UP = new Vector3(0, 1, 0);
/** Towers this tall read as glass and steel rather than concrete. */
const GLASS_FROM_M = 150;
/** Surfaces are lifted a few centimetres apart so they do not flicker against the ground or each other. */
const LIFT = { park: 0.06, water: 0.1, river: 0.14, road: 0.18 } as const;

/**
 * Menara KL, which OSM has only as a point with a height. Its profile is drawn
 * by hand from the published figures: a 421 m mast and a turret about 276 to
 * 335 m up. Pairs of [radius, height] in metres.
 */
const KL_TOWER_PROFILE: [number, number][] = [
  [13, 0], [8, 80], [6.5, 262], [14, 268], [21, 280], [22, 296], [17, 306], [19, 312], [19, 326], [10, 334], [3, 342], [1.2, 421], [0, 421],
];

function ring(flat: number[]): Vector2[] {
  const points: Vector2[] = [];
  for (let index = 0; index + 1 < flat.length; index += 2) points.push(new Vector2(flat[index] / 10, flat[index + 1] / 10));
  return points;
}

/** Outer ring anticlockwise and holes clockwise, as triangulation and outward normals expect. */
function oriented(outer: number[], holes: number[][] = []): { outer: Vector2[]; holes: Vector2[][] } {
  const shell = ring(outer);
  if (ShapeUtils.isClockWise(shell)) shell.reverse();
  const cut = holes.map(ring).filter((hole) => hole.length >= 3);
  for (const hole of cut) if (!ShapeUtils.isClockWise(hole)) hole.reverse();
  return { outer: shell, holes: cut };
}

const at = (point: Vector2, height: number): Vector3 => new Vector3(point.x, height, -point.y);

/** A small, steady variation per building, so a block of identical boxes still reads as many. */
function shade(colour: Linear, seed: number): Linear {
  const wobble = 0.9 + 0.14 * ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  return colour.map((channel) => channel * wobble) as Linear;
}

function walls(builder: MeshBuilder, points: Vector2[], base: number, top: number, colour: Linear): void {
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const outward = new Vector3(b.y - a.y, 0, b.x - a.x).normalize();
    if (!Number.isFinite(outward.x)) continue;
    builder.quad(at(a, base), at(b, base), at(b, top), at(a, top), outward, colour);
  }
}

function flat(builder: MeshBuilder, outer: Vector2[], holes: Vector2[][], height: number, colour: Linear): void {
  const all = [...outer, ...holes.flat()];
  for (const [a, b, c] of ShapeUtils.triangulateShape(outer, holes)) builder.triangle(at(all[a], height), at(all[b], height), at(all[c], height), UP, colour);
}

function building(builder: MeshBuilder, item: Building, index: number, colours: CityColours): void {
  const { outer, holes } = oriented(item.o, item.i);
  if (outer.length < 3) return;
  const base = item.m ?? 0;
  const colour = shade(item.h >= GLASS_FROM_M ? colours.glass : colours.building, index);
  for (const points of [outer, ...holes]) walls(builder, points, base, item.h, colour);
  flat(builder, outer, holes, item.h, colour);
}

function ribbon(builder: MeshBuilder, line: Line, height: number, colour: Linear): void {
  const points = ring(line.p);
  const half = line.w / 2;
  for (let index = 0; index + 1 < points.length; index++) {
    const a = points[index];
    const b = points[index + 1];
    const along = new Vector2().subVectors(b, a);
    if (along.lengthSq() === 0) continue;
    const side = new Vector2(-along.y, along.x).normalize().multiplyScalar(half);
    builder.quad(at(a.clone().add(side), height), at(b.clone().add(side), height), at(b.clone().sub(side), height), at(a.clone().sub(side), height), UP, colour);
  }
}

function area(builder: MeshBuilder, item: Area, height: number, colour: Linear): void {
  const { outer, holes } = oriented(item.o, item.i);
  if (outer.length >= 3) flat(builder, outer, holes, height, colour);
}

export function buildSolids(data: CityData, colours: CityColours): BufferGeometry {
  const builder = new MeshBuilder();
  data.buildings.forEach((item, index) => building(builder, item, index, colours));
  for (const tower of data.towers) {
    const lathe = new LatheGeometry(KL_TOWER_PROFILE.map(([radius, height]) => new Vector2(radius, height * (tower.h / 421))), 24);
    lathe.translate(tower.x / 10, 0, -tower.y / 10);
    builder.absorb(lathe, colours.tower);
    lathe.dispose();
  }
  return builder.build();
}

export function buildSurfaces(data: CityData, colours: CityColours): BufferGeometry {
  const builder = new MeshBuilder();
  for (const item of data.parks) area(builder, item, LIFT.park, colours.park);
  for (const item of data.water) area(builder, item, LIFT.water, colours.water);
  for (const item of data.rivers) ribbon(builder, item, LIFT.river, colours.water);
  for (const item of data.roads) ribbon(builder, item, LIFT.road, colours.road);
  return builder.build();
}
