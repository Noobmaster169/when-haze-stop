import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { pm25ToApi } from "../../src/haze/api-index";
import { runModelForecast } from "../../src/jobs/model-forecast";
import { addHours } from "../../src/haze/grid";
import { localDay } from "../../src/haze/outlook";
import { LITTLE_SMOKE } from "../../src/haze/why";
import { forecasts, modelForecasts, stations } from "../../src/repositories";
import { LEARNED_STALE_HOURS, outlookContext, outlookFor } from "../../src/services/outlook";
import { FakeModelClient } from "../../src/sources/__fakes__/fake.model";
import { recordedCycle } from "../fixtures/cycle";
import { CONTRACT_FORECASTS } from "../fixtures/model-contract";
import { LAST_HOUR } from "../fixtures/recorded";
import { RECORDED_ISSUE } from "../fixtures/recorded-model-issue";

afterAll(closePool);

describe("the station outlook under each model mode", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
    // The same rows the model step stores, so this file and the step's test agree whichever ran first.
    await runModelForecast(pool, new FakeModelClient(CONTRACT_FORECASTS), LAST_HOUR);
    // The real issue of the same 00:00 UTC, stored last so it is the newest version for the week's stations.
    await runModelForecast(pool, new FakeModelClient(RECORDED_ISSUE), LAST_HOUR);
  }, 120_000);

  async function seremban(mode: "off" | "shadow" | "live") {
    const station = await stations.find(pool, "CA24N");
    const context = await outlookContext(pool, mode);
    if (!station || !context) throw new Error("the recorded cycle stored no run or no Seremban");
    return outlookFor(pool, station, context);
  }

  it("shows the learned forecast only in live mode", async () => {
    const live = await seremban("live");
    const shadow = await seremban("shadow");
    const stored = await modelForecasts.latestFor(pool, "CA24N");
    const tomorrow = stored?.days.get("2026-10-11");
    expect(tomorrow).toBeDefined();
    expect(live.days[1].forecastPeak).toBe(Math.round(pm25ToApi(tomorrow?.p50 ?? 0)));
    expect(shadow.days[1].forecastPeak).not.toBe(live.days[1].forecastPeak);
    expect(shadow.days[1]).toEqual((await seremban("off")).days[1]);
  });

  it("bends the hourly line so each learned day peaks at the day row's forecast", async () => {
    const live = await seremban("live");
    const learned = live.days.filter((day) => day.source === "learned");
    expect(learned.length).toBeGreaterThanOrEqual(2);
    expect(live.days[0].source).toBe("hourly");
    for (const day of learned) {
      const line = live.forecast.filter((value) => localDay(new Date(value.at)) === day.day).map((value) => value.api);
      expect(line.length).toBeGreaterThan(0);
      expect(Math.abs(Math.max(...line) - (day.forecastPeak ?? Number.NaN))).toBeLessThanOrEqual(1);
    }
  });

  it("ends the line with the last learned day and leaves the day after without a forecast", async () => {
    const live = await seremban("live");
    const learnedDays = live.days.filter((day) => day.source === "learned").map((day) => day.day);
    const last = learnedDays.at(-1) ?? "";
    expect(live.forecast.every((value) => localDay(new Date(value.at)) <= last)).toBe(true);
    expect(live.forecast.some((value) => localDay(new Date(value.at)) === last)).toBe(true);
    // The recorded issue reaches every day the outlook shows; a day past it, had there been one, would carry no forecast.
    const beyond = live.days.filter((day) => day.day > last);
    for (const day of beyond) expect(day).toMatchObject({ forecastPeak: null, low: null, high: null, why: null });
    expect(live.days.slice(1).every((day) => day.source === "learned" || day.forecastPeak === null)).toBe(true);
  });

  it("explains each learned day from the simulation, and says so when no run has stored its smoke yet", async () => {
    const live = await seremban("live");
    // Nothing has stored `physics` for the recorded run, so the simulation has nothing to say about the day's shape.
    for (const day of live.days) expect(day.why).toBe(day.source === "learned" ? LITTLE_SMOKE : null);
  });

  it("shows the stored hourly forecast untouched outside live mode", async () => {
    const shadow = await seremban("shadow");
    const context = await outlookContext(pool, "shadow");
    const stored = await forecasts.stationForecast(pool, context?.runId ?? -1, "CA24N");
    expect(stored?.length).toBeGreaterThan(0);
    expect(shadow.forecast.map((value) => value.api)).toEqual((stored ?? []).map((value) => Math.round(value)));
    expect(shadow.days.every((day) => day.source === "hourly" && day.why === null)).toBe(true);
    expect(shadow.source.kind).toBe("hourly");
  });

  it("leaves a station the model never forecast on the hourly forecast", async () => {
    const station = await stations.find(pool, "CA21B");
    const context = await outlookContext(pool, "live");
    if (!station || !context) throw new Error("the recorded cycle stored no run or no Klang");
    const live = await outlookFor(pool, station, context);
    const off = await outlookFor(pool, station, { ...context, learned: false });
    expect(live.days).toEqual(off.days);
  });

  it("falls back to the hourly forecast where the newest learned forecast is older than the bound", async () => {
    const station = await stations.find(pool, "CA16W");
    const context = await outlookContext(pool, "live");
    if (!station || !context) throw new Error("the recorded cycle stored no run or no Cheras");
    // An issue an hour past the bound, for a day the outlook shows, with a band far from anything the hourly run says.
    const asOf = addHours(context.asOf, -(LEARNED_STALE_HOURS + 1));
    const day = "2026-10-11";
    await modelForecasts.insertMany(pool, [{ asOf, instrumentId: "CA16W", day, p10: 300, p50: 400, p90: 480, modelVersion: "test-outlook-stale" }]);
    const stored = await modelForecasts.latestFor(pool, "CA16W");
    expect(stored?.asOf).toEqual(asOf);
    expect(stored?.days.has(day)).toBe(true);
    const live = await outlookFor(pool, station, context);
    const off = await outlookFor(pool, station, { ...context, learned: false });
    expect(live.days).toEqual(off.days);
    expect(live.days.every((day) => day.source === "hourly" && day.why === null)).toBe(true);
    expect(live.forecast).toEqual(off.forecast);
  });
});
