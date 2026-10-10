import { describe, expect, it } from "vitest";

import type { Assignment, Plan } from "../../src/contracts.council";
import { biggestFirst, greedy, nearestFirst } from "../../src/suppression/baselines";
import { scorePlan } from "../../src/suppression/score";
import { normalise, validate } from "../../src/suppression/validate";
import { VECTOR_COMPLEXES, vectorAttribution } from "../fixtures/council-vector";

const plan = (assignments: Assignment[]): Plan => ({
  title: "test",
  assignments,
  requests: [],
  share: null,
  rationale: "",
  assumptions: [],
  confidence: 0.5,
  dependsOn: "",
});
const line = (complexId: string, asset: Assignment["asset"], units: number, fromDay = 1, toDay = 10): Assignment => ({ complexId, asset, units, fromDay, toDay, needsConsent: null });

describe("validating a plan", () => {
  it("accepts the accepted package in Kalimantan and Bomba at home", () => {
    expect(validate(plan([line("C01", "cl415", 1), line("C01", "helicopters", 3), line("C02", "bomba_domestic", 100)]), VECTOR_COMPLEXES)).toEqual([]);
  });

  it("works out consent from the place, whatever the plan claimed", () => {
    const normalised = normalise(plan([line("C03", "cl415", 1), line("C01", "ground_task_force", 150), line("C02", "bomba_domestic", 50)]), VECTOR_COMPLEXES);
    expect(normalised.assignments.map((item) => item.needsConsent)).toEqual(["sumatra", "ground_crews", null]);
  });

  it("refuses more aircraft than Malaysia has, on any one day", () => {
    const rules = validate(plan([line("C01", "helicopters", 2, 1, 5), line("C03", "helicopters", 2, 3, 8)]), VECTOR_COMPLEXES).map((item) => item.rule);
    expect(rules).toContain("capacity");
  });

  it("refuses the CL-415 past its ten operating days", () => {
    const rules = validate(plan([line("C01", "cl415", 1, 1, 6), line("C01", "cl415", 1, 8, 13)]), VECTOR_COMPLEXES).map((item) => item.message);
    expect(rules.some((message) => message.includes("12 days worked"))).toBe(true);
  });

  it("keeps Bomba at home and the deployed package abroad", () => {
    const rules = validate(plan([line("C01", "bomba_domestic", 50), line("C02", "cl415", 1)]), VECTOR_COMPLEXES).map((item) => item.rule);
    expect(rules.filter((rule) => rule === "asset_place")).toHaveLength(2);
  });

  it("refuses the scooper where no open water is in reach", () => {
    const rules = validate(plan([line("C01", "cl415", 1)]), VECTOR_COMPLEXES, new Map([["C01", 60]])).map((item) => item.rule);
    expect(rules).toEqual(["reach"]);
  });

  it("names a complex that is not on the fact sheet", () => {
    expect(validate(plan([line("C77", "cl415", 1)]), VECTOR_COMPLEXES)[0].rule).toBe("unknown_complex");
  });
});

describe("the baselines", () => {
  it("send everything to the biggest and to the nearest Kalimantan fire", () => {
    expect(biggestFirst(VECTOR_COMPLEXES)!.assignments.every((item) => item.complexId === "C01")).toBe(true);
    expect(nearestFirst(VECTOR_COMPLEXES, { lat: 3.14, lon: 101.69 })!.assignments[0].complexId).toBe("C01");
  });

  it("make a valid greedy plan that beats biggest-first, and does better still with requests", () => {
    const attribution = vectorAttribution();
    const within = greedy(attribution, false);
    const asking = greedy(attribution, true);
    expect(validate(plan(within.assignments), VECTOR_COMPLEXES)).toEqual([]);
    expect(within.assignments.some((item) => item.complexId === "C03")).toBe(false);
    const naive = scorePlan(biggestFirst(VECTOR_COMPLEXES)!, attribution).expected;
    expect(scorePlan(within, attribution).expected).toBeGreaterThan(naive);
    expect(scorePlan(asking, attribution).expected).toBeGreaterThanOrEqual(scorePlan(within, attribution).expected);
  });
});
