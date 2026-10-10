import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { forecasts } from "../../src/repositories";
import { hazeMap } from "../../src/services/map";
import { recordedCycle } from "../fixtures/cycle";
import { LAST_HOUR } from "../fixtures/recorded";

afterAll(closePool);

describe("whose forecast the map's future is", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
  }, 120_000);

  it("names no learned frame when the run was corrected to nothing learned, whatever the mode", async () => {
    const off = await hazeMap(pool, "off");
    expect(off.run?.asOf).toBe(LAST_HOUR.toISOString());
    expect(await forecasts.learnedVersion(pool, off.run?.id ?? -1)).toBeNull();
    expect(off.learnedFrom).toBeNull();
    expect(off.source).toMatchObject({ kind: "hourly" });
    // The recorded cycle ran without the model, so even live mode has no corrected frame to point at.
    expect((await hazeMap(pool, "live")).learnedFrom).toBeNull();
  });

  it("serves the same map in shadow as in off, apart from the label", async () => {
    const [off, shadow] = await Promise.all([hazeMap(pool, "off"), hazeMap(pool, "shadow")]);
    expect(shadow).toEqual(off);
    expect(shadow.source).toMatchObject({ kind: "hourly" });
  });
});
