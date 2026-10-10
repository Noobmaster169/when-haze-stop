import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Simulation } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { GRID_KEY } from "../../src/haze/grid";
import { pm25ToApi } from "../../src/haze/api-index";
import { forecasts, modelForecasts, readings } from "../../src/repositories";
import { modelSkill, SHADOW_DAYS, SHADOW_GAIN } from "../../src/services/model-skill";
import { testApp } from "../app";
import { recordedCycle } from "../fixtures/cycle";

afterAll(closePool);

/**
 * Forecasts for Seremban's 9 October, the one whole Malaysian day in the
 * recorded week, made a day and two days earlier, under a version only this
 * file writes. No reading precedes those hours, so "no change" has no case.
 */
const VERSION = "test-skill";
const ROWS = [
  { asOf: new Date("2026-10-08T03:00:00Z"), instrumentId: "CA24N", day: "2026-10-09", p10: 60, p50: 90, p90: 120, modelVersion: VERSION },
  { asOf: new Date("2026-10-07T03:00:00Z"), instrumentId: "CA24N", day: "2026-10-09", p10: 50, p50: 70, p90: 100, modelVersion: VERSION },
];

describe("the learned model's live score", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
    await modelForecasts.insertMany(pool, ROWS);
  }, 120_000);

  it("scores each lead for DOE stations against the day's peak, no change, and the hourly run", async () => {
    const skill = await modelSkill(pool, "shadow", VERSION);
    expect(skill).toMatchObject({ mode: "shadow", modelVersion: VERSION, shadowDaysRequired: SHADOW_DAYS, gainRequired: SHADOW_GAIN, passed: false });
    const ninth = await readings.forStation(pool, "CA24N", new Date("2026-10-08T16:00:00Z"), new Date("2026-10-09T15:00:00Z"));
    const peak = Math.max(...ninth.map((reading) => reading.api));
    const dayAhead = skill.leads.find((lead) => lead.network === "doe" && lead.leadDays === 1);
    const twoAhead = skill.leads.find((lead) => lead.network === "doe" && lead.leadDays === 2);
    // A forecast of 90 ug/m3 is an index of about 168, scored against the 9th's peak reading.
    expect(dayAhead).toMatchObject({ cases: 1, persistence: null, persistenceCases: 0 });
    expect(dayAhead?.model).toBeCloseTo(Math.abs(pm25ToApi(90) - peak), 1);
    expect(twoAhead?.cases).toBe(1);
    expect(twoAhead?.model).toBeCloseTo(Math.abs(pm25ToApi(70) - peak), 1);
    expect(skill.leads.map((lead) => [lead.network, lead.leadDays])).toEqual([["doe", 1], ["doe", 2], ["nea", 1], ["nea", 2]]);
    expect(skill.shadowDays).toBe(1);
  });

  it("answers with nulls and no pass before any forecast of a version exists", async () => {
    const skill = await modelSkill(pool, "off", "no-such-version");
    expect(skill).toMatchObject({ mode: "off", modelVersion: "no-such-version", since: null, shadowDays: 0, gain: null, passed: false });
    expect(skill.leads.every((lead) => lead.cases === 0 && lead.model === null)).toBe(true);
  });

  it("is part of the simulation the api serves", async () => {
    const simulation = Simulation.parse((await request(testApp()).get("/haze/simulation").expect(200)).body);
    expect(simulation.model.mode).toBe("off");
    expect(simulation.model.leads).toHaveLength(4);
  });

  it("scores the hourly run on the current grid only, and gates on identical cases", async () => {
    const GATE = "test-skill-gate-b";
    const asOf = new Date("2026-10-08T06:00:00Z");
    const ninth = await readings.forStation(pool, "CA24N", new Date("2026-10-08T16:00:00Z"), new Date("2026-10-09T15:00:00Z"));
    const peak = Math.max(...ninth.map((reading) => reading.api));
    const model = pm25ToApi(60);
    // The hourly run is worse than the model by construction, so the gain is well over the 0.1 required.
    const level = Math.fround(peak + 3 * Math.abs(model - peak) + 20);
    const calibration = { intercept: 0, slope: 1, rankCorrelation: null, pairs: 0, fallback: false };
    // Runs are unique per hour and grid, so a rerun against the same database finds them and adds nothing.
    if (!(await forecasts.exists(pool, asOf, "live"))) {
      const current = await forecasts.insertRun(pool, asOf, "live", calibration);
      await forecasts.insertStationForecasts(pool, current, [{ stationId: "CA24N", api: new Float32Array(36).fill(level) }]);
      const other = await forecasts.insertRun(pool, asOf, "live", calibration, `${GRID_KEY}-other`);
      await forecasts.insertStationForecasts(pool, other, [{ stationId: "CA24N", api: new Float32Array(36).fill(level + 500) }]);
    }
    await modelForecasts.insertMany(pool, [{ asOf, instrumentId: "CA24N", day: "2026-10-09", p10: 40, p50: 60, p90: 90, modelVersion: GATE }]);

    const skill = await modelSkill(pool, "shadow", GATE);
    const dayAhead = skill.leads[0];
    expect(dayAhead).toMatchObject({ cases: 1, v2Cases: 1 });
    expect(dayAhead.v2).toBeCloseTo(Math.round(Math.abs(level - peak) * 100) / 100, 1);
    expect(skill).toMatchObject({ cases: 1, comparedCases: 1 });
    expect(skill.gain).not.toBeNull();
    expect(skill.gain).toBeCloseTo(1 - Math.abs(model - peak) / Math.abs(level - peak), 2);
    expect(skill.gain ?? 0).toBeGreaterThan(SHADOW_GAIN);
    expect(skill.shadowDays).toBe(1);
    expect(skill.passed).toBe(false);
  });
});
