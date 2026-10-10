import { describe, expect, it } from "vitest";

import { ModelLive } from "./model-schemas";

/** The smallest answer the backend can give: nothing stored, the hourly forecast showing. */
const MINIMAL = {
  source: { kind: "hourly", modelVersion: null, issuedAt: null, trial: false, record: { checkedDays: 0, gain: null, backtest: null } },
  skill: { mode: "shadow", modelVersion: null, since: null, shadowDays: 0, shadowDaysRequired: 14, cases: 0, comparedCases: 0, gain: null, gainRequired: 0.1, passed: false, leads: [] },
  nextCheckAt: null,
  watch: [],
  ledger: [],
};

describe("the live record's schema", () => {
  it("parses the smallest valid answer", () => {
    const result = ModelLive.safeParse(MINIMAL);
    expect(result.success, result.success ? "" : result.error.message).toBe(true);
  });

  it("parses a ledger row with every miss", () => {
    const row = { asOf: "2026-10-08T05:00:00.000Z", stationId: "CA24N", stationName: "Seremban", day: "2026-10-09", leadDays: 1, forecast: 168, low: 127, high: 198, observed: 71, miss: 97, persistenceMiss: null, v2Miss: 12.5 };
    expect(ModelLive.safeParse({ ...MINIMAL, ledger: [row] }).success).toBe(true);
  });

  it("refuses an answer without its ledger, naming the field", () => {
    const withoutLedger: Record<string, unknown> = { ...MINIMAL };
    delete withoutLedger.ledger;
    const result = ModelLive.safeParse(withoutLedger);
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.message).toContain("ledger");
  });
});
