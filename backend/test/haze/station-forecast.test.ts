import { describe, expect, it } from "vitest";

import { apiToPm25, pm25ToApi } from "../../src/haze/api-index";
import { arrivals, backtest } from "../../src/haze/backtest";
import { scoreByLead } from "../../src/haze/score";
import { carried, FADE, forecastStation, windowSlope } from "../../src/haze/station-forecast";
import { READINGS } from "../fixtures/recorded";

describe("DOE's index and PM2.5", () => {
  it("meets DOE's band edges", () => {
    // API Calculation, APIMS, January 2025: 12.0, 50.4, 55.4, 150.4 and 250.4 ug/m3 close the bands.
    expect(pm25ToApi(12.0)).toBeCloseTo(50);
    expect(pm25ToApi(50.4)).toBeCloseTo(100);
    expect(pm25ToApi(55.4)).toBeCloseTo(150);
    expect(pm25ToApi(150.4)).toBeCloseTo(200);
    expect(pm25ToApi(250.4)).toBeCloseTo(300);
  });

  it("goes there and back", () => {
    for (const api of [0, 37, 99, 115, 151, 182, 240, 480]) expect(pm25ToApi(apiToPm25(api))).toBeCloseTo(api, 6);
  });

  it("crosses 101 to 150 on five micrograms", () => {
    expect(apiToPm25(150) - apiToPm25(101)).toBeLessThan(5);
    expect(apiToPm25(200) - apiToPm25(151)).toBeGreaterThan(90);
  });
});

describe("a station forecast", () => {
  // Kuching on 10 October: 98, 105, 124, 139, 151 over four hours, as haze arrived.
  const kuching = Float32Array.from(READINGS.filter((reading) => reading.stationId === "CA65Q").map((reading) => reading.api));
  const now = kuching.findIndex((api) => api === 151);

  it("starts from the reading, not from the model", () => {
    const api = forecastStation({ readings: kuching, anchorHour: now, now, end: now + 84 });
    expect(api).toHaveLength(84);
    expect(api[0]).toBeGreaterThanOrEqual(151);
    expect(api[0]).toBeLessThan(160);
  });

  it("keeps rising after haze arrives, as the clean hours leave the 24 hour window, then levels off", () => {
    const api = forecastStation({ readings: kuching, anchorHour: now, now, end: now + 84 });
    expect(api[11]).toBeGreaterThan(api[0]);
    expect(api[23]).toBeGreaterThan(api[11]);
    // What has built up by a day is nearly all there will be.
    expect(api[83] - api[23]).toBeLessThan(2);
    expect(apiToPm25(api[83]) - apiToPm25(151)).toBeCloseTo(windowSlope(kuching, now) * (FADE / (1 - FADE)), 0);
  });

  it("is no change where the index has been flat", () => {
    const flat = Float32Array.from([170, 170, 170, 170, 170]);
    const api = forecastStation({ readings: flat, anchorHour: 4, now: 4, end: 30 });
    expect(Math.max(...api) - Math.min(...api)).toBeLessThan(0.01);
    expect(api[0]).toBeCloseTo(170, 4);
  });

  it("starts from a late station's own last reading", () => {
    const late = Float32Array.from([...kuching.subarray(0, now + 1), NaN, NaN]);
    const api = forecastStation({ readings: late, anchorHour: now, now: now + 2, end: now + 10 });
    const onTime = forecastStation({ readings: kuching, anchorHour: now, now, end: now + 10 });
    expect(api[0]).toBeCloseTo(onTime[2], 4);
  });

  it("builds up the slope as a fading sum", () => {
    expect(carried(1)).toBeCloseTo(FADE);
    expect(carried(2)).toBeCloseTo(FADE + FADE * FADE);
    expect(carried(1000)).toBeCloseTo(FADE / (1 - FADE));
  });
});

describe("scoring against no change", () => {
  it("counts only the cases a reading checks, the same cases for both", () => {
    const asOf = new Date("2026-10-08T16:00:00Z");
    const issued = [{ asOf, stationId: "CA65Q", api: [90, 95], carried: 88 }];
    const readings = new Map([[asOf.getTime() + 3_600_000, 87]]);
    const [first, second] = scoreByLead(issued, (_, at) => readings.get(at.getTime()) ?? null, [1, 2], [100]);
    expect(first).toMatchObject({ lead: 1, cases: 1, model: 3, persistence: 1, bias: 3 });
    expect(second.cases).toBe(0);
  });
});

describe("the replayed backtest", () => {
  // The five recorded stations, 8 to 10 October, as one grid of hours.
  const first = new Date("2026-10-08T16:00:00Z");
  const grid = {
    first,
    stations: new Map(
      ["CA16W", "CA19B", "CA21B", "CA24N", "CA65Q"].map((id) => [id, Float32Array.from(READINGS.filter((reading) => reading.stationId === id).map((reading) => reading.api))]),
    ),
  };
  const { leads, days } = backtest(grid, 6);

  it("scores both columns on the same cases, and only cases a reading checks", () => {
    const one = leads.find((row) => row.lead === 1);
    // 5 stations, hours 3 to 34 forecast, each checked an hour later.
    expect(one?.cases).toBe(5 * 32);
    expect(leads.find((row) => row.lead === 72)?.cases).toBe(0);
    expect(days.reduce((sum, day) => sum + day.cases, 0)).toBe(leads.find((row) => row.lead === 6)?.cases);
  });

  it("brackets its own difference with the interval", () => {
    for (const row of leads.filter((item) => item.cases > 0)) {
      expect(row.low).toBeLessThanOrEqual(row.model - row.persistence + 1e-9);
      expect(row.high).toBeGreaterThanOrEqual(row.model - row.persistence - 1e-9);
    }
  });

  it("replays Kuching's haze arrival from the hour it crossed 100", () => {
    const [kuching] = arrivals(grid, 6, 1);
    expect(kuching.stationId).toBe("CA65Q");
    expect(kuching.forecast).toHaveLength(6);
    expect(kuching.readings.find((point) => point.at.getTime() === kuching.madeAt.getTime())?.api).toBeGreaterThan(100);
  });
});
