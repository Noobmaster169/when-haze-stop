import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { AHEAD_HOURS, formatHindcast, HINDCAST_MODEL, hindcastDay, runHindcast } from "../../src/jobs/hindcast";
import { smokeHindcasts } from "../../src/repositories";
import { TerminalError } from "../../src/lib/errors";
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
/** Past the end of the recorded wind, so no recorded day waits for its analysis unless a test says so. */
const LATER = new Date("2026-10-20T00:00:00Z");

describe("the smoke hindcast of one day", () => {
  beforeAll(async () => {
    // The run starts at most 8 days back and no earlier than the stored wind, the
    // cycle's 6 October: four days behind the issue time, past the spin-up. No
    // earlier wind is laid down, because other files read where the stored wind begins.
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

describe("the hindcast over a span of days", () => {
  beforeAll(async () => {
    await recordedCycle();
  }, 120_000);

  it("labels a day before the stored wind begins as no-wind", async () => {
    expect(await hindcastDay(getPool(), new Date("2025-01-15T00:00:00Z"), [DOWNWIND])).toBe("no-wind");
  });

  it("stores one day, then skips it on a rerun without a second row", async () => {
    const pool = getPool();
    const options = { from: "2026-10-10", to: "2026-10-10", instruments: [DOWNWIND, UPWIND], now: LATER };
    const first = await runHindcast(pool, options);
    const before = (await smokeHindcasts.storedDays(pool, HINDCAST_MODEL)).has(AS_OF.toISOString());
    const again = await runHindcast(pool, options);
    expect(before).toBe(true);
    // The first run may itself find the day stored by an earlier run of this file; either way the rerun stores nothing.
    expect(first.stored + first.skipped).toBe(1);
    expect(again).toMatchObject({ days: 1, stored: 0, rows: 0, skipped: 1, short: 0 });
  });

  it("does not skip a day stored under another model", async () => {
    const pool = getPool();
    await smokeHindcasts.insertMany(pool, [{ asOf: new Date("2026-10-09T00:00:00Z"), instrumentId: DOWNWIND.id, smokeNow: 0, smoke24h: 0, smoke48h: 0, model: "other-model" }]);
    const summary = await runHindcast(pool, { from: "2026-10-09", to: "2026-10-09", instruments: [DOWNWIND], now: LATER });
    expect(summary.stored + summary.skipped).toBe(1);
    expect((await smokeHindcasts.storedDays(pool, HINDCAST_MODEL)).has("2026-10-09T00:00:00.000Z")).toBe(true);
  });

  it("skips a day the stored wind does not reach", async () => {
    const summary = await runHindcast(getPool(), { from: "2025-01-15", to: "2025-01-15", instruments: [DOWNWIND], now: LATER });
    expect(summary).toMatchObject({ days: 1, stored: 0, skipped: 0, short: 1 });
  });

  it("skips a day whose wind stops before two days on", async () => {
    // The recorded cycle's wind runs 200 hours from 6 October, to the 14th at 07:00: the 13th has it, but not 48 hours past it.
    const summary = await runHindcast(getPool(), { from: "2026-10-13", to: "2026-10-13", instruments: [DOWNWIND], now: LATER });
    expect(summary).toMatchObject({ days: 1, stored: 0, short: 1 });
  });

  it("leaves a day whose two days on are not yet past to a later run, and stores the day before it", async () => {
    const pool = getPool();
    // 11 October plus 49 hours is 13 October at 01:00, before this clock; 12 October plus 49 hours is after it.
    const summary = await runHindcast(pool, { from: "2026-10-11", to: "2026-10-12", instruments: [DOWNWIND], now: new Date("2026-10-13T12:00:00Z") });
    expect(summary).toMatchObject({ days: 2, short: 1 });
    expect(summary.stored + summary.skipped).toBe(1);
    const stored = await smokeHindcasts.storedDays(pool, HINDCAST_MODEL);
    expect(stored.has("2026-10-11T00:00:00.000Z")).toBe(true);
    expect(stored.has("2026-10-12T00:00:00.000Z")).toBe(false);
  });

  it("runs a stored day again for an instrument added since, without a second row for the others", async () => {
    const pool = getPool();
    const day = new Date("2026-10-11T00:00:00Z");
    // A new id on every run of this file, so the day is always missing it; it stands where UPWIND does.
    const added: Instrument = { ...UPWIND, id: `test-added-${Date.now()}` };
    await smokeHindcasts.insertMany(pool, [{ asOf: day, instrumentId: DOWNWIND.id, smokeNow: 0, smoke24h: 0, smoke48h: 0, model: HINDCAST_MODEL }]);
    const summary = await runHindcast(pool, { from: "2026-10-11", to: "2026-10-11", instruments: [DOWNWIND, added], now: LATER });
    expect(summary).toMatchObject({ days: 1, stored: 1, rows: 1, skipped: 0, short: 0 });
    const have = (await smokeHindcasts.storedInstruments(pool, HINDCAST_MODEL)).get(day.toISOString());
    expect(have?.has(DOWNWIND.id)).toBe(true);
    expect(have?.has(added.id)).toBe(true);
  });

  it("does not run a stored day again for an instrument outside the region", async () => {
    const summary = await runHindcast(getPool(), { from: "2026-10-10", to: "2026-10-10", instruments: [DOWNWIND, UPWIND, OUTSIDE], now: LATER });
    expect(summary).toMatchObject({ days: 1, stored: 0, skipped: 1 });
  });

  it("refuses a span that runs backwards or a day that is not a date", async () => {
    await expect(runHindcast(getPool(), { from: "2026-10-11", to: "2026-10-10", now: LATER })).rejects.toBeInstanceOf(TerminalError);
    await expect(runHindcast(getPool(), { from: "11/10/2026", to: "2026-10-12", now: LATER })).rejects.toBeInstanceOf(TerminalError);
  });

  it("prints the summary on one line", () => {
    expect(formatHindcast({ days: 3, stored: 1, rows: 180, skipped: 1, short: 1, ms: 12_345 })).toBe("hindcast: 3 days, 1 stored (180 rows), 1 already stored, 1 without enough analysed wind, 12 s");
  });
});
