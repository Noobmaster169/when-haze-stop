import { describe, expect, it } from "vitest";

import type { DayOutlook, Statement } from "../../src/contracts";
import { alertFor, type StationState } from "../../src/haze/alert-rules";
import { headlineFor } from "../../src/haze/headline";

const never = (): boolean => false;

function day(date: string, forecastPeak: number | null, chance: Record<string, number>, observedPeak: number | null = null): DayOutlook {
  return { day: date, observedPeak, forecastPeak, low: null, high: null, chance };
}

// Seremban at 11:00 on 10 October 2026 read 182, with these chances for the 11th from the first live run.
const SEREMBAN: StationState = {
  stationId: "CA24N",
  name: "Seremban",
  api: 182,
  days: [day("2026-10-10", 173, { 100: 1, 150: 1, 180: 1 }, 189), day("2026-10-11", 173, { 100: 0.99, 150: 0.91, 180: 0.43 })],
  yesterdayPeak: 187,
  orders: [],
};

/** The Negeri Sembilan closure of 9 October, as the alerts page lists it. */
const CLOSURE: Statement = {
  id: 41,
  issuer: "moe",
  issuerName: "Ministry of Education",
  kind: "order",
  action: "schools-close",
  summary: "All education institutions in Negeri Sembilan close from 9 October.",
  quote: "Semua institusi pendidikan di Negeri Sembilan ditutup esok",
  states: ["Negeri Sembilan"],
  districts: [],
  nationwide: false,
  threshold: null,
  sustainedDays: null,
  effectiveFrom: "2026-10-09",
  effectiveUntil: null,
  publishedAt: "2026-10-08T06:02:00.000Z",
  url: "https://news.google.com/rss/articles/x",
  outlet: "Astro Awani",
  reports: 3,
  status: "in-force",
};

describe("the one alert worth raising", () => {
  it("raises an order in force before anything the forecast says", () => {
    const alert = alertFor({ ...SEREMBAN, orders: [CLOSURE] }, never);
    expect(alert).toMatchObject({ kind: "order", threshold: 41 });
    expect(alert?.message).toBe("Ministry of Education: All education institutions in Negeri Sembilan close from 9 October.");
    expect(alertFor({ ...SEREMBAN, orders: [{ ...CLOSURE, status: "upcoming", effectiveFrom: "2026-10-12" }] }, never)?.message).toMatch(/ From Mon 12 Oct\.$/);
  });

  it("does not raise a reading that is above a line now: the map shows that", () => {
    expect(alertFor({ ...SEREMBAN, days: [SEREMBAN.days[0], day("2026-10-11", 120, { 100: 0.7, 150: 0.2, 180: 0.05 })] }, never)).toBeNull();
  });

  it("warns that schools may close when tomorrow is likely to pass 180, and holds it down to 50%", () => {
    const likely = { ...SEREMBAN, days: [SEREMBAN.days[0], day("2026-10-11", 192, { 150: 0.97, 180: 0.72 })] };
    const alert = alertFor(likely, never);
    expect(alert).toMatchObject({ kind: "arriving", threshold: 180 });
    expect(alert?.message).toBe("Seremban: schools may close tomorrow. 72% chance of API above 180, the Education Ministry's closing line.");
    const wavering = { ...SEREMBAN, days: [SEREMBAN.days[0], day("2026-10-11", 178, { 150: 0.95, 180: 0.55 })] };
    expect(alertFor(wavering, never)?.threshold).not.toBe(180);
    expect(alertFor(wavering, (kind, line) => kind === "arriving" && line === 180)?.threshold).toBe(180);
  });

  it("counts a third day above 150 only from 12 October, when the rule starts", () => {
    const third = { ...SEREMBAN, days: [day("2026-10-12", 160, { 150: 0.8 }, 158), day("2026-10-13", 165, { 150: 0.85, 180: 0.1 })] };
    expect(alertFor(third, never)?.message).toBe("Seremban: schools may close. 85% chance tomorrow is a third day above 150, which closes schools.");
    expect(alertFor({ ...third, yesterdayPeak: 140 }, never)).toBeNull();
    // On the 11th the rule is not yet in force, so the same numbers say nothing.
    expect(alertFor(SEREMBAN, never)).toBeNull();
  });

  it("says when the air is likely to drop back under 100", () => {
    const easing = { ...SEREMBAN, api: 130, days: [day("2026-10-10", 130, {}), day("2026-10-11", 110, { 100: 0.7 }), day("2026-10-12", 80, { 100: 0.15 })] };
    expect(alertFor(easing, never)?.message).toBe("Seremban: likely below 100 by Monday. Outdoor activities can resume then.");
    const tomorrow = { ...easing, days: [easing.days[0], day("2026-10-11", 80, { 100: 0.2 })] };
    expect(alertFor(tomorrow, never)?.message).toBe("Seremban: likely below 100 tomorrow. Outdoor activities can resume then.");
  });

  it("says nothing for a station that has not reported and no order covers", () => {
    expect(alertFor({ ...SEREMBAN, api: null }, never)).toBeNull();
  });
});

describe("what an area's card leads with", () => {
  it("is the forecast for tomorrow, also on a calm day", () => {
    expect(headlineFor(SEREMBAN)).toEqual({ tone: "watch", title: "Unhealthy tomorrow", sentence: "Peak near 173. Outdoor activities stop above 100; no school closure expected." });
    expect(headlineFor({ api: 40, yesterdayPeak: 45, days: [day("2026-10-10", 42, {}), day("2026-10-11", 48, { 100: 0.02 })] }).title).toBe("No action expected tomorrow");
    expect(headlineFor({ api: 182, yesterdayPeak: null, days: [] }).title).toBe("No forecast yet");
  });

  it("agrees with the alert about a closure", () => {
    const likely = { ...SEREMBAN, days: [SEREMBAN.days[0], day("2026-10-11", 192, { 150: 0.97, 180: 0.72 })] };
    expect(headlineFor(likely)).toMatchObject({ tone: "close", title: "Schools may close tomorrow" });
  });
});
