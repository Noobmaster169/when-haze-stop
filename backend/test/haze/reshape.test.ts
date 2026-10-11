import { describe, expect, it } from "vitest";

import { apiToPm25 } from "../../src/haze/api-index";
import { addHours } from "../../src/haze/grid";
import { localDay, type ModelDay } from "../../src/haze/outlook";
import { daySlices, DEFAULT_PEAK_HOUR_UTC, peakHourOf, PROVEN_HOURS, reshapeToLearned } from "../../src/haze/reshape";
import { LAST_HOUR, READINGS } from "../fixtures/recorded";
import { RECORDED_ISSUE } from "../fixtures/recorded-model-issue";

/**
 * The recorded Seremban hours, in ug/m3, tiled to the run's 84 hour horizon
 * from the recorded week's last hour: the only recorded hourly shape at hand,
 * at the level the learned rows were issued against. The run is at 11:00
 * Malaysian time, so today has exactly the twelve proven hours left.
 */
const HORIZON = 84;
const SEREMBAN = READINGS.filter((reading) => reading.stationId === "CA24N").map((reading) => apiToPm25(reading.api));
const HOURLY = Array.from({ length: HORIZON }, (_, index) => SEREMBAN[index % SEREMBAN.length]);

/** The recorded rows stand in for blended ones here: reshape does not care which band it is handed. */
const LEARNED: ReadonlyMap<string, ModelDay> = new Map(RECORDED_ISSUE.filter((row) => row.instrumentId === "CA24N").map((row) => [row.day, { p10: row.p10, p50: row.p50, p90: row.p90 }]));
const DAYS = [...LEARNED.keys()];
const rowOf = (day: string, rows: ReadonlyMap<string, ModelDay> = LEARNED): ModelDay => rows.get(day) as ModelDay;

/**
 * Seremban read above every learned median, so the line comes down into the
 * days and is held at their medians. The straight runs are seen whole on a
 * rising case: the same hours at six tenths, below every median, and the
 * same three rows in rising order.
 */
const LOW = HOURLY.map((value) => value * 0.6);
const RISING: ReadonlyMap<string, ModelDay> = new Map(DAYS.map((day, index) => [day, rowOf(DAYS[DAYS.length - 1 - index])]));

const dayOf = (index: number): string => localDay(addHours(LAST_HOUR, index + 1));
const indicesOf = (day: string): number[] => HOURLY.map((_, index) => index).filter((index) => dayOf(index) === day);
const sliceOf = (series: number[], day: string): number[] => indicesOf(day).map((index) => series[index]);
const malaysianHour = (index: number): number => (addHours(LAST_HOUR, index + 1).getUTCHours() + 8) % 24;
const indexAt = (day: string, hour: number): number => indicesOf(day).find((index) => malaysianHour(index) === hour) ?? -1;

/** A smoke series that peaks every afternoon at 15:00, a test vector with a shape worked out by hand, not data. */
const AFTERNOON = HOURLY.map((_, index) => 30 * Math.exp(-(((malaysianHour(index) - 15) / 3) ** 2)));
const FLAT = HOURLY.map(() => 0);

/** Asserts the values at `from` to `to` sit on one straight line. */
function expectStraight(series: number[], from: number, to: number): void {
  expect(to).toBeGreaterThan(from);
  const step = (series[to] - series[from]) / (to - from);
  for (let index = from; index <= to; index++) expect(series[index]).toBeCloseTo(series[from] + step * (index - from), 6);
}

describe("the day slices", () => {
  it("cuts the series at Malaysian midnight and knows the hour each day starts", () => {
    const slices = daySlices(LAST_HOUR, HORIZON);
    expect(slices.map((slice) => slice.day)).toEqual([localDay(LAST_HOUR), ...DAYS]);
    expect(slices[0]).toMatchObject({ first: 0, last: PROVEN_HOURS - 1, firstUtcHour: 4 });
    expect(slices[1]).toMatchObject({ first: PROVEN_HOURS, last: PROVEN_HOURS + 23, firstUtcHour: 16 });
  });
});

describe("the hour a day peaks", () => {
  const slices = daySlices(LAST_HOUR, HORIZON);
  const tomorrow = slices[1];

  it("is the simulation's hour when the smoke varies by at least 1 ug/m3 over the day", () => {
    const physics = sliceOf(AFTERNOON, tomorrow.day);
    expect(peakHourOf(physics, tomorrow)).toBe(indexAt(tomorrow.day, 15));
  });

  it("is 09:00 Malaysian time when the smoke is flat", () => {
    expect(DEFAULT_PEAK_HOUR_UTC).toBe(1);
    expect(peakHourOf(sliceOf(FLAT, tomorrow.day), tomorrow)).toBe(indexAt(tomorrow.day, 9));
    expect(peakHourOf(sliceOf(AFTERNOON, tomorrow.day).map((value) => value / 100), tomorrow)).toBe(indexAt(tomorrow.day, 9));
  });

  it("is the day's first hour when 09:00 is not in the slice", () => {
    const partial = { ...tomorrow, first: indexAt(tomorrow.day, 10), last: tomorrow.last, firstUtcHour: 2 };
    expect(peakHourOf(FLAT.slice(partial.first, partial.last + 1), partial)).toBe(partial.first);
  });
});

describe("smoothing the hourly line onto the blended days", () => {
  it("returns the hourly series untouched when nothing was learned", () => {
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: AFTERNOON, learned: new Map() });
    expect(out).toEqual(HOURLY);
    expect(out).not.toBe(HOURLY);
  });

  it("leaves the twelve proven hours exactly as the hourly forecast had them", () => {
    for (const physics of [AFTERNOON, FLAT, null]) {
      const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics, learned: LEARNED });
      expect(out.slice(0, PROVEN_HOURS)).toEqual(HOURLY.slice(0, PROVEN_HOURS));
    }
  });

  it("runs straight from the twelfth hour to the first day's peak, and peaks each day at its median", () => {
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: LOW, physics: AFTERNOON, learned: RISING });
    expect(DAYS).toHaveLength(3);
    expectStraight(out, PROVEN_HOURS - 1, indexAt(DAYS[0], 15));
    expect(out[indexAt(DAYS[0], 15)]).toBeGreaterThan(out[PROVEN_HOURS - 1]);
    for (const day of DAYS) {
      const line = sliceOf(out, day);
      expect(Math.max(...line)).toBeCloseTo(rowOf(day, RISING).p50, 2);
      expect(out[indexAt(day, 15)]).toBeCloseTo(rowOf(day, RISING).p50, 2);
      expect(line.every((value) => value <= rowOf(day, RISING).p50 + 1e-9)).toBe(true);
      // After the peak the simulation's shape, which stops at p10; before it the straight run rises from the day before.
      const afterPeak = line.slice(indicesOf(day).indexOf(indexAt(day, 15)));
      expect(Math.min(...afterPeak)).toBeGreaterThanOrEqual(rowOf(day, RISING).p10 - 1e-9);
    }
  });

  it("runs straight from each day's last hour to the next day's peak", () => {
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: LOW, physics: AFTERNOON, learned: RISING });
    const [first, second, third] = DAYS;
    expectStraight(out, indicesOf(first).at(-1) ?? -1, indexAt(second, 15));
    expectStraight(out, indicesOf(second).at(-1) ?? -1, indexAt(third, 15));
    // After the peak the simulation's shape, so the evening falls below the afternoon.
    expect(out[indexAt(second, 23)]).toBeLessThan(out[indexAt(second, 15)] - 1);
  });

  it("peaks at 09:00 Malaysian time and lies flat at the median after it when no smoke reaches the station", () => {
    const zeros = reshapeToLearned({ asOf: LAST_HOUR, hourly: LOW, physics: FLAT, learned: RISING });
    const unknown = reshapeToLearned({ asOf: LAST_HOUR, hourly: LOW, physics: null, learned: RISING });
    expect(unknown).toEqual(zeros);
    expectStraight(zeros, PROVEN_HOURS - 1, indexAt(DAYS[0], 9));
    for (const day of DAYS) {
      const nine = indexAt(day, 9);
      for (let index = nine; index <= (indicesOf(day).at(-1) ?? -1); index++) expect(zeros[index]).toBeCloseTo(rowOf(day, RISING).p50, 6);
      expectStraight(zeros, indicesOf(day).at(0) ?? -1, nine);
      expect(Math.max(...sliceOf(zeros, day))).toBeCloseTo(rowOf(day, RISING).p50, 2);
    }
  });

  it("never lets a day rise above its median when the line comes down from a higher level", () => {
    // Seremban's 116 ug/m3 is above every median, so each straight run descends and is held at the day's median.
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: FLAT, learned: LEARNED });
    expect(HOURLY[PROVEN_HOURS - 1]).toBeGreaterThan(rowOf(DAYS[0]).p50);
    for (const day of DAYS) {
      const line = sliceOf(out, day);
      expect(Math.max(...line)).toBeCloseTo(rowOf(day).p50, 6);
      expect(line[0]).toBeCloseTo(rowOf(day).p50, 6);
      expect(out[indexAt(day, 9)]).toBeCloseTo(rowOf(day).p50, 6);
    }
    // Today's hours after the twelfth are not a learned day, so the descent is seen there.
    expect(out.slice(0, PROVEN_HOURS)).toEqual(HOURLY.slice(0, PROVEN_HOURS));
  });

  it("leaves a day past the last row on the hourly forecast", () => {
    const [first] = DAYS;
    const onlyFirst = new Map([[first, rowOf(first)]]);
    const out = reshapeToLearned({ asOf: LAST_HOUR, hourly: HOURLY, physics: AFTERNOON, learned: onlyFirst });
    expect(sliceOf(out, DAYS[1])).toEqual(sliceOf(HOURLY, DAYS[1]));
    expect(sliceOf(out, DAYS[2])).toEqual(sliceOf(HOURLY, DAYS[2]));
    expect(Math.max(...sliceOf(out, first))).toBeCloseTo(rowOf(first).p50, 2);
  });
});
