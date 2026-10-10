import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { pm25ToApi } from "../../src/haze/api-index";
import { runModelForecast } from "../../src/jobs/model-forecast";
import { modelForecasts, stations } from "../../src/repositories";
import { addHours } from "../../src/haze/grid";
import { LEARNED_STALE_HOURS, outlookContext, outlookFor } from "../../src/services/outlook";
import { FakeModelClient } from "../../src/sources/__fakes__/fake.model";
import { recordedCycle } from "../fixtures/cycle";
import { CONTRACT_FORECASTS } from "../fixtures/model-contract";
import { LAST_HOUR } from "../fixtures/recorded";

afterAll(closePool);

describe("the station outlook under each model mode", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
    // The same rows the model step stores, so this file and the step's test agree whichever ran first.
    await runModelForecast(pool, new FakeModelClient(CONTRACT_FORECASTS), LAST_HOUR);
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
  });
});
