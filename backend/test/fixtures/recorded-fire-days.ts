import type { FireCellDay } from "../../src/haze/fires";

/**
 * Burning cells of 9 October 2026 as stored from NASA FIRMS after the fire
 * screens: seven cells of one complex in Central Kalimantan around 2.9S
 * 113.0E, and one cell burning alone in Sarawak at 3.45N 113.75E, 56 km from
 * any other that day.
 */
export const KALIMANTAN_COMPLEX: FireCellDay[] = [
  [-30, 1129, 32.65],
  [-30, 1130, 49.3],
  [-30, 1131, 127.2],
  [-29, 1129, 5.18],
  [-29, 1130, 217.22],
  [-28, 1129, 41.6],
  [-28, 1130, 23.21],
].map(([lat10, lon10, frpMw]) => ({ day: "2026-10-09", lat10, lon10, frpMw }));

export const SARAWAK_LONE: FireCellDay = { day: "2026-10-09", lat10: 34, lon10: 1137, frpMw: 14.74 };
