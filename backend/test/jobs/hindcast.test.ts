import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { AHEAD_HOURS, HINDCAST_MODEL, hindcastDay } from "../../src/jobs/hindcast";
import type { Instrument } from "../../src/services/instruments";
import { recordedCycle } from "../fixtures/cycle";

afterAll(closePool);

/**
 * Two points on the steady wind's line through the recorded Sumatran fires
 * (about 3.4 S, 105.2 E, carried north-east by u = v = 3 m/s): test vectors
 * for the physics, like the wind itself, not places anyone will see.
 */
const DOWNWIND: Instrument = { id: "test-downwind", kind: "airport", lat: -1.5, lon: 107 };
const UPWIND: Instrument = { id: "test-upwind", kind: "airport", lat: -5, lon: 103.5 };
const OUTSIDE: Instrument = { id: "test-outside", kind: "airport", lat: 20, lon: 130 };
/** The day after the recorded fires of 7 to 9 October are all complete. */
const AS_OF = new Date("2026-10-10T00:00:00Z");

describe("the smoke hindcast of one day", () => {
  beforeAll(async () => {
    // The run starts at the earliest stored wind, the cycle's 6 October: four days
    // behind the issue time, past the spin-up. No earlier wind is laid down,
    // because other files read where the stored wind begins.
    await recordedCycle();
  }, 120_000);

  it("gives every instrument its smoke at the issue time and a day and two days on", async () => {
    const result = await hindcastDay(getPool(), AS_OF, [DOWNWIND, UPWIND]);
    expect(typeof result).toBe("object");
    if (typeof result !== "object") return;
    expect(result.rows.map((row) => row.instrumentId)).toEqual(["test-downwind", "test-upwind"]);
    for (const row of result.rows) {
      expect(row).toMatchObject({ asOf: AS_OF, model: HINDCAST_MODEL });
      for (const value of [row.smokeNow, row.smoke24h, row.smoke48h]) expect(Number.isFinite(value) && value >= 0).toBe(true);
    }
  });

  it("carries more smoke to the point downwind of the fires than to the point upwind", async () => {
    const result = await hindcastDay(getPool(), AS_OF, [DOWNWIND, UPWIND]);
    if (typeof result !== "object") throw new Error(`skipped: ${result}`);
    const [downwind, upwind] = result.rows;
    expect(downwind.smoke24h).toBeGreaterThan(upwind.smoke24h);
    expect(downwind.smoke48h).toBeGreaterThan(upwind.smoke48h);
  });

  it("writes no row for an instrument outside the region, and counts it", async () => {
    const result = await hindcastDay(getPool(), AS_OF, [DOWNWIND, OUTSIDE]);
    if (typeof result !== "object") throw new Error(`skipped: ${result}`);
    expect(result.rows.map((row) => row.instrumentId)).toEqual(["test-downwind"]);
    expect(result.outside).toBe(1);
  });

  it("names the horizon it stores", () => {
    expect(AHEAD_HOURS).toBe(48);
  });
});
