import { describe, expect, it } from "vitest";

import { apiToPm25 } from "../../src/haze/api-index";
import { addHours } from "../../src/haze/grid";
import { localDay, type ModelDay } from "../../src/haze/outlook";
import { RAMP_HOURS, reshapeToLearned } from "../../src/haze/reshape";
import { LAST_HOUR, READINGS } from "../fixtures/recorded";
import { RECORDED_ISSUE } from "../fixtures/recorded-model-issue";

/**
 * The recorded Seremban hours, in ug/m3, tiled to the run's 84 hour horizon
 * from the recorded week's last hour: the only recorded hourly shape at hand,
 * at the level the learned rows were issued against.
 */
const HORIZON = 84;
const SEREMBAN = READINGS.filter((reading) => reading.stationId === "CA24N").map((reading) => apiToPm25(reading.api));
const HOURLY = Array.from({ length: HORIZON }, (_, index) => SEREMBAN[index % SEREMBAN.length]);

const LEARNED: ReadonlyMap<string, ModelDay> = new Map(RECORDED_ISSUE.filter((row) => row.instrumentId === "CA24N").map((row) => [row.day, { p10: row.p10, p50: row.p50, p90: row.p90 }]));
const DAYS = [...LEARNED.keys()];

const dayOf = (index: number): string => localDay(addHours(LAST_HOUR, index + 1));
const indicesOf = (day: string): number[] => HOURLY.map((_, index) => index).filter((index) => dayOf(index) === day);
const sliceOf = (series: number[], day: string): number[] => indicesOf(day).map((index) => series[index]);
const malaysianHour = (index: number): number => (addHours(LAST_HOUR, index + 1).getUTCHours() + 8) % 24;

/** A smoke series that peaks every afternoon at 15:00, a test vector with a shape worked out by hand, not data. */
const AFTERNOON = HOURLY.map((_, index) => 30 * Math.exp(-(((malaysianHour(index) - 15) / 3) ** 2)));

/** Smoke that peaks `offset` hours into the first learned day and is flat otherwise. */
function peakingAt(offset: number): number[] {
  const physics = HOURLY.map(() => 2);
  physics[indicesOf(DAYS[0])[offset]] = 40;
  return physics;
}

describe("reshaping the hourly line to the learned peaks", () => {
  it("returns the hourly series untouched when nothing was learned", () => {
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: AFTERNOON, learned: new Map() });
    expect(out).toEqual(HOURLY);
    expect(out).not.toBe(HOURLY);
  });

  it("peaks each learned day at the median, at the simulation's hour, and dips no lower than its tenth percentile", () => {
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: AFTERNOON, learned: LEARNED });
    expect(DAYS).toHaveLength(3);
    for (const day of DAYS) {
      const row = LEARNED.get(day);
      if (!row) throw new Error("no row");
      const line = sliceOf(out, day);
      expect(Math.max(...line)).toBeCloseTo(row.p50, 2);
      expect(Math.min(...line)).toBeGreaterThanOrEqual(row.p10 - 1e-9);
      const at = indicesOf(day).map(malaysianHour);
      expect(line[at.indexOf(15)]).toBeCloseTo(row.p50, 2);
      expect(line[at.indexOf(3)]).toBeLessThan(row.p50 - 1);
    }
  });

  it("leaves today on the hourly forecast", () => {
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: AFTERNOON, learned: LEARNED });
    const today = localDay(LAST_HOUR);
    expect(sliceOf(out, today)).toEqual(sliceOf(HOURLY, today));
    expect(indicesOf(today).length).toBeGreaterThan(0);
  });

  it("gives a flat day at the median where no smoke reaches the station", () => {
    const zeros = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: HOURLY.map(() => 0), learned: LEARNED });
    const unknown = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: null, learned: LEARNED });
    for (const day of DAYS) {
      const p50 = LEARNED.get(day)?.p50 ?? Number.NaN;
      for (const value of sliceOf(zeros, day)) expect(value).toBeCloseTo(p50, 6);
    }
    expect(unknown).toEqual(zeros);
  });

  it("never moves the peak when it falls in the first hours of the first learned day", () => {
    const first = DAYS[0];
    const row = LEARNED.get(first);
    if (!row) throw new Error("no row");
    for (let offset = 0; offset < RAMP_HOURS; offset++) {
      const line = sliceOf(reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: peakingAt(offset), learned: LEARNED }), first);
      expect(line[offset]).toBeCloseTo(row.p50, 2);
      expect(Math.max(...line)).toBeCloseTo(row.p50, 2);
      expect(Math.min(...line)).toBeGreaterThanOrEqual(row.p10 - 1e-9);
      for (let hour = offset + 1; hour < line.length; hour++) expect(line[hour]).toBeLessThan(row.p50);
    }
  });

  it("leaves a day with no learned row on the hourly forecast", () => {
    const [first, second, third] = DAYS;
    const later = new Map([second, third].map((day) => [day, LEARNED.get(day) as ModelDay]));
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: AFTERNOON, learned: later });
    expect(sliceOf(out, first)).toEqual(sliceOf(HOURLY, first));
    expect(Math.max(...sliceOf(out, second))).toBeCloseTo(LEARNED.get(second)?.p50 ?? Number.NaN, 2);
  });

  it("ramps back to the hourly forecast over three hours after the last learned day", () => {
    const [first, second] = DAYS;
    const onlyFirst = new Map([[first, LEARNED.get(first) as ModelDay]]);
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: AFTERNOON, learned: onlyFirst });
    const line = sliceOf(out, second);
    const hourly = sliceOf(HOURLY, second);
    const before = sliceOf(out, first).at(-1) ?? Number.NaN;
    expect(line.slice(RAMP_HOURS)).toEqual(hourly.slice(RAMP_HOURS));
    for (let hour = 0; hour < RAMP_HOURS; hour++) {
      expect(line[hour]).toBeCloseTo(before + ((hourly[RAMP_HOURS] - before) * (hour + 1)) / (RAMP_HOURS + 1), 6);
    }
  });
});
