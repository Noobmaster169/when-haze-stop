import { describe, expect, it } from "vitest";

import raw from "./data/model-performance.json";
import { ModelPerformanceSchema } from "./model-performance-schema";

describe("the model performance file", () => {
  it("matches the schema the Model page reads", () => {
    const result = ModelPerformanceSchema.safeParse(raw);
    expect(result.success, result.success ? "" : result.error.message).toBe(true);
  });

  it("holds one change point per scored station-day and a band around every forecast", () => {
    const data = ModelPerformanceSchema.parse(raw);
    expect(data.scatter).toHaveLength(data.stationDays);
    for (const station of data.series) {
      for (const row of station.rows) expect(row.low).toBeLessThanOrEqual(row.high);
    }
  });

  it("names the four stations the page draws", () => {
    const data = ModelPerformanceSchema.parse(raw);
    expect(data.series.map((station) => station.name)).toEqual(["Singapore Central", "Singapore West", "Shah Alam", "Nilai"]);
  });
});
