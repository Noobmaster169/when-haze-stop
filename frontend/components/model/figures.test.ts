import { describe, expect, it } from "vitest";

import { MODEL_PERFORMANCE } from "@/lib/model-performance";

import { panelSets, withinShare } from "./figures";

describe("withinShare", () => {
  it("reads the published within-20 share back off the histogram", () => {
    const share = withinShare(MODEL_PERFORMANCE.errorHistogram, 20, "model");
    expect(share).toBeCloseTo(MODEL_PERFORMANCE.overall.all.within20, 2);
  });

  it("counts only the bins that start below the limit", () => {
    const bins = [
      { low: 0, model: 3, noChange: 1 },
      { low: 5, model: 1, noChange: 3 },
    ];
    expect(withinShare(bins, 5, "model")).toBe(0.75);
    expect(withinShare(bins, 5, "noChange")).toBe(0.25);
  });
});

describe("panelSets", () => {
  const sets = panelSets(MODEL_PERFORMANCE.stations);

  it("draws every instrument exactly once", () => {
    const drawn = [sets.singapore, sets.doe, sets.sensors].flatMap((set) => set?.groups.flatMap((group) => group.stations) ?? []);
    expect(drawn).toHaveLength(MODEL_PERFORMANCE.instruments);
  });

  it("gives each set a scale of whole fifties that holds every value", () => {
    for (const set of [sets.singapore, sets.doe, sets.sensors]) {
      if (!set) continue;
      expect(set.top % 50).toBe(0);
      const highest = Math.max(...set.groups.flatMap((group) => group.stations.flatMap((station) => station.rows.map((row) => row.high))));
      expect(set.top).toBeGreaterThanOrEqual(highest);
    }
  });

  it("groups the DOE stations by state", () => {
    for (const group of sets.doe?.groups ?? []) {
      for (const station of group.stations) expect(station.state).toBe(group.title);
    }
  });
});
