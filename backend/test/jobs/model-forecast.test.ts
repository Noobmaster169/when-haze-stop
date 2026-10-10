import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { runCycle } from "../../src/jobs/cycle";
import { runModelForecast } from "../../src/jobs/model-forecast";
import { modelForecasts, sourceFetches } from "../../src/repositories";
import { FakeModelClient } from "../../src/sources/__fakes__/fake.model";
import { FakeDoeClient, FakeFiresClient, FakeMetarClient, FakeNeaClient, FakeWeatherClient } from "../../src/sources/__fakes__/fake.sources";
import { recordedCycle } from "../fixtures/cycle";
import { CONTRACT_FORECASTS, CONTRACT_VERSION } from "../fixtures/model-contract";
import { LAST_HOUR, READINGS, STATIONS } from "../fixtures/recorded";
import { steadyWind } from "../fixtures/steady-wind";

afterAll(closePool);

describe("the model step", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
  }, 120_000);

  it("stores the answer for instruments it knows, drops the rest, and counts both", async () => {
    const model = new FakeModelClient(CONTRACT_FORECASTS);
    // Nine rows name stations the recorded week has; the tenth names a sensor nothing stored. A rerun finds the nine already there.
    expect(await runModelForecast(pool, model, LAST_HOUR)).toBeLessThanOrEqual(9);
    expect(model.asked).toEqual([LAST_HOUR]);
    expect(await runModelForecast(pool, model, LAST_HOUR)).toBe(0);
    const stored = await modelForecasts.latestFor(pool, "CA24N");
    expect(stored?.modelVersion).toBe(CONTRACT_VERSION);
    expect([...(stored?.days.keys() ?? [])]).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(await modelForecasts.latestFor(pool, "openaq:999999")).toBeNull();
    const [fetch] = await sourceFetches.page(pool, "model", 1, 0);
    expect(fetch).toMatchObject({ ok: true, detail: { received: 10, unknownInstruments: 1, added: 0 } });
  });

  it("is a step of the cycle that a failing service cannot stop", async () => {
    const refusing: FakeModelClient = Object.assign(new FakeModelClient([]), {
      predict: async () => {
        throw new Error("the service is down");
      },
    });
    const deps = {
      pool,
      doe: new FakeDoeClient(STATIONS, READINGS),
      fires: new FakeFiresClient([]),
      weather: new FakeWeatherClient(steadyWind(new Date("2026-10-06T00:00:00Z"), 200, 3, 3)),
      metar: new FakeMetarClient([]),
      nea: new FakeNeaClient([]),
      model: refusing,
    };
    await runCycle(deps, new Date(LAST_HOUR.getTime() + 20 * 60_000), { fires: false, model: true });
    const [fetch] = await sourceFetches.page(pool, "model", 1, 0);
    expect(fetch).toMatchObject({ ok: false, error: "the service is down" });
  });
});
