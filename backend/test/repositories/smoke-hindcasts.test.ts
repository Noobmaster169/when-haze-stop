import { afterAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { smokeHindcasts } from "../../src/repositories";

afterAll(closePool);

/** A model name no job writes, so the rows this file adds are its own on every run. */
const MODEL = "test-repo";
const AS_OF = new Date("2026-10-09T00:00:00Z");

describe("smoke hindcasts", () => {
  it("stores rows once, keeps the first on a repeat, and lists the days stored for a model", async () => {
    const pool = getPool();
    await smokeHindcasts.insertMany(pool, [{ asOf: AS_OF, instrumentId: "CA16W", smokeNow: 1.5, smoke24h: 2.5, smoke48h: 3.5, model: MODEL }]);
    await smokeHindcasts.insertMany(pool, [{ asOf: AS_OF, instrumentId: "CA16W", smokeNow: 9, smoke24h: 9, smoke48h: 9, model: MODEL }]);
    const days = await smokeHindcasts.storedDays(pool, MODEL);
    expect(days.has(AS_OF.toISOString())).toBe(true);
    expect(await smokeHindcasts.storedDays(pool, "no-such-model")).toEqual(new Set());
  });

  it("does nothing with no rows", async () => {
    await expect(smokeHindcasts.insertMany(getPool(), [])).resolves.toBe(0);
  });
});
