import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ModelLive } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { pm25ToApi } from "../../src/haze/api-index";
import { modelForecasts, readings } from "../../src/repositories";
import { modelLive } from "../../src/services/model-live";
import { testApp } from "../app";
import { recordedCycle } from "../fixtures/cycle";
import { ISSUE_AT, RECORDED_ISSUE } from "../fixtures/recorded-model-issue";

afterAll(closePool);

/**
 * The recorded cycle's run is at 11:00 Malaysian time on 10 October, so
 * tomorrow is the 11th, the real issue's first day. Its DOE stations are
 * Seremban (p50 95) and Petaling Jaya (72); Singapore Central and KLIA are
 * higher but not DOE stations.
 */
describe("the learned model's live record", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
    await modelForecasts.insertMany(pool, RECORDED_ISSUE.map((row) => ({ asOf: ISSUE_AT, ...row })));
  }, 120_000);

  it("watches the DOE stations the issue puts highest tomorrow, then the followed ones, each once", async () => {
    const live = await modelLive(pool, "shadow", null, ["CA21B", "CA24N", "ZZ9", "CA16W"]);
    const ids = live.watch.map((outlook) => outlook.station.id);
    expect(ids.slice(0, 2)).toEqual(["CA24N", "CA19B"]);
    expect(ids).toEqual([...new Set(ids)]);
    expect(ids).toContain("CA21B");
    expect(ids).toContain("CA16W");
    expect(ids).not.toContain("SGCENTRAL");
    expect(ids).not.toContain("ZZ9");
    expect(live.watch.every((outlook) => outlook.station.network === "doe")).toBe(true);
    expect(live.watch[0].readings.length).toBeGreaterThan(0);
  });

  it("says the next check lands at the end of the earliest stored day still to come", async () => {
    const live = await modelLive(pool, "shadow", null, []);
    expect(live.nextCheckAt).toBe("2026-10-11T16:00:00.000Z");
  });

  it("carries the source of the hourly run and the skill of the newest version", async () => {
    const live = await modelLive(pool, "shadow", null, []);
    expect(live.source.kind).toBe("hourly");
    expect(live.skill.mode).toBe("shadow");
    expect((await modelLive(pool, "off", null, [])).skill.mode).toBe("off");
  });

  it("lists every scored DOE forecast of the newest version, newest first, with misses in API points", async () => {
    // The newest version is whichever stored a row most recently; score one day of it so the ledger has rows.
    const newest = await modelForecasts.newestVersion(pool);
    if (!newest) throw new Error("no learned forecast stored");
    const asOf = new Date("2026-10-08T05:00:00Z");
    await modelForecasts.insertMany(pool, [{ asOf, instrumentId: "CA24N", day: "2026-10-09", p10: 60, p50: 90, p90: 120, modelVersion: newest.modelVersion }]);
    const ninth = await readings.forStation(pool, "CA24N", new Date("2026-10-08T16:00:00Z"), new Date("2026-10-09T15:00:00Z"));
    const peak = Math.max(...ninth.map((reading) => reading.api));

    const live = await modelLive(pool, "shadow", null, []);
    const row = live.ledger.find((entry) => entry.asOf === asOf.toISOString() && entry.stationId === "CA24N");
    expect(row).toMatchObject({ stationName: "Seremban", day: "2026-10-09", leadDays: 1, observed: peak, forecast: Math.round(pm25ToApi(90)), low: Math.round(pm25ToApi(60)), high: Math.round(pm25ToApi(120)), persistenceMiss: null });
    expect(row?.miss).toBeCloseTo(Math.abs(pm25ToApi(90) - peak), 1);
    const order = live.ledger.map((entry) => entry.asOf);
    expect(order).toEqual([...order].sort((a, b) => b.localeCompare(a)));
    // The issue's own days are still to come, so none of them is in the ledger.
    expect(live.ledger.every((entry) => entry.day < "2026-10-10")).toBe(true);
  });

  it("is served at /haze/model and keeps only followed ids that look like station ids", async () => {
    const body = ModelLive.parse((await request(testApp()).get("/haze/model?follow=CA21B,not an id,CA21B").expect(200)).body);
    expect(body.watch.filter((outlook) => outlook.station.id === "CA21B")).toHaveLength(1);
    expect(body.skill.mode).toBe("off");
    expect(Array.isArray(body.ledger)).toBe(true);
  });
});
