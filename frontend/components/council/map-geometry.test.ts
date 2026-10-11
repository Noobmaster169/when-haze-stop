import { describe, expect, it } from "vitest";

import { CouncilRun } from "@/lib/api/council-schemas";

import recorded from "./fixtures/council-run-1-run.json";
import { fanOut, fitBounds, gridBounds, project, removal, strikePoints } from "./map-geometry";

/** Run 1 as the api answered it, verdict and all. */
const run = CouncilRun.parse(recorded);

describe("the verdict map", () => {
  it("reads run 1's recorded verdict through the contract", () => {
    expect(run.verdict).not.toBeNull();
    expect(run.verdict?.series.baseline.length).toBe(run.verdict?.series.withPlan.length);
    expect(run.verdict?.maps).toBeNull();
  });

  it("numbers one marker per complex in strike order", () => {
    const points = strikePoints(run.verdict!.strikeList);
    expect(new Set(points.map((point) => point.complexId)).size).toBe(points.length);
    expect(points.map((point) => point.order)).toEqual([...points.map((point) => point.order)].sort((a, b) => a - b));
  });

  it("fits a box around the strikes at the asked shape", () => {
    const points = strikePoints(run.verdict!.strikeList);
    const box = fitBounds(points, 1.6);
    for (const point of points) {
      expect(point.lon).toBeGreaterThan(box.west);
      expect(point.lon).toBeLessThan(box.east);
      expect(point.lat).toBeGreaterThan(box.south);
      expect(point.lat).toBeLessThan(box.north);
    }
    expect((box.east - box.west) / (box.north - box.south)).toBeCloseTo(1.6);
  });

  it("draws the engine's grid edge to edge, north up", () => {
    const box = gridBounds({ lon0: 96, lat0: -6, step: 0.25, nx: 96, ny: 56 });
    expect(box).toEqual({ west: 96, east: 120, south: -6, north: 8 });
    const view = project(box, 600);
    expect(view.height).toBe(350);
    expect(view.x(96)).toBe(0);
    expect(view.y(8)).toBe(0);
    expect(view.y(-6)).toBeCloseTo(350);
  });

  it("takes what the plan removes cell by cell, never below zero", () => {
    const { cells, max } = removal(Uint8Array.from([120, 60, 5, 0]), Uint8Array.from([117, 60, 9, 0]));
    expect([...cells]).toEqual([3, 0, 0, 0]);
    expect(max).toBe(3);
  });

  it("fans out markers that would sit on each other and leaves the rest alone", () => {
    const placed = fanOut(
      [
        { x: 100, y: 100 },
        { x: 104, y: 103 },
        { x: 300, y: 300 },
      ],
      26,
    );
    expect(Math.hypot(placed[0].x - placed[1].x, placed[0].y - placed[1].y)).toBeGreaterThanOrEqual(26);
    expect(placed[2]).toEqual({ x: 300, y: 300, atX: 300, atY: 300 });
    expect(placed[0]).toMatchObject({ atX: 100, atY: 100 });
    const same = fanOut([{ x: 50, y: 50 }, { x: 50, y: 50 }], 26);
    expect(Math.hypot(same[0].x - same[1].x, same[0].y - same[1].y)).toBeGreaterThanOrEqual(26);
  });
});
