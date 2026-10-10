import { describe, expect, it } from "vitest";

import type { DayOutlook } from "../../src/contracts";
import { conditionsFor } from "../../src/haze/alert-rules";

const never = (): boolean => false;

function day(date: string, forecastPeak: number, chance: Record<string, number>): DayOutlook {
  return { day: date, observedPeak: null, forecastPeak, low: null, high: null, chance };
}

describe("what is worth an alert", () => {
  // "A town" below is a worked case for one rule each, since the recorded day held no arriving or clearing station.
  // Seremban at 11:00 on 10 October 2026 read 182, with these chances for the 11th from the first live run.
  const seremban = { stationId: "CA24N", name: "Seremban", api: 182, days: [day("2026-10-10", 173, {}), day("2026-10-11", 173, { 150: 0.91, 180: 0.43 })] };

  it("says a reading passed the highest line it is over, with what that means", () => {
    const [observed] = conditionsFor(seremban, never);
    expect(observed).toMatchObject({ kind: "observed", threshold: 180 });
    expect(observed.message).toBe("Seremban: API 182, above 180. Schools close under the Education Ministry rule.");
  });

  it("keeps an open alert through a dip just under its line", () => {
    const dipped = { ...seremban, api: 178 };
    expect(conditionsFor(dipped, never).find((item) => item.kind === "observed")?.threshold).toBe(150);
    expect(conditionsFor(dipped, (kind, threshold) => kind === "observed" && threshold === 180).find((item) => item.kind === "observed")?.threshold).toBe(180);
  });

  it("warns of a line the forecast is likely to pass tomorrow, and not of an unlikely one", () => {
    const likely = { stationId: "X", name: "A town", api: 140, days: [day("2026-10-10", 140, {}), day("2026-10-11", 172, { 100: 0.99, 150: 0.8, 180: 0.3, 200: 0.05 })] };
    const arriving = conditionsFor(likely, never).find((item) => item.kind === "arriving");
    expect(arriving).toMatchObject({ threshold: 150 });
    expect(arriving?.message).toBe("A town: 80% chance of API above 150 tomorrow. Three days in a row above 150 closes schools.");
    expect(conditionsFor(seremban, never).some((item) => item.kind === "arriving")).toBe(false);
  });

  it("says when the air is likely to drop back under 100", () => {
    const easing = { stationId: "X", name: "A town", api: 130, days: [day("2026-10-10", 130, {}), day("2026-10-11", 110, { 100: 0.7 }), day("2026-10-12", 80, { 100: 0.15 })] };
    const clearing = conditionsFor(easing, never).find((item) => item.kind === "clearing");
    expect(clearing?.message).toBe("A town: likely to drop below 100 by Monday. Outdoor activities could resume then.");
  });

  it("says nothing about a station that has not reported", () => {
    expect(conditionsFor({ ...seremban, api: null }, never)).toEqual([]);
  });
});
