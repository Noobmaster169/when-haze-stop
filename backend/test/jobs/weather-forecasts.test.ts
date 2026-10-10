import { afterAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { ingestWeather } from "../../src/jobs/ingest";
import { weatherForecasts } from "../../src/repositories";
import { FakeDoeClient, FakeFiresClient, FakeMetarClient, FakeNeaClient, FakeWeatherClient } from "../../src/sources/__fakes__/fake.sources";
import { steadyWind } from "../fixtures/steady-wind";

afterAll(closePool);

/** Two days of uniform wind, fetched a quarter past six on the second day: the hours still ahead are 07:00 to 23:00, seventeen of them. */
const START = new Date("2026-10-06T00:00:00Z");
const FETCHED_AT = new Date("2026-10-07T06:15:00Z");
const AHEAD = new Date("2026-10-07T07:00:00Z");
const BEHIND = new Date("2026-10-07T06:00:00Z");

describe("weather kept as it was forecast", () => {
  const pool = getPool();
  const grid = steadyWind(START, 48, 3, 3);

  it("stores the hours after the fetch and none before, once", async () => {
    // A rerun of this file finds the rows already there, so only the second call's answer is fixed.
    expect(await weatherForecasts.insertForecastHours(pool, grid, FETCHED_AT)).toBeLessThanOrEqual(17);
    expect(await weatherForecasts.insertForecastHours(pool, grid, FETCHED_AT)).toBe(0);
    const ahead = await weatherForecasts.fetchesFor(pool, AHEAD);
    expect(ahead.filter((fetch) => fetch.fetchedAt.getTime() === FETCHED_AT.getTime())).toHaveLength(1);
    expect(ahead[0].u).toHaveLength(375);
    expect(await weatherForecasts.fetchesFor(pool, BEHIND)).toEqual([]);
  });

  it("stores nothing for a fetch made after its last hour", async () => {
    expect(await weatherForecasts.insertForecastHours(pool, grid, new Date("2026-10-09T00:00:00Z"))).toBe(0);
  });

  it("is written by the weather ingest beside the analysis", async () => {
    const later = new Date("2026-10-07T08:15:00Z");
    const deps = { pool, doe: new FakeDoeClient([], []), fires: new FakeFiresClient([]), weather: new FakeWeatherClient(grid), metar: new FakeMetarClient([]), nea: new FakeNeaClient([]) };
    expect(await ingestWeather(deps, later)).toBe(48);
    const nine = await weatherForecasts.fetchesFor(pool, new Date("2026-10-07T09:00:00Z"));
    expect(nine.some((fetch) => fetch.fetchedAt.getTime() === later.getTime())).toBe(true);
  });
});
