import { describe, expect, it } from "vitest";

import type { Assignment } from "../../src/contracts.council";
import { arrivalDay, keepByDay } from "../../src/suppression/effect";
import { SCENARIOS } from "../../src/suppression/scenarios";
import { measure, removedSeries, scorePlan } from "../../src/suppression/score";
import { VECTOR_COMPLEXES, vectorAttribution } from "../fixtures/council-vector";

const [peatKal, surfaceJohor, peatJambi] = VECTOR_COMPLEXES;
const line = (complexId: string, asset: Assignment["asset"], units: number, fromDay = 1, toDay = 14, needsConsent: Assignment["needsConsent"] = null): Assignment => ({
  complexId,
  asset,
  units,
  fromDay,
  toDay,
  needsConsent,
});

describe("the effect of suppression", () => {
  it("does nothing before the crews can arrive", () => {
    expect(arrivalDay(line("C01", "cl415", 1))).toBe(1);
    expect(arrivalDay(line("C01", "ground_teams", 2))).toBe(2);
    // The task force has to be flown in; no request to wait on, only travel.
    expect(arrivalDay(line("C03", "ground_task_force", 150))).toBe(3);
    expect(arrivalDay(line("C03", "ground_teams", 2, 5))).toBe(5);
    const keep = keepByDay(peatKal, [line("C01", "ground_task_force", 150)], SCENARIOS.central, 14, false);
    expect(keep.slice(0, 2).every((value) => value === 1)).toBe(true);
    expect(keep[2]).toBeLessThan(1);
  });

  it("puts out a small surface fire quickly with Bomba", () => {
    // 10 detections at 1 ha is 10 ha; 100 people is 16.7 teams at 3 ha a day on surface fire.
    const keep = keepByDay(surfaceJohor, [line("C02", "bomba_domestic", 100)], SCENARIOS.central, 14, false);
    expect(keep[0]).toBe(0);
  });

  it("never lets aircraft put out peat, only knock its flame down while overhead", () => {
    const keep = keepByDay(peatKal, [line("C01", "cl415", 1, 1, 10)], SCENARIOS.central, 14, false);
    for (const value of keep.slice(0, 10)) expect(value).toBeGreaterThanOrEqual(1 - SCENARIOS.central.flamingShare);
    expect(keep.slice(10).every((value) => value === 1)).toBe(true);
  });

  it("lets peat relight once the crews leave, and more with fire next door", () => {
    const work = [line("C03", "ground_teams", 2, 2, 8)];
    const alone = keepByDay(peatJambi, work, SCENARIOS.central, 14, false);
    const pressured = keepByDay(peatJambi, work, SCENARIOS.central, 14, true);
    expect(alone[8]).toBeGreaterThan(alone[7]);
    expect(pressured[7]).toBeGreaterThan(alone[7]);
  });
});

describe("scoring a plan", () => {
  it("removes exactly the suppressed share of each day's contribution", () => {
    const attribution = vectorAttribution();
    // Bomba puts C02 out on day 1 and it stays out: every day's 0.2 is removed.
    const removed = removedSeries({ assignments: [line("C02", "bomba_domestic", 100)] }, attribution, "central", 0);
    expect(removed[0]).toBeCloseTo(0.2 * 14, 5);
  });

  it("is the sum of its parts on complexes that do not touch", () => {
    const attribution = vectorAttribution();
    const a = [line("C02", "bomba_domestic", 100)];
    const b = [line("C03", "ground_teams", 2, 2, 13)];
    const both = removedSeries({ assignments: [...a, ...b] }, attribution, "central", 0)[0];
    const sum = removedSeries({ assignments: a }, attribution, "central", 0)[0] + removedSeries({ assignments: b }, attribution, "central", 0)[0];
    expect(both).toBeCloseTo(sum, 5);
  });

  it("states the benefit as a share of the ceiling", () => {
    const attribution = vectorAttribution({ C02: 0.2 });
    const measures = measure({ assignments: [line("C02", "bomba_domestic", 100)] }, attribution, "central", 0);
    expect(measures.shareOfCeiling).toBeCloseTo(1, 5);
    expect(measures.arrivalHours).toBe(1);
  });

  it("orders the scenarios: optimistic at least central at least pessimistic", () => {
    const score = scorePlan({ assignments: [line("C03", "ground_task_force", 150, 3, 14)] }, vectorAttribution());
    expect(score.optimistic).toBeGreaterThanOrEqual(score.expected);
    expect(score.expected).toBeGreaterThanOrEqual(score.pessimistic);
    expect(score.measures).toHaveLength(3);
  });

  it("ignores a line for a complex the engine knows nothing about", () => {
    const removed = removedSeries({ assignments: [line("C99", "cl415", 1)] }, vectorAttribution(), "central", 0);
    expect(removed.every((value) => value === 0)).toBe(true);
  });
});
