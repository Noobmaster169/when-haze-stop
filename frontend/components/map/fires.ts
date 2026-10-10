import type { FireCell } from "@/lib/api/haze-schemas";

import type { MapData } from "./map-data";

/**
 * The fires burning at a moment of the timeline. A cell is drawn from the day
 * it was seen until two days later, at the strongest it was in that time: the
 * satellites pass a few times a day and cloud hides a fire that is still there.
 * A forecast hour shows the fires the run knew of. A past day is served with
 * its own fires and nothing else, so it shows those.
 */

const DAY_MS = 86_400_000;
const REACH_DAYS = 2;

export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

const drawn = new WeakMap<MapData, { day: string; cells: FireCell[] }>();

export function firesAt(data: MapData, at: number): FireCell[] {
  if (data.firesByDay.size === 0) return data.fires;
  const moment = Math.min(at, data.asOf);
  const day = utcDay(moment);
  // The marks are repainted on every pan and zoom, and the answer only changes at midnight.
  const kept = drawn.get(data);
  if (kept?.day === day) return kept.cells;
  const strongest = new Map<string, FireCell>();
  for (let back = 0; back <= REACH_DAYS; back++) {
    for (const cell of data.firesByDay.get(utcDay(moment - back * DAY_MS)) ?? []) {
      const key = `${cell.lat},${cell.lon}`;
      const seen = strongest.get(key);
      if (!seen || cell.frpMw > seen.frpMw) strongest.set(key, cell);
    }
  }
  const cells = [...strongest.values()];
  drawn.set(data, { day, cells });
  return cells;
}
