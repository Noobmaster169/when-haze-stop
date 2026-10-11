import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { runCycle } from "../../src/jobs/cycle";
import { issueTime, runModelForecast } from "../../src/jobs/model-forecast";
import { modelForecasts, sourceFetches } from "../../src/repositories";
import { FakeModelClient } from "../../src/sources/__fakes__/fake.model";
import { FakeDoeClient, FakeFiresClient, FakeMetarClient, FakeNeaClient, FakeWeatherClient } from "../../src/sources/__fakes__/fake.sources";
import type { ModelClient } from "../../src/sources/model";
import { recordedCycle } from "../fixtures/cycle";
import { CONTRACT_FORECASTS, CONTRACT_VERSION } from "../fixtures/model-contract";
import { LAST_HOUR, READINGS, STATIONS } from "../fixtures/recorded";
import { steadyWind } from "../fixtures/steady-wind";

afterAll(closePool);

/** The recorded week's last hour is 03:00 UTC on 10 October, so its issue is that day's 00:00 UTC. */
const ISSUE = new Date("2026-10-10T00:00:00Z");

function cycleDeps(model: ModelClient) {
  const pool = getPool();
  return {
    pool,
    doe: new FakeDoeClient(STATIONS, READINGS),
    fires: new FakeFiresClient([]),
    weather: new FakeWeatherClient(steadyWind(new Date("2026-10-06T00:00:00Z"), 200, 3, 3)),
    metar: new FakeMetarClient([]),
    nea: new FakeNeaClient([]),
    model,
  };
}

describe("the model step", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
  }, 120_000);

  it("issues at the newest 00:00 UTC at or before the run's hour", () => {
    expect(issueTime(LAST_HOUR)).toEqual(ISSUE);
    expect(issueTime(ISSUE)).toEqual(ISSUE);
    expect(issueTime(new Date("2026-10-10T23:59:00Z"))).toEqual(ISSUE);
  });

  it("stores the answer for instruments it knows, drops the rest, and counts both", async () => {
    const model = new FakeModelClient(CONTRACT_FORECASTS);
    // Nine rows name stations the recorded week has; the tenth names a sensor nothing stored. A rerun on a database that holds them asks nothing.
    expect(await runModelForecast(pool, model, LAST_HOUR)).toBeLessThanOrEqual(9);
    expect(await runModelForecast(pool, model, LAST_HOUR)).toBe(0);
    expect(model.asked.length).toBeLessThanOrEqual(1);
    expect(model.asked.every((at) => at.getTime() === ISSUE.getTime())).toBe(true);
    expect(await modelForecasts.hasIssue(pool, ISSUE, CONTRACT_VERSION)).toBe(true);
    expect(await modelForecasts.latestFor(pool, "openaq:999999")).toBeNull();
    const asks = (await sourceFetches.succeeded(pool, "model")).filter((detail) => detail.asOf === ISSUE.toISOString() && detail.modelVersion === CONTRACT_VERSION);
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ received: 10, unknownInstruments: 1 });
  });

  it("asks once per issue in the cycle: the stored as_of is the 00:00 UTC issue, and a second cycle that day stores nothing", async () => {
    // Kuching, under a version only this test writes, so no other file's rows decide what it reads.
    const version = "test-cycle-issue";
    const forecasts = ["2026-10-11", "2026-10-12", "2026-10-13"].map((day) => ({ instrumentId: "CA65Q", day, p10: 20, p50: 30, p90: 45, modelVersion: version }));
    const model = new FakeModelClient(forecasts);
    await runCycle(cycleDeps(model), new Date(LAST_HOUR.getTime() + 20 * 60_000), { fires: false, model: true });
    const stored = await modelForecasts.latestFor(pool, "CA65Q");
    expect(stored).toMatchObject({ asOf: ISSUE, modelVersion: version });
    expect([...(stored?.days.keys() ?? [])]).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    const fetches = await sourceFetches.count(pool, "model");
    const asked = model.asked.length;

    await runCycle(cycleDeps(model), new Date(LAST_HOUR.getTime() + 80 * 60_000), { fires: false, model: true });
    expect(model.asked.length).toBe(asked);
    expect(await sourceFetches.count(pool, "model")).toBe(fetches);
  }, 120_000);

  it("is a step of the cycle that a failing service cannot stop", async () => {
    const refusing: FakeModelClient = Object.assign(new FakeModelClient([]), {
      predict: async () => {
        throw new Error("the service is down");
      },
    });
    await runCycle(cycleDeps(refusing), new Date(LAST_HOUR.getTime() + 20 * 60_000), { fires: false, model: true });
    const [fetch] = await sourceFetches.page(pool, "model", 1, 0);
    expect(fetch).toMatchObject({ ok: false, error: "the service is down" });
  });
});
