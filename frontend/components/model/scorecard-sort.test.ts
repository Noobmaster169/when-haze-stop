import { describe, expect, it } from "vitest";

import { MODEL_PERFORMANCE } from "@/lib/model-performance";

import { sortStations } from "./scorecard-sort";

const stations = MODEL_PERFORMANCE.stations;

describe("sortStations", () => {
  it("starts with DOE stations, then Singapore regions, then sensors, each by name", () => {
    const sorted = sortStations(stations, null, "up");
    const kinds = sorted.map((station) => station.kind);
    expect(kinds.indexOf("nea")).toBe(kinds.lastIndexOf("doe") + 1);
    expect(kinds.indexOf("openaq")).toBe(kinds.lastIndexOf("nea") + 1);
    const doe = sorted.filter((station) => station.kind === "doe").map((station) => station.name);
    expect(doe).toEqual([...doe].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("puts instruments with no crossings last whichever way the column runs", () => {
    for (const direction of ["up", "down"] as const) {
      const sorted = sortStations(stations, "hit150", direction);
      const firstBlank = sorted.findIndex((station) => station.score.hit150 === null);
      expect(sorted.slice(firstBlank).every((station) => station.score.hit150 === null)).toBe(true);
    }
  });

  it("orders a numeric column both ways", () => {
    const up = sortStations(stations, "mae", "up").map((station) => station.score.mae);
    expect(up).toEqual([...up].sort((a, b) => a - b));
    const down = sortStations(stations, "mae", "down").map((station) => station.score.mae);
    expect(down).toEqual([...down].sort((a, b) => b - a));
  });
});
