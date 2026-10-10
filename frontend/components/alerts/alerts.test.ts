import { describe, expect, it } from "vitest";

import type { Statement } from "@/lib/api/statement-schemas";

import { dayPeak } from "./day-strip";
import { areas, badge, reports } from "./statement-row";

/** The closure of 9 October 2026 as the alerts page lists it, from five headlines that day. */
const CLOSURE: Statement = {
  id: 6,
  issuer: "moe",
  issuerName: "Ministry of Education",
  kind: "order",
  action: "schools-close",
  summary: "Schools in four states, Kuala Lumpur, Putrajaya and Rompin district close on 9 October.",
  quote: "Jerebu: Sekolah di empat negeri, KL, Putrajaya dan daerah Rompin ditutup esok - Fadhlina",
  states: ["Selangor", "WP Kuala Lumpur", "WP Putrajaya"],
  districts: ["Rompin"],
  nationwide: false,
  threshold: null,
  sustainedDays: null,
  effectiveFrom: "2026-10-09",
  effectiveUntil: null,
  publishedAt: "2026-10-08T14:49:00.000Z",
  url: "https://news.google.com/rss/articles/x",
  outlet: "Harian Metro",
  reports: 5,
  status: "in-force",
};

describe("a statement row", () => {
  it("names the areas without the WP prefix, districts last", () => {
    expect(areas(CLOSURE)).toBe("Selangor, Kuala Lumpur, Putrajaya, Rompin");
    expect(areas({ ...CLOSURE, kind: "rule", nationwide: true })).toBe("Wherever the line is passed");
    expect(areas({ ...CLOSURE, nationwide: true })).toBe("All of Malaysia");
  });

  it("says who reported it and how many more did", () => {
    expect(reports(CLOSURE)).toBe("Harian Metro and 4 more");
    expect(reports({ ...CLOSURE, reports: 1 })).toBe("Harian Metro");
  });
});

describe("an issuer's badge", () => {
  it("uses a national body's initials, and a state body's own short name", () => {
    expect(badge(CLOSURE)).toBe("KPM");
    expect(badge({ ...CLOSURE, issuer: "state", issuerName: "Jabatan Agama Islam Selangor (JAIS)" })).toBe("JAIS");
    expect(badge({ ...CLOSURE, issuer: "other", issuerName: "JAKIM" })).toBe("JAKIM");
    expect(badge({ ...CLOSURE, issuer: "ruler", issuerName: "Johor Regent" })).toBe("Ruler");
  });
});

describe("a day in the strip", () => {
  it("shows what was read when it is higher than the forecast, else the forecast", () => {
    // Seremban on 10 October 2026: read up to 189, forecast peak 173.
    expect(dayPeak({ day: "2026-10-10", observedPeak: 189, forecastPeak: 173, low: null, high: null, chance: {} })).toBe(189);
    expect(dayPeak({ day: "2026-10-11", observedPeak: null, forecastPeak: 173, low: 150, high: 196, chance: {} })).toBe(173);
  });
});

describe("the demo replay", () => {
  it("replays the evening of 8 October in the order the alerts would have gone out", async () => {
    const { REPLAY, RULE } = await import("./demo/replay");
    expect([RULE.at, ...REPLAY.map((alert) => alert.at)]).toEqual(["8 Oct, 19:09", "8 Oct, 20:20", "8 Oct, 21:20"]);
    // Worded exactly as the live forecast alert is, so the demo shows the product and not a mock-up of it.
    expect(REPLAY[0].message).toBe("Seremban: schools may close tomorrow. 76% chance of API above 180, the Education Ministry's closing line.");
  });
});
