import { describe, expect, it } from "vitest";

import type { DayOutlook } from "@/lib/api/haze-schemas";

import { dayLine, headline, trend } from "./outlook-words";

// Nilai (CA23N) as the station panel showed it at 16:00 on 10 October 2026.
const chance = (c100: number, c150: number, c180: number, c200: number) => ({ "100": c100, "150": c150, "180": c180, "200": c200 });
const nilai: DayOutlook[] = [
  { day: "2026-10-10", observedPeak: 181, forecastPeak: null, low: null, high: null, chance: chance(1, 1, 1, 0.01) },
  { day: "2026-10-11", observedPeak: null, forecastPeak: 154, low: 128, high: 168, chance: chance(0.99, 0.56, 0.01, 0.01) },
  { day: "2026-10-12", observedPeak: null, forecastPeak: 94, low: 34, high: 110, chance: chance(0.27, 0.01, 0.01, 0.01) },
  { day: "2026-10-13", observedPeak: null, forecastPeak: 92, low: 47, high: 128, chance: chance(0.58, 0.01, 0.01, 0.01) },
];

describe("a station's outlook in words", () => {
  it("says when unhealthy air is likely to ease, as the clearing alert would", () => {
    expect(headline(168, nilai)).toBe("Easing: likely below 100 by Monday.");
  });

  it("says rising when tomorrow is likely to pass a line the reading is under", () => {
    const rising = [nilai[0], { ...nilai[1], chance: chance(0.99, 0.8, 0.2, 0.01) }];
    expect(headline(140, rising)).toBe("Rising: likely above 150 tomorrow.");
  });

  it("says when clean air is likely to turn hazy, and when it should stay clean", () => {
    expect(headline(80, [nilai[0], { ...nilai[1], chance: chance(0.3, 0, 0, 0) }, { ...nilai[2], chance: chance(0.7, 0, 0, 0) }])).toBe("Haze likely: above 100 by Monday.");
    expect(headline(60, [nilai[0], { ...nilai[2], chance: chance(0.05, 0, 0, 0) }])).toBe("Likely to stay under 100 for the next few days.");
  });

  it("names the line passed today, and only the line in doubt on later days", () => {
    expect(nilai.map(dayLine)).toEqual(["Passed 180, schools close", "Almost certainly above 100, 56% chance above 150", "27% chance above 100", "58% chance above 100"]);
  });

  it("gives the change over six hours, and nothing without a reading that far back", () => {
    const readings = [
      { at: "2026-10-10T02:00:00.000Z", api: 181 },
      { at: "2026-10-10T08:00:00.000Z", api: 168 },
    ];
    expect(trend(readings, Date.parse("2026-10-10T08:00:00.000Z"))).toBe(-13);
    expect(trend(readings.slice(1), Date.parse("2026-10-10T08:00:00.000Z"))).toBeNull();
  });
});
