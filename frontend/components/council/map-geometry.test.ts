import { describe, expect, it } from "vitest";

import { CouncilRun } from "@/lib/api/council-schemas";

import recorded from "./fixtures/council-run-1-run.json";
import { fitBounds, gridBounds, project, strikePoints } from "./map-geometry";

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
});
