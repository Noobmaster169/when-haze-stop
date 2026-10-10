import type { AirMonitor, Airport, DatedFireCell, FieldGrid, FireCell, HazeDay, HazeMap, Station, VisibilityReport } from "@/lib/api/haze-schemas";

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
  /** A past day's fires. On the live map the fires change along the timeline and `firesAt` reads them from `firesByDay`. */
  fires: FireCell[];
  /** Each UTC day's fires over the live map's span. Empty on a past day. */
  firesByDay: Map<string, FireCell[]>;
  airports: UnpackedAirport[];
  /** The instruments that measured PM2.5 on a past day. Empty on the live map, where the stations stand for them. */
  monitors: AirMonitor[];
  /** The first instant of the past day the monitors' hours count from, or null on the live map. */
  dayStart: number | null;
}

/** An airport with its report times parsed once, so the layer can find the report for a moment without parsing dates each frame. */
export interface UnpackedAirport extends Airport {
  times: number[];
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
    fires: [],
    firesByDay: byDay(map.fires),
    airports: map.airports.map(unpackAirport),
    monitors: [],
    dayStart: null,
  };
}

function byDay(fires: DatedFireCell[]): Map<string, FireCell[]> {
  const days = new Map<string, FireCell[]>();
  for (const fire of fires) days.set(fire.day, [...(days.get(fire.day) ?? []), fire]);
  return days;
}

function unpackAirport(airport: Airport): UnpackedAirport {
  return { ...airport, times: airport.reports.map((report) => Date.parse(report.at)) };
}

/** A report older than this is not what the airport is seeing at a moment. */
const REPORT_STALE_MS = 3 * 3_600_000;

/** The newest report at or before a moment, or null when the airport had said nothing for three hours by then. */
export function visibilityAt(airport: UnpackedAirport, at: number): VisibilityReport | null {
  let found = -1;
  for (let index = 0; index < airport.times.length && airport.times[index] <= at; index++) found = index;
  if (found < 0 || at - airport.times[found] > REPORT_STALE_MS) return null;
  return airport.reports[found];
}

const HOUR_MS = 3_600_000;

/** What an instrument measured in the hour a moment falls in, ug/m3, or null where it measured nothing then. */
export function pm25At(monitor: AirMonitor, dayStart: number, at: number): number | null {
  const slot = Math.min(monitor.pm25.length - 1, Math.max(0, Math.ceil((at - dayStart) / HOUR_MS) - 1));
  return monitor.pm25[slot];
}

/**
 * A past day in the same shape. `fields` is empty for a day before the first
 * readings, and no station is given: a station's forecast belongs to the live
 * map. What was measured that day is in `monitors` and `airports`.
 */
export function unpackDay(day: HazeDay): MapData {
  const dayStart = Date.parse(`${day.day}T00:00:00Z`);
  return {
    grid: day.grid,
    windGrid: day.windGrid,
    asOf: dayStart + 86_400_000,
    times: day.frames.map((frame) => Date.parse(frame.validAt)),
    fields: day.frames.map((frame) => decodeBytes(frame.field)),
    windTimes: day.wind.map((frame) => Date.parse(frame.validAt)),
    winds: day.wind.map((frame) => new Int8Array(decodeBytes(frame.uv).buffer)),
    stations: [],
    fires: day.fires,
    firesByDay: new Map(),
    airports: day.airports.map(unpackAirport),
    monitors: day.monitors,
    dayStart,
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
