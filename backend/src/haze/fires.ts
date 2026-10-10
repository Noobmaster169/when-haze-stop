import { addHours, hoursBetween, inDomain } from "./grid";
import type { Emission } from "./transport";

/**
 * From satellite detections to what the model burns.
 *
 * Three satellites pass over the same fire, so adding their detections would
 * count it three times. A cell-day keeps the largest of the three sums.
 */

/** One hotspot as a satellite reported it. */
export interface Detection {
  satellite: string;
  lat: number;
  lon: number;
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: string;
  /** UTC hour of the pass. With the satellite and the day it names one overpass. */
  hour: number;
  daytime: boolean;
  /** The 4 micron channel hit its ceiling (367 K). Real fires do this now and then; sun glint does it everywhere it touches. */
  saturated: boolean;
  frpMw: number;
}

/** Fire radiative power in one 0.1 degree cell on one UTC day. */
export interface FireCellDay {
  day: string;
  lat10: number;
  lon10: number;
  frpMw: number;
}

/**
 * A cell-day as it is stored: everything the satellites saw, and the part of
 * it that is confirmed vegetation burning. `burningMw` is null only on a row
 * stored before there was a screen, which says "not screened", not "nothing burns".
 */
export interface StoredCellDay extends FireCellDay {
  burningMw: number | null;
}

/** Pairs each cell-day with what is left of it after the screens: zero where all of it was taken out. */
export function pairCellDays(all: FireCellDay[], burning: FireCellDay[]): StoredCellDay[] {
  const left = new Map(burning.map((cell) => [`${cell.day}|${cell.lat10}|${cell.lon10}`, cell.frpMw]));
  return all.map((cell) => ({ ...cell, burningMw: left.get(`${cell.day}|${cell.lat10}|${cell.lon10}`) ?? 0 }));
}

export function toCellDays(detections: Detection[]): FireCellDay[] {
  const perSatellite = new Map<string, number>();
  for (const hit of detections) {
    if (!inDomain(hit.lat, hit.lon) || !(hit.frpMw > 0)) continue;
    const key = `${hit.day}|${Math.floor(hit.lat * 10)}|${Math.floor(hit.lon * 10)}|${hit.satellite}`;
    perSatellite.set(key, (perSatellite.get(key) ?? 0) + hit.frpMw);
  }
  const best = new Map<string, number>();
  for (const [key, frp] of perSatellite) {
    const cell = key.slice(0, key.lastIndexOf("|"));
    if (frp > (best.get(cell) ?? 0)) best.set(cell, frp);
  }
  return [...best].map(([cell, frpMw]) => {
    const [day, lat10, lon10] = cell.split("|");
    return { day, lat10: Number(lat10), lon10: Number(lon10), frpMw };
  });
}

function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

const PERSISTENCE_DAYS = 3;

/**
 * What burns during a run that starts at `start`, knows the world up to `asOf`
 * and ends `hours` later.
 *
 * Satellites cannot see tomorrow, and today's passes are not all in. So the
 * last complete UTC day is the last one taken as observed, and from then on
 * each cell burns at its mean over the last three observed days.
 */
export function emissionsFor(cells: FireCellDay[], start: Date, asOf: Date, hours: number): Emission[] {
  const lastKnown = utcDay(addHours(new Date(`${utcDay(asOf)}T00:00:00Z`), -24));
  const earliest = utcDay(addHours(start, -24));
  const startHourOf = (day: string): number => hoursBetween(start, new Date(`${day}T00:00:00Z`));
  const emissions: Emission[] = [];

  const recentFrom = utcDay(addHours(new Date(`${lastKnown}T00:00:00Z`), -24 * (PERSISTENCE_DAYS - 1)));
  const recent = new Map<string, number>();
  const recentDays = new Set<string>();
  for (const cell of cells) {
    if (cell.day > lastKnown || cell.day < earliest) continue;
    emissions.push({ startHour: startHourOf(cell.day), lat: cell.lat10 / 10, lon: cell.lon10 / 10, frpMw: cell.frpMw });
    if (cell.day < recentFrom) continue;
    recentDays.add(cell.day);
    const key = `${cell.lat10}|${cell.lon10}`;
    recent.set(key, (recent.get(key) ?? 0) + cell.frpMw);
  }
  if (recentDays.size === 0) return emissions;

  for (let startHour = startHourOf(lastKnown) + 24; startHour < hours; startHour += 24) {
    for (const [key, total] of recent) {
      const [lat10, lon10] = key.split("|").map(Number);
      emissions.push({ startHour, lat: lat10 / 10, lon: lon10 / 10, frpMw: total / recentDays.size });
    }
  }
  return emissions;
}
