import type { FieldGrid, FireCell, HazeMap, Station } from "@/lib/api/haze-schemas";

import { bracket, decodeBytes, sampleField, sampleWind } from "./field";

/** The map response, unpacked once into arrays the drawing code can read every frame without allocating. */
export interface MapData {
  grid: FieldGrid;
  windGrid: FieldGrid;
  /** The newest reading the run saw: the line between what was read and what is forecast. */
  asOf: number;
  times: number[];
  fields: Uint8Array[];
  windTimes: number[];
  winds: Int8Array[];
  stations: Station[];
  fires: FireCell[];
}

export function unpackMap(map: HazeMap): MapData | null {
  if (!map.run || map.frames.length === 0) return null;
  return {
    grid: map.grid,
    windGrid: map.windGrid,
    asOf: Date.parse(map.run.asOf),
    times: map.frames.map((frame) => Date.parse(frame.validAt)),
    fields: map.frames.map((frame) => decodeBytes(frame.field)),
    windTimes: map.wind.map((frame) => Date.parse(frame.validAt)),
    winds: map.wind.map((frame) => new Int8Array(decodeBytes(frame.uv).buffer)),
    stations: map.stations,
    fires: map.fires,
  };
}

/** The index at a point and a moment, blended between the frames either side. */
export function apiAt(data: MapData, at: number, lon: number, lat: number): number {
  const { from, to, share } = bracket(data.times, at);
  const before = sampleField(data.fields[from], data.grid, lon, lat);
  if (from === to) return before;
  return before * (1 - share) + sampleField(data.fields[to], data.grid, lon, lat) * share;
}

/** The smoke-carrying wind at a point and a moment, metres a second. Still air where no wind is stored. */
export function windAt(data: MapData, at: number, lon: number, lat: number): [number, number] {
  if (data.winds.length === 0) return [0, 0];
  const { from, to, share } = bracket(data.windTimes, at);
  const before = sampleWind(data.winds[from], data.windGrid, lon, lat);
  if (from === to) return before;
  const after = sampleWind(data.winds[to], data.windGrid, lon, lat);
  return [before[0] * (1 - share) + after[0] * share, before[1] * (1 - share) + after[1] * share];
}
