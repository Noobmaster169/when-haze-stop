import { distanceKm } from "./grid";

/**
 * Takes the lone fire dots off the map: a burning cell with no other burning
 * cell within 25 km on the same day.
 *
 * Haze comes from fire complexes, dozens of cells burning together in
 * Sumatra and Kalimantan. A cell burning alone far from any other is a small
 * burn or heat the other screens missed, and on a regional map it reads as a
 * fire that matters. Measured on every day from 1 July to 10 October 2026,
 * this takes 55% of the dots in Malaysia and 7.6% in Indonesia, where they
 * carried 3.1% of the fire power.
 *
 * Display only: the model still burns every cell the screens kept.
 */

export const STRAY_KM = 25;

export interface DayPoint {
  day: string;
  lat: number;
  lon: number;
}

/** A quarter degree is about 28 km, wider than the reach, so a dot's neighbours are in its own bucket or the eight around it. */
const BUCKET = 0.25;

function bucketOf(day: string, row: number, column: number): string {
  return `${day}|${row}|${column}`;
}

/** The dots of `shown` that have at least one other burning cell of `all` within STRAY_KM on their day. */
export function withoutStrays<T extends DayPoint>(shown: T[], all: DayPoint[]): T[] {
  const buckets = new Map<string, DayPoint[]>();
  for (const point of all) {
    const key = bucketOf(point.day, Math.floor(point.lat / BUCKET), Math.floor(point.lon / BUCKET));
    const list = buckets.get(key);
    if (list) list.push(point);
    else buckets.set(key, [point]);
  }
  return shown.filter((dot) => {
    const row = Math.floor(dot.lat / BUCKET);
    const column = Math.floor(dot.lon / BUCKET);
    for (let dRow = -1; dRow <= 1; dRow++) {
      for (let dColumn = -1; dColumn <= 1; dColumn++) {
        for (const other of buckets.get(bucketOf(dot.day, row + dRow, column + dColumn)) ?? []) {
          // The dot's own cell is in `all` too; only another cell counts.
          const itself = other.lat === dot.lat && other.lon === dot.lon;
          if (!itself && distanceKm(dot.lat, dot.lon, other.lat, other.lon) <= STRAY_KM) return true;
        }
      }
    }
    return false;
  });
}
