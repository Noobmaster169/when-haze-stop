import { cellCentre, cellsWithin, FIELD_CELLS } from "./grid";

/**
 * Smoke near a place, averaged over the last day.
 *
 * The API a station reports is built on a 24 hour running average, and a
 * station breathes the air of its district rather than of one grid cell. So
 * the quantity compared with a reading is the mass within 50 km, averaged over
 * the 24 hours ending at that hour.
 */

export const REACH_KM = 50;
const DAY = 24;

export interface Smoke {
  /** The day-mean smoke within reach of each given cell list, at one hour. */
  near(cells: number[], hour: number): number;
  /** The same for every field cell at one hour. */
  everywhere(hour: number): Float32Array;
}

export function smokeFrom(mass: Float32Array, hours: number): Smoke {
  // A running total per cell, so the mean over any 24 hours is one subtraction.
  const total = new Float32Array((hours + 1) * FIELD_CELLS);
  for (let hour = 0; hour < hours; hour++) {
    const from = hour * FIELD_CELLS;
    const to = from + FIELD_CELLS;
    for (let cell = 0; cell < FIELD_CELLS; cell++) total[to + cell] = total[from + cell] + mass[from + cell];
  }
  const dayMean = (cell: number, hour: number): number => {
    const first = Math.max(0, hour + 1 - DAY);
    return (total[(hour + 1) * FIELD_CELLS + cell] - total[first * FIELD_CELLS + cell]) / (hour + 1 - first);
  };

  let neighbours: number[][] | undefined;
  return {
    near(cells, hour) {
      let sum = 0;
      for (const cell of cells) sum += dayMean(cell, hour);
      return sum;
    },
    everywhere(hour) {
      neighbours ??= Array.from({ length: FIELD_CELLS }, (_, cell) => {
        const centre = cellCentre(cell);
        return cellsWithin(centre.lat, centre.lon, REACH_KM);
      });
      const mean = new Float32Array(FIELD_CELLS);
      for (let cell = 0; cell < FIELD_CELLS; cell++) mean[cell] = dayMean(cell, hour);
      const out = new Float32Array(FIELD_CELLS);
      for (let cell = 0; cell < FIELD_CELLS; cell++) {
        let sum = 0;
        for (const other of neighbours[cell]) sum += mean[other];
        out[cell] = sum;
      }
      return out;
    },
  };
}
