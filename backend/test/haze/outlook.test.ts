import { describe, expect, it } from "vitest";

import { apiToPm25, pm25ToApi } from "../../src/haze/api-index";
import { chanceAboveBand, firstHindcast } from "../../src/haze/chance";
import { addHours } from "../../src/haze/grid";
import { dayOutlooks, type Hourly, type ModelDay } from "../../src/haze/outlook";

/** 11:00 Malaysian time on 10 October 2026, with a station at 120 and climbing, and a flat hourly forecast of 125. */
const AS_OF = new Date("2026-10-10T03:00:00Z");
const READINGS: Hourly[] = [110, 114, 120].map((api, index) => ({ at: addHours(AS_OF, index - 2), api }));
const FORECAST: Hourly[] = Array.from({ length: 84 }, (_, index) => ({ at: addHours(AS_OF, index + 1), api: 125 }));
const errorsFor = firstHindcast;

describe("the chance from a forecast's own band", () => {
  const band: [number, number, number] = [40, 50, 60];

  it("is the share of the band above the line, straight between the quantiles", () => {
    expect(chanceAboveBand(50, band)).toBe(0.5);
    expect(chanceAboveBand(55, band)).toBe(0.3);
    expect(chanceAboveBand(45, band)).toBe(0.7);
  });

  it("never reaches 0 or 1, even far outside the band", () => {
    expect(chanceAboveBand(30, band)).toBe(0.99);
    expect(chanceAboveBand(100, band)).toBe(0.01);
    expect(chanceAboveBand(50, [50, 50, 50])).toBe(0.5);
  });
});

describe("the day outlook with a learned forecast", () => {
  const learned = new Map<string, ModelDay>([
    ["2026-10-10", { p10: 300, p50: 300, p90: 300 }],
    ["2026-10-11", { p10: 40, p50: 52, p90: 80 }],
  ]);
  const days = dayOutlooks(AS_OF, READINGS, FORECAST, errorsFor, learned);

  it("takes tomorrow's peak and band from the learned forecast, converted to the index", () => {
    const tomorrow = days[1];
    expect(tomorrow.day).toBe("2026-10-11");
    expect(tomorrow.forecastPeak).toBe(Math.round(pm25ToApi(52)));
    expect(tomorrow.low).toBe(Math.round(pm25ToApi(40)));
    expect(tomorrow.high).toBe(Math.round(pm25ToApi(80)));
    expect(tomorrow.forecastPeak).toBe(116);
    expect(tomorrow.chance["150"]).toBe(chanceAboveBand(apiToPm25(150), [40, 52, 80]));
    // Line 150 is 55.4 ug/m3. Between p50 = 52 and p90 = 80 the level goes from 0.5 to 0.9,
    // so the cumulative is 0.5 + 0.4 * (55.4 - 52) / 28 = 0.5486 and the chance above is 0.45.
    expect(tomorrow.chance["150"]).toBeCloseTo(1 - (0.5 + (0.4 * (apiToPm25(150) - 52)) / 28), 2);
    expect(tomorrow.chance["150"]).toBeCloseTo(0.45, 2);
    // Line 200 is 150.4 ug/m3, far above p90 = 80: extrapolated past 1, then clamped.
    expect(tomorrow.chance["200"]).toBe(0.01);
    // Line 100 is 50.4 ug/m3, between p10 = 40 and p50 = 52: cumulative 0.1 + 0.4 * 10.4 / 12 = 0.447.
    expect(tomorrow.chance["100"]).toBeCloseTo(0.55, 2);
  });

  it("leaves today to the readings, however high the learned forecast for it", () => {
    expect(days[0].forecastPeak).toBe(125);
    expect(days[0].chance["100"]).toBe(1);
  });

  it("falls back to the hourly forecast on a day the learned forecast does not cover", () => {
    const without = dayOutlooks(AS_OF, READINGS, FORECAST, errorsFor);
    expect(days[2]).toEqual(without[2]);
    expect(days[2].forecastPeak).toBe(125);
  });
});
