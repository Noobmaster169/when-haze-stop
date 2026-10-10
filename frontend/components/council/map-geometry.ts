import type { Basemap } from "@/components/map/basemap";
import { colourAt, type Rgb, type Stop } from "@/components/map/scale";
import type { StrikeLine, VerdictMaps } from "@/lib/api/council-schemas";

import { pm25ToApi } from "./pm25";

/**
 * The verdict map's geometry: which box of the region to draw, how a
 * longitude and latitude land on it, the coasts as paths, and the engine's
 * field painted as an image on the map's own index colours.
 */

export interface Bounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

/** The whole field the engine draws, as the map page does. */
export function gridBounds(grid: VerdictMaps["grid"]): Bounds {
  return { west: grid.lon0, east: grid.lon0 + grid.nx * grid.step, south: grid.lat0, north: grid.lat0 + grid.ny * grid.step };
}

/** Without a field: a box around the struck complexes and KL, never smaller than the southern peninsula. */
export function fitBounds(points: { lon: number; lat: number }[], aspect: number): Bounds {
  const lons = points.map((point) => point.lon);
  const lats = points.map((point) => point.lat);
  let west = Math.min(...lons) - 1.2;
  let east = Math.max(...lons) + 1.2;
  let south = Math.min(...lats) - 1.2;
  let north = Math.max(...lats) + 1.2;
  const grow = (low: number, high: number, span: number) => [(low + high) / 2 - span / 2, (low + high) / 2 + span / 2];
  if (east - west < 6) [west, east] = grow(west, east, 6);
  if ((east - west) / (north - south) > aspect) [south, north] = grow(south, north, (east - west) / aspect);
  else [west, east] = grow(west, east, (north - south) * aspect);
  return { west, east, south, north };
}

export interface Projection {
  width: number;
  height: number;
  x(lon: number): number;
  y(lat: number): number;
}

export function project(bounds: Bounds, width: number): Projection {
  const scale = width / (bounds.east - bounds.west);
  return {
    width,
    height: Math.round((bounds.north - bounds.south) * scale),
    x: (lon) => (lon - bounds.west) * scale,
    y: (lat) => (bounds.north - lat) * scale,
  };
}

function ringPath(ring: Float32Array, view: Projection, close: boolean): string {
  let path = "";
  for (let index = 0; index < ring.length; index += 2) path += `${index === 0 ? "M" : "L"}${view.x(ring[index]).toFixed(1)} ${view.y(ring[index + 1]).toFixed(1)}`;
  return close ? `${path}Z` : path;
}

export function coastPaths(basemap: Basemap, view: Projection): { land: string; borders: string } {
  return {
    land: basemap.land.flatMap((rings) => rings.map((ring) => ringPath(ring, view, true))).join(""),
    borders: basemap.borders.map((line) => ringPath(line, view, false)).join(""),
  };
}

export function placeNamed(basemap: Basemap, name: string): { lon: number; lat: number } | null {
  const place = basemap.places.find((item) => item.name === name);
  return place ? { lon: place.lon, lat: place.lat } : null;
}

export function strikePoints(lines: StrikeLine[]): StrikeLine[] {
  // One marker per complex, numbered by the first time the plan attacks it.
  const seen = new Set<string>();
  return [...lines].sort((a, b) => a.order - b.order).filter((line) => !seen.has(line.complexId) && seen.add(line.complexId));
}

/** The field as a picture, one pixel a cell, north up, on the index colours with the map's own wash. */
export function fieldImage(bytes: Uint8Array, grid: VerdictMaps["grid"], stops: Stop[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = grid.nx;
  canvas.height = grid.ny;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(grid.nx, grid.ny);
  const table = Array.from({ length: 256 }, (_, byte) => colourAt(stops, pm25ToApi(byte)));
  for (let row = 0; row < grid.ny; row++) {
    const source = (grid.ny - 1 - row) * grid.nx;
    for (let column = 0; column < grid.nx; column++) {
      const [red, green, blue] = table[bytes[source + column] ?? 0];
      image.data.set([red, green, blue, 225], (row * grid.nx + column) * 4);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/** What the plan removes in each cell, before minus after, never below zero; and the most removed anywhere. */
export function removal(before: Uint8Array, after: Uint8Array): { cells: Float32Array; max: number } {
  const cells = new Float32Array(Math.min(before.length, after.length));
  let max = 0;
  for (let index = 0; index < cells.length; index++) {
    cells[index] = Math.max(0, before[index] - after[index]);
    if (cells[index] > max) max = cells[index];
  }
  return { cells, max };
}

/** The removal as a picture on one hue, clear at zero and solid at the most removed, north up. */
export function removalImage(cells: Float32Array, max: number, grid: VerdictMaps["grid"], rgb: Rgb): string {
  const canvas = document.createElement("canvas");
  canvas.width = grid.nx;
  canvas.height = grid.ny;
  const context = canvas.getContext("2d");
  if (!context || max <= 0) return "";
  const image = context.createImageData(grid.nx, grid.ny);
  for (let row = 0; row < grid.ny; row++) {
    const source = (grid.ny - 1 - row) * grid.nx;
    for (let column = 0; column < grid.nx; column++) {
      // The maps store whole ug/m3, so a difference of one can be rounding alone: it is left clear rather than speckling the sea.
      const value = cells[source + column] ?? 0;
      const share = value <= 1 ? 0 : value / max;
      image.data.set([rgb[0], rgb[1], rgb[2], Math.round(235 * Math.sqrt(share))], (row * grid.nx + column) * 4);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Markers pushed apart until none sits closer than `gap` to another, each
 * remembering where it belongs so a short leader can point back. A few rounds
 * of pairwise repulsion: the points are a handful of strikes, not a crowd.
 */
export function fanOut(points: { x: number; y: number }[], gap: number): { x: number; y: number; atX: number; atY: number }[] {
  const placed = points.map((point) => ({ x: point.x, y: point.y, atX: point.x, atY: point.y }));
  for (let round = 0; round < 40; round++) {
    let moved = false;
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const dx = placed[b].x - placed[a].x;
        const dy = placed[b].y - placed[a].y;
        const distance = Math.hypot(dx, dy);
        if (distance >= gap) continue;
        // Coincident points part along a fixed diagonal, so the result does not depend on chance.
        const [ux, uy] = distance < 1e-6 ? [Math.SQRT1_2, -Math.SQRT1_2] : [dx / distance, dy / distance];
        const push = (gap - distance) / 2 + 0.01;
        placed[a].x -= ux * push;
        placed[a].y -= uy * push;
        placed[b].x += ux * push;
        placed[b].y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return placed;
}
