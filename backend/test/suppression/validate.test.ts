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
  it("accepts the package anywhere in Indonesia and Bomba at home", () => {
    expect(validate(plan([line("C01", "cl415", 1), line("C01", "helicopters", 3), line("C02", "bomba_domestic", 100)]), VECTOR_COMPLEXES)).toEqual([]);
  });

  it("asks Indonesia for nothing: every line is cleared of any consent a plan claimed", () => {
    const claimed = plan([{ ...line("C03", "cl415", 1), needsConsent: "sumatra" }, { ...line("C01", "ground_task_force", 150), needsConsent: "ground_crews" }]);
    expect(normalise(claimed).assignments.map((item) => item.needsConsent)).toEqual([null, null]);
    expect(validate(normalise(claimed), VECTOR_COMPLEXES)).toEqual([]);
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
    const rules = validate(plan([line("C01", "cl415", 1)]), VECTOR_COMPLEXES, { coastKm: new Map([["C01", 60]]) }).map((item) => item.rule);
    expect(rules).toEqual(["reach"]);
  });

  it("refuses a plan that costs more than the budget", () => {
    // Ten days of the scooper alone is RM 4.5 million, plus RM 1.7 million to deploy.
    const rules = validate(plan([line("C01", "cl415", 1, 1, 10)]), VECTOR_COMPLEXES, { budgetRm: 4_000_000 }).map((item) => item.rule);
    expect(rules).toEqual(["budget"]);
    expect(validate(plan([line("C02", "bomba_domestic", 100, 1, 14)]), VECTOR_COMPLEXES, { budgetRm: 4_000_000 })).toEqual([]);
  });

  it("names a complex that is not on the fact sheet", () => {
    expect(validate(plan([line("C77", "cl415", 1)]), VECTOR_COMPLEXES)[0].rule).toBe("unknown_complex");
  });
});

describe("the baselines", () => {
  it("send everything to the biggest and to the nearest fire in Indonesia, named by place", () => {
    const biggest = biggestFirst(VECTOR_COMPLEXES)!;
    expect(biggest.assignments.every((item) => item.complexId === "C01")).toBe(true);
    expect(biggest.title).not.toMatch(/C0\d/);
    // The Sumatra test fire is nearer KL than the Kalimantan one.
    expect(nearestFirst(VECTOR_COMPLEXES, { lat: 3.14, lon: 101.69 })!.assignments[0].complexId).toBe("C03");
  });

  it("make a valid greedy plan inside the budget that beats biggest-first", () => {
    const attribution = vectorAttribution();
    const computed = greedy(attribution, 8_000_000);
    expect(validate(plan(computed.assignments), VECTOR_COMPLEXES, { budgetRm: 8_000_000 })).toEqual([]);
    const naive = scorePlan(biggestFirst(VECTOR_COMPLEXES, 8_000_000)!, attribution).expected;
    expect(scorePlan(computed, attribution).expected).toBeGreaterThan(naive);
  });
});
