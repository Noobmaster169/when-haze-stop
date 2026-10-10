import { describe, expect, it } from "vitest";

import type { ModelSkill } from "@/lib/api/simulation-schemas";

import { shadowSummary } from "./model-state";

const lead = (network: "doe" | "nea", leadDays: number, model: number | null, v2: number | null, cases = 10) => ({ network, leadDays, cases, model, persistence: model === null ? null : model + 2, persistenceCases: model === null ? 0 : cases, v2, v2Cases: v2 === null ? 0 : cases });

const BASE: ModelSkill = {
  mode: "shadow",
  modelVersion: "2026-10-18-ab12cd",
  since: "2026-10-18T03:20:00.000Z",
  shadowDays: 9,
  shadowDaysRequired: 14,
  cases: 10,
  comparedCases: 10,
  gain: 0.14,
  gainRequired: 0.1,
  passed: false,
  leads: [lead("doe", 1, 12.4, 14.4), lead("doe", 2, 20.1, 21)],
};

describe("what the page says about the learned model", () => {
  it("says it is off when nothing asks it", () => {
    expect(shadowSummary({ ...BASE, mode: "off", modelVersion: null, since: null, shadowDays: 0, gain: null })).toBe("Not running. Nothing on this page comes from a learned model.");
  });

  it("counts the shadow days still to go and the gain so far", () => {
    expect(shadowSummary(BASE)).toBe("In shadow: 9 of 14 days scored, 14% better than the hourly forecast a day ahead at DOE stations. Needs 5 more days of shadow data. Nothing a person sees comes from it yet.");
  });

  it("says when the rule has passed and when the model is live", () => {
    expect(shadowSummary({ ...BASE, shadowDays: 14, passed: true })).toBe("In shadow: 14 of 14 days scored, 14% better than the hourly forecast a day ahead at DOE stations. The rule has passed; it may be set live.");
    expect(shadowSummary({ ...BASE, mode: "live", shadowDays: 20, passed: true })).toBe("Live: the outlook for the days ahead is this model's. 20 days scored, 14% better than the hourly forecast a day ahead at DOE stations.");
  });

  it("does not claim a gain it cannot measure", () => {
    expect(shadowSummary({ ...BASE, gain: null, shadowDays: 2 })).toBe("In shadow: 2 of 14 days scored, not yet comparable with the hourly forecast. Needs 12 more days of shadow data. Nothing a person sees comes from it yet.");
  });

  it("names the gain as the missing condition once the days are in", () => {
    expect(shadowSummary({ ...BASE, shadowDays: 14, gain: 0.04 })).toBe("In shadow: 14 of 14 days scored, 4% better than the hourly forecast a day ahead at DOE stations. Needs 10% better. Nothing a person sees comes from it yet.");
  });

  it("says worse when the gain is negative", () => {
    expect(shadowSummary({ ...BASE, gain: -0.05 })).toBe("In shadow: 9 of 14 days scored, 5% worse than the hourly forecast a day ahead at DOE stations. Needs 5 more days of shadow data. Nothing a person sees comes from it yet.");
  });

  it("uses the singular for the last day", () => {
    expect(shadowSummary({ ...BASE, shadowDays: 13 })).toContain("Needs 1 more day of shadow data.");
  });
});
