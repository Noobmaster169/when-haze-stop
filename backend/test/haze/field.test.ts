import { describe, expect, it } from "vitest";

import { correctToPoints, sampleAt } from "../../src/haze/field";
import { cellCentre, distanceKm, FIELD, FIELD_CELLS } from "../../src/haze/grid";

/** A flat field, so any change is the correction's alone. */
const LEVEL = 40;
const flat = (): Float32Array => new Float32Array(FIELD_CELLS).fill(LEVEL);

// The cell holding Seremban: row 34, column 23, centred at 2.625N 101.875E.
const SEREMBAN_CELL = 34 * FIELD.nx + 23;
const centre = cellCentre(SEREMBAN_CELL);

describe("sampling the field at a point", () => {
  it("gives the cell's own value at its centre and the mean between two centres", () => {
    const field = flat();
    field[SEREMBAN_CELL] = 60;
    field[SEREMBAN_CELL + 1] = 80;
    expect(sampleAt(field, centre.lat, centre.lon)).toBe(60);
    expect(sampleAt(field, centre.lat, centre.lon + FIELD.step / 2)).toBe(70);
    expect(sampleAt(field, centre.lat, centre.lon + FIELD.step)).toBe(80);
  });

  it("stands the edge cells in for a point on the rim", () => {
    const field = flat();
    field[0] = 10;
    expect(sampleAt(field, -5.99, 96.01)).toBeCloseTo(10, 5);
  });
});

describe("correcting the field to points", () => {
  it("moves a point's own cell to its target and leaves a cell 400 km away alone", () => {
    const field = flat();
    const corrected = correctToPoints(field, [{ lat: centre.lat, lon: centre.lon, pm25: LEVEL + 20 }]);
    expect(Math.abs(corrected[SEREMBAN_CELL] - (LEVEL + 20))).toBeLessThan(0.5);
    expect(Math.abs(sampleAt(corrected, centre.lat, centre.lon) - (LEVEL + 20))).toBeLessThan(0.5);
    const far = SEREMBAN_CELL + 16;
    expect(distanceKm(centre.lat, centre.lon, cellCentre(far).lat, cellCentre(far).lon)).toBeGreaterThan(400);
    expect(Math.abs(corrected[far] - LEVEL)).toBeLessThan(0.5);
    // The input is not written to.
    expect(field[SEREMBAN_CELL]).toBe(LEVEL);
  });

  it("returns the field as it is with no points", () => {
    const field = flat();
    expect(correctToPoints(field, [])).toEqual(field);
  });

  it("skips a point outside the region and does not throw", () => {
    const field = flat();
    const outside = { lat: 20, lon: 130, pm25: 500 };
    expect(correctToPoints(field, [outside])).toEqual(field);
    const inside = { lat: centre.lat, lon: centre.lon, pm25: LEVEL + 20 };
    expect(correctToPoints(field, [inside, outside])).toEqual(correctToPoints(field, [inside]));
  });
});
