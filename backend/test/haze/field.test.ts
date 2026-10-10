import { describe, expect, it } from "vitest";

import { sampleAt } from "../../src/haze/field";
import { correctToPoints, mergeByCell } from "../../src/haze/field-points";
import { cellCentre, distanceKm, FIELD, FIELD_CELLS } from "../../src/haze/grid";
import { RECORDED_ISSUE } from "../fixtures/recorded-model-issue";
import { STATIONS } from "../fixtures/recorded";

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

  it("reads back every target of a cluster of real instruments with very different values, and leaves 400 km alone", () => {
    // The recorded issue's instruments for 11 October, at their stored positions: Petaling Jaya, Seremban and KLIA
    // lie 20 to 60 km apart in the Klang Valley, Singapore Central and the Tambulaung sensor in Sabah far off.
    const positions = new Map<string, { lat: number; lon: number }>([
      ...STATIONS.map((station) => [station.id, { lat: station.lat, lon: station.lon }] as const),
      ["SGCENTRAL", { lat: 1.35735, lon: 103.82 }],
      ["WMKK", { lat: 2.747, lon: 101.714 }],
      ["openaq:12488751", { lat: 6.226897, lon: 116.451696 }],
    ]);
    const points = RECORDED_ISSUE.filter((row) => row.day === "2026-10-11").flatMap((row) => {
      const at = positions.get(row.instrumentId);
      return at ? [{ ...at, pm25: row.p50 }] : [];
    });
    expect(points).toHaveLength(5);
    const targets = points.map((point) => point.pm25);
    expect(Math.max(...targets) - Math.min(...targets)).toBeGreaterThan(60);
    const corrected = correctToPoints(flat(), points);
    for (const point of points) expect(Math.abs(sampleAt(corrected, point.lat, point.lon) - point.pm25)).toBeLessThan(1);
    const far = [...Array(FIELD_CELLS).keys()].find((cell) => {
      const at = cellCentre(cell);
      const nearest = Math.min(...points.map((point) => distanceKm(at.lat, at.lon, point.lat, point.lon)));
      return nearest > 400 && nearest < 420;
    });
    if (far === undefined) throw new Error("no cell 400 km from every point");
    expect(Math.abs(corrected[far] - LEVEL)).toBeLessThan(1);
  });

  it("merges points that share a cell into one at their mean", () => {
    const merged = mergeByCell([
      { lat: centre.lat, lon: centre.lon, pm25: 50 },
      { lat: centre.lat + 0.01, lon: centre.lon + 0.01, pm25: 70 },
      { lat: centre.lat + 1, lon: centre.lon, pm25: 10 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ pm25: 60 });
    expect(merged[0].lat).toBeCloseTo(centre.lat + 0.005, 6);
  });

  it("skips a point outside the region and does not throw", () => {
    const field = flat();
    const outside = { lat: 20, lon: 130, pm25: 500 };
    expect(correctToPoints(field, [outside])).toEqual(field);
    const inside = { lat: centre.lat, lon: centre.lon, pm25: LEVEL + 20 };
    expect(correctToPoints(field, [inside, outside])).toEqual(correctToPoints(field, [inside]));
  });
});
