import { describe, expect, it } from "vitest";

import type { ForecastSource } from "@/lib/api/haze-schemas";

import { captionFor } from "./forecast-caption";

const at = (iso: string): number => Date.parse(iso);

// The issue of 11 October 2026 at 00:00 UTC, 08:00 in Malaysia, with the committed backtest's hazy-day misses at a day ahead.
const learned: ForecastSource = {
  kind: "learned",
  modelVersion: "2026-10-11-c88cac5a",
  issuedAt: "2026-10-11T00:00:00Z",
  trial: true,
  record: { checkedDays: 0, gain: null, backtest: { model: 22.9, persistence: 26.0, v2: 27.4 } },
};
const hourly: ForecastSource = { kind: "hourly", modelVersion: null, issuedAt: null, trial: false, record: { checkedDays: 0, gain: null, backtest: null } };

const asOf = at("2026-10-11T08:00:00Z");
const learnedFrom = at("2026-10-11T16:00:00Z");
const monday = at("2026-10-12T06:00:00Z");

describe("the caption under the map", () => {
  it("names the learned model, its trial, its issue and its record for a moment it covers", () => {
    expect(captionFor(monday, asOf, learned, learnedFrom)).toBe(
      "Forecast for Mon 12 Oct 14:00 by the learned model (trial), issued Sun 08:00. Checked on 0 days so far. In the 15 month backtest it was 12% closer than no change on hazy days.",
    );
  });

  it("drops the trial once the shadow rule has passed, and counts one day in the singular", () => {
    const proven = { ...learned, trial: false, record: { ...learned.record, checkedDays: 1 } };
    expect(captionFor(monday, asOf, proven, learnedFrom)).toBe(
      "Forecast for Mon 12 Oct 14:00 by the learned model, issued Sun 08:00. Checked on 1 day so far. In the 15 month backtest it was 12% closer than no change on hazy days.",
    );
  });

  it("leaves the backtest sentence out when the model service has no report", () => {
    const unreported = { ...learned, record: { ...learned.record, checkedDays: 3, backtest: null } };
    expect(captionFor(monday, asOf, unreported, learnedFrom)).toBe("Forecast for Mon 12 Oct 14:00 by the learned model (trial), issued Sun 08:00. Checked on 3 days so far.");
  });

  it("names the hourly forecast before the first learned frame, and whenever the source is hourly", () => {
    const hourlyWords = "Forecast for Sun 11 Oct 20:00 by the hourly forecast, level with no change beyond a day.";
    const tonight = at("2026-10-11T12:00:00Z");
    expect(captionFor(tonight, asOf, learned, learnedFrom)).toBe(hourlyWords);
    expect(captionFor(tonight, asOf, hourly, null)).toBe(hourlyWords);
    expect(captionFor(monday, asOf, hourly, null)).toBe("Forecast for Mon 12 Oct 14:00 by the hourly forecast, level with no change beyond a day.");
    expect(captionFor(monday, asOf, learned, null)).toBe("Forecast for Mon 12 Oct 14:00 by the hourly forecast, level with no change beyond a day.");
  });

  it("says the hourly forecast before any run has a source", () => {
    expect(captionFor(monday, asOf, null, null)).toBe("Forecast for Mon 12 Oct 14:00 by the hourly forecast, level with no change beyond a day.");
  });

  it("is empty at and before the newest reading", () => {
    expect(captionFor(asOf, asOf, learned, learnedFrom)).toBe("");
    expect(captionFor(asOf - 1, asOf, learned, learnedFrom)).toBe("");
  });
});
