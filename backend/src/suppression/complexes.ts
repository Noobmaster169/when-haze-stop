import { distanceKm } from "../haze/grid";
import { PEAT_PERSISTENCE_DAYS, PEAT_SHARE } from "./scenarios";

/**
 * From burning cells to fire complexes: what a task force is actually sent to.
 *
 * A satellite detection is a 375 m pixel and nobody is sent to a pixel. The
 * strongest cell not yet taken seeds a complex and takes every free cell
 * within RADIUS_KM, so a complex is never wider than a day's drive across.
 * Single linkage was tried first and chained all of Central Kalimantan into
 * one 780-cell complex (docs/council/01-spike-attribution.md).
 */

export const RADIUS_KM = 15;
/**
 * Mean fire power of one VIIRS detection, MW: NOAA-20 over 3 to 10 October
 * 2026 averaged 6.1 on Borneo and 7.8 on Sumatra. Used only where the
 * detections themselves are not known.
 */
export const MW_PER_DETECTION = 7;

/** A 0.1 degree cell burning at its recent daily mean. */
export interface BurningCell {
  lat10: number;
  lon10: number;
  frpMw: number;
}

export interface CellFacts {
  /** Days the cell burned of the last 30. */
  daysBurning(lat10: number, lon10: number): number;
  /** Detections and night detections in the newest satellite files, or null where none were seen. */
  detections(lat10: number, lon10: number): { all: number; night: number } | null;
  /** Share of the cell on the peat map, 0 to 1. */
  peatShare(lat10: number, lon10: number): number;
}

/** Where a complex is, for people and for the rules: who may work there and whose consent it needs. */
export interface Place {
  /** The nearest named place: "near Pulang Pisau". */
  name: string;
  province: string;
  country: "Malaysia" | "Indonesia" | "Brunei" | "Singapore" | "Thailand";
  /** The landmass the mandate rules use. */
  area: "sumatra" | "kalimantan" | "peninsula" | "malaysian_borneo" | "other";
}

export interface Complex {
  id: string;
  place: Place;
  lat: number;
  lon: number;
  cells: { lat10: number; lon10: number }[];
  /** Daily fire power, MW, summed over the cells. */
  firePowerMw: number;
  /** Detections a day: counted where the files saw them, else estimated from fire power. */
  detections: number;
  /** The longest any cell has burned of the last 30 days. */
  persistenceDays: number;
  /** Share of detections at night, null where no detection was seen. Smouldering peat burns through the night. */
  nightShare: number | null;
  peatShare: number;
  /** Peat by the map or by smouldering for a week or more; decides which rates apply. */
  peat: boolean;
}

const centre = (cell: { lat10: number; lon10: number }) => ({ lat: cell.lat10 / 10 + 0.05, lon: cell.lon10 / 10 + 0.05 });

/** Which cells belong together, strongest seed first. Every cell lands in exactly one group. */
export function groupCells(cells: BurningCell[], radiusKm = RADIUS_KM): BurningCell[][] {
  const order = [...cells].sort((a, b) => b.frpMw - a.frpMw || a.lat10 - b.lat10 || a.lon10 - b.lon10);
  const taken = new Set<BurningCell>();
  const groups: BurningCell[][] = [];
  for (const seed of order) {
    if (taken.has(seed)) continue;
    const at = centre(seed);
    const group = order.filter((cell) => {
      if (taken.has(cell)) return false;
      const here = centre(cell);
      return distanceKm(at.lat, at.lon, here.lat, here.lon) <= radiusKm;
    });
    for (const cell of group) taken.add(cell);
    groups.push(group);
  }
  return groups;
}

function describe(group: BurningCell[], facts: CellFacts, placeOf: (lat: number, lon: number) => Place): Omit<Complex, "id"> {
  const firePowerMw = group.reduce((sum, cell) => sum + cell.frpMw, 0);
  // Weighted by fire power, so the centre sits where the burning is.
  const lat = group.reduce((sum, cell) => sum + centre(cell).lat * cell.frpMw, 0) / firePowerMw;
  const lon = group.reduce((sum, cell) => sum + centre(cell).lon * cell.frpMw, 0) / firePowerMw;
  const seen = group.map((cell) => facts.detections(cell.lat10, cell.lon10)).filter((count) => count !== null);
  const counted = seen.reduce((sum, count) => sum + count.all, 0);
  const night = seen.reduce((sum, count) => sum + count.night, 0);
  const peatShare = group.reduce((sum, cell) => sum + facts.peatShare(cell.lat10, cell.lon10), 0) / group.length;
  const persistenceDays = Math.max(...group.map((cell) => facts.daysBurning(cell.lat10, cell.lon10)));
  return {
    place: placeOf(lat, lon),
    lat,
    lon,
    cells: group.map(({ lat10, lon10 }) => ({ lat10, lon10 })),
    firePowerMw,
    detections: counted > 0 ? counted : firePowerMw / MW_PER_DETECTION,
    persistenceDays,
    nightShare: counted > 0 ? night / counted : null,
    peatShare,
    peat: peatShare >= PEAT_SHARE || persistenceDays >= PEAT_PERSISTENCE_DAYS,
  };
}

/** The complexes, strongest first, named C01, C02 and on in that order. */
export function findComplexes(cells: BurningCell[], facts: CellFacts, placeOf: (lat: number, lon: number) => Place, radiusKm = RADIUS_KM): Complex[] {
  const burning = cells.filter((cell) => cell.frpMw > 0);
  const described = groupCells(burning, radiusKm).map((group) => describe(group, facts, placeOf));
  described.sort((a, b) => b.firePowerMw - a.firePowerMw);
  const width = Math.max(2, String(described.length).length);
  return described.map((complex, index) => ({ id: `C${String(index + 1).padStart(width, "0")}`, ...complex }));
}

/** Each cell's mean daily fire power over the given days, the rate the engine carries a cell forward at. */
export function recentCells(days: { day: string; lat10: number; lon10: number; frpMw: number }[]): BurningCell[] {
  const dayCount = new Set(days.map((cell) => cell.day)).size;
  if (dayCount === 0) return [];
  const sums = new Map<string, BurningCell>();
  for (const cell of days) {
    const key = `${cell.lat10}|${cell.lon10}`;
    const sum = sums.get(key) ?? { lat10: cell.lat10, lon10: cell.lon10, frpMw: 0 };
    sum.frpMw += cell.frpMw;
    sums.set(key, sum);
  }
  return [...sums.values()].map((cell) => ({ ...cell, frpMw: cell.frpMw / dayCount }));
}

/** Complexes whose nearest cells lie within `km` of each other: unsuppressed fire there can relight this one. */
export function neighbours(complexes: Complex[], km = 10): Map<string, string[]> {
  const near = new Map<string, string[]>(complexes.map((complex) => [complex.id, []]));
  const centres = complexes.map((complex) => complex.cells.map(centre));
  for (let a = 0; a < complexes.length; a++) {
    for (let b = a + 1; b < complexes.length; b++) {
      // Complexes are at most 30 km across; centres this far apart cannot touch.
      if (distanceKm(complexes[a].lat, complexes[a].lon, complexes[b].lat, complexes[b].lon) > 2 * RADIUS_KM + km + 15) continue;
      const touching = centres[a].some((p) => centres[b].some((q) => distanceKm(p.lat, p.lon, q.lat, q.lon) <= km));
      if (!touching) continue;
      near.get(complexes[a].id)!.push(complexes[b].id);
      near.get(complexes[b].id)!.push(complexes[a].id);
    }
  }
  return near;
}
