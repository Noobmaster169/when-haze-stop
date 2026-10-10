import { PEAT_CELLS } from "./peat-data";

/**
 * How much of a 0.1 degree cell is peat, from the bundled PEATMAP grid. Read
 * from memory: the grid is small and never changes between runs.
 */

const SHARE = new Map(PEAT_CELLS.map(([lat10, lon10, percent]) => [`${lat10}|${lon10}`, percent / 100]));

/** Share of the cell on peat, 0 to 1; 0 for a cell the map shows no peat in. */
export function peatShare(lat10: number, lon10: number): number {
  return SHARE.get(`${lat10}|${lon10}`) ?? 0;
}
