import { describe, expect, it } from "vitest";

import raw from "./data/model-performance.json";
import { ModelPerformanceSchema } from "./model-performance-schema";

describe("the model performance file", () => {
  it("matches the schema the Model page reads", () => {
    const result = ModelPerformanceSchema.safeParse(raw);
    expect(result.success, result.success ? "" : result.error.message).toBe(true);
  });

  it("fails loudly on a file of the earlier shape", () => {
    const stale = { ...raw, nextDay: {}, series: [] } as unknown;
    expect(ModelPerformanceSchema.safeParse(stale).success).toBe(false);
    const missing: Record<string, unknown> = { ...raw };
    delete missing.stations;
    expect(ModelPerformanceSchema.safeParse(missing).success).toBe(false);
  });

  it("holds one change point, one histogram count and one station row per scored station-day", () => {
    const data = ModelPerformanceSchema.parse(raw);
    expect(data.scatter).toHaveLength(data.stationDays);
    expect(data.overall.all.days).toBe(data.stationDays);
    const sum = (key: "model" | "noChange"): number => data.errorHistogram.reduce((total, bin) => total + bin[key], 0);
    expect(sum("model")).toBe(data.stationDays);
    expect(sum("noChange")).toBe(data.stationDays);
    expect(data.stations.reduce((total, station) => total + station.rows.length, 0)).toBe(data.stationDays);
  });

  it("names every instrument once, with a band around every forecast", () => {
    const data = ModelPerformanceSchema.parse(raw);
    expect(data.stations).toHaveLength(data.instruments);
    expect(new Set(data.stations.map((station) => station.id)).size).toBe(data.instruments);
    for (const station of data.stations) {
      expect(station.score.days).toBe(station.rows.length);
      for (const row of station.rows) expect(row.low).toBeLessThanOrEqual(row.high);
    }
  });

  it("counts the same 150 crossings for every forecast", () => {
    const data = ModelPerformanceSchema.parse(raw);
    const events = Object.values(data.cross150).map((tally) => tally.caught + tally.missed);
    expect(new Set(events).size).toBe(1);
    expect(events[0]).toBe(data.overall.all.events150);
  });
});
