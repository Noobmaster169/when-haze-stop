import { afterAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { smokeHindcasts } from "../../src/repositories";

afterAll(closePool);

/** Two issue days for one instrument under a method name no job uses, so a rerun of this file meets only its own rows. */
const MODEL = "test-hindcast";
const DAY_ONE = new Date("2026-10-08T00:00:00Z");
const DAY_TWO = new Date("2026-10-09T00:00:00Z");
const ROWS = [
  { asOf: DAY_ONE, instrumentId: "CA24N", smokeNow: 12.5, smoke24h: 20.25, smoke48h: 8, model: MODEL },
  { asOf: DAY_TWO, instrumentId: "CA24N", smokeNow: 20.25, smoke24h: 8, smoke48h: 4, model: MODEL },
];

describe("the smoke hindcast repository", () => {
  const pool = getPool();

  it("adds rows once and says which issue times a method already has", async () => {
    expect(await smokeHindcasts.insertMany(pool, ROWS)).toBeLessThanOrEqual(2);
    expect(await smokeHindcasts.insertMany(pool, ROWS)).toBe(0);
    expect(await smokeHindcasts.insertMany(pool, [])).toBe(0);
    const stored = await smokeHindcasts.storedDays(pool, MODEL);
    expect(stored.has(DAY_ONE.toISOString())).toBe(true);
    expect(stored.has(DAY_TWO.toISOString())).toBe(true);
    expect((await smokeHindcasts.storedDays(pool, "no-such-method")).size).toBe(0);
  });
});
