import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { MODEL_VERSION } from "../../src/haze/run";
import { modelForecasts, readings } from "../../src/repositories";
import { recordedCycle } from "../fixtures/cycle";
import { LAST_HOUR } from "../fixtures/recorded";

afterAll(closePool);

/** A forecast made at the recorded week's last hour for Seremban, under a version only this file writes. */
const VERSION = "test-repo";
const band = (day: string, p10: number, p50: number, p90: number) => ({ asOf: LAST_HOUR, instrumentId: "CA24N", day, p10, p50, p90, modelVersion: VERSION });
const ROWS = [band("2026-10-11", 40, 52, 80), band("2026-10-12", 30, 45, 70), band("2026-10-13", 20, 30, 50)];

describe("the model forecasts repository", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
  }, 120_000);

  it("adds rows once and reads an instrument's newest forecast by day", async () => {
    expect(await modelForecasts.insertMany(pool, ROWS)).toBeLessThanOrEqual(3);
    expect(await modelForecasts.insertMany(pool, ROWS)).toBe(0);
    const stored = await modelForecasts.latestFor(pool, "CA24N");
    expect(stored?.asOf.toISOString()).toBe(LAST_HOUR.toISOString());
    expect([...(stored?.days.keys() ?? [])]).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(stored?.days.get("2026-10-11")).toEqual({ p10: 40, p50: 52, p90: 80 });
    expect(await modelForecasts.latestFor(pool, "NOPE")).toBeNull();
    expect(await modelForecasts.newestVersion(pool)).not.toBeNull();
  });

  it("offers a forecast for scoring only once its day's readings are all in", async () => {
    // The recorded readings end at 11:00 on 10 October, Malaysian time, so neither the 10th nor any later day is scoreable yet.
    const rows = (await modelForecasts.scorable(pool, MODEL_VERSION)).filter((row) => row.modelVersion === VERSION && row.day >= "2026-10-10");
    expect(rows).toEqual([]);
  });

  it("scores a day that has passed against its readings and the hourly run", async () => {
    // The recorded week runs from 00:00 on 9 October to 11:00 on the 10th, Malaysian time, so the 9th is the one whole day in it.
    // A forecast for it made on the 8th is one day ahead; nothing was read before that hour, so "no change" has no value there.
    const madeAt = new Date("2026-10-08T03:00:00Z");
    await modelForecasts.insertMany(pool, [{ ...band("2026-10-09", 60, 90, 120), asOf: madeAt }]);
    const ninth = await readings.forStation(pool, "CA24N", new Date("2026-10-08T16:00:00Z"), new Date("2026-10-09T15:00:00Z"));
    const peak = Math.max(...ninth.map((reading) => reading.api));
    const [row] = (await modelForecasts.scorable(pool, MODEL_VERSION)).filter((item) => item.modelVersion === VERSION && item.day === "2026-10-09");
    expect(row).toMatchObject({ instrumentId: "CA24N", network: "doe", leadDays: 1, p50: 90, observed: peak, persistence: null });
    expect(peak).toBeGreaterThan(100);
  });
});
