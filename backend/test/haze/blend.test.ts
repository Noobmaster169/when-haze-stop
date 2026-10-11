import { describe, expect, it } from "vitest";

import { addHours } from "../../src/haze/grid";
import { BLEND_WEIGHT, blendDay, blendWithSeries } from "../../src/haze/blend";
import { localDay, type ModelDay } from "../../src/haze/outlook";
import { LAST_HOUR } from "../fixtures/recorded";
import { RECORDED_ISSUE } from "../fixtures/recorded-model-issue";

const SEREMBAN: ReadonlyMap<string, ModelDay> = new Map(RECORDED_ISSUE.filter((row) => row.instrumentId === "CA24N").map((row) => [row.day, { p10: row.p10, p50: row.p50, p90: row.p90 }]));
const TOMORROW = SEREMBAN.get("2026-10-11") as ModelDay;

describe("blending a learned day with the simulation's peak", () => {
  it("centres the band on the equal-weight average and keeps the model's width", () => {
    expect(BLEND_WEIGHT).toBe(0.5);
    const blended = blendDay(TOMORROW, 60);
    expect(blended.p50).toBeCloseTo((TOMORROW.p50 + 60) / 2, 10);
    expect(blended.p90 - blended.p10).toBeCloseTo(TOMORROW.p90 - TOMORROW.p10, 10);
    expect(blended.p50 - blended.p10).toBeCloseTo(TOMORROW.p50 - TOMORROW.p10, 10);
  });

  it("leaves the row as it is when the simulation agrees with it", () => {
    expect(blendDay(TOMORROW, TOMORROW.p50)).toEqual(TOMORROW);
  });

  it("never goes below zero", () => {
    const blended = blendDay({ p10: 2, p50: 10, p90: 30 }, 0);
    expect(blended).toEqual({ p10: 0, p50: 5, p90: 25 });
  });
});

describe("blending every learned day with an hourly series", () => {
  // Three days of hours from the recorded hour, 84 as the run gives, rising through the week so each day's peak is its last hour.
  const series = Array.from({ length: 84 }, (_, index) => 40 + index);
  const peakOf = (day: string, values: number[] = series): number => Math.max(...values.filter((_, index) => localDay(addHours(LAST_HOUR, index + 1)) === day));

  it("blends each day with that day's peak of the series", () => {
    const blended = blendWithSeries(LAST_HOUR, series, SEREMBAN);
    expect([...blended.keys()]).toEqual([...SEREMBAN.keys()]);
    for (const [day, row] of SEREMBAN) expect(blended.get(day)).toEqual(blendDay(row, peakOf(day)));
    expect(blended.get("2026-10-11")?.p50).not.toBeCloseTo(TOMORROW.p50, 1);
  });

  it("keeps the model's row for a day the series does not reach", () => {
    const short = series.slice(0, 20);
    const blended = blendWithSeries(LAST_HOUR, short, SEREMBAN);
    expect(blended.get("2026-10-11")).toEqual(blendDay(TOMORROW, peakOf("2026-10-11", short)));
    expect(blended.get("2026-10-12")).toEqual(SEREMBAN.get("2026-10-12"));
    expect(blended.get("2026-10-13")).toEqual(SEREMBAN.get("2026-10-13"));
  });

  it("returns an empty map for nothing learned", () => {
    expect(blendWithSeries(LAST_HOUR, series, new Map()).size).toBe(0);
  });
});
