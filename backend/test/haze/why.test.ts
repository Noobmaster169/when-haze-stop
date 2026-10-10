import { describe, expect, it } from "vitest";

import { LITTLE_SMOKE, SMOKE_MATTERS_UGM3, whyFor } from "../../src/haze/why";

/** A day whose calibrated smoke rises by `swing` ug/m3 to a peak at 15:00 and falls back. */
function dayWithSwing(swing: number): number[] {
  return Array.from({ length: 24 }, (_, hour) => 4 + swing * Math.exp(-(((hour - 15) / 3) ** 2)));
}

describe("the reason under a learned day", () => {
  it("names the peak hour and the wind when the simulation's smoke varies enough", () => {
    expect(whyFor({ physicsDay: dayWithSwing(12), hourOfPeak: 15, windFromDeg: 45 })).toBe("Simulated smoke peaks around 15:00 on a north-east wind.");
  });

  it("says little smoke reaches the station below the line, and exactly at it names the peak", () => {
    expect(whyFor({ physicsDay: dayWithSwing(SMOKE_MATTERS_UGM3 - 0.01), hourOfPeak: 15, windFromDeg: 45 })).toBe(LITTLE_SMOKE);
    expect(whyFor({ physicsDay: dayWithSwing(SMOKE_MATTERS_UGM3), hourOfPeak: 15, windFromDeg: 45 })).toMatch(/^Simulated smoke peaks around 15:00/);
    expect(whyFor({ physicsDay: [], hourOfPeak: 0, windFromDeg: null })).toBe(LITTLE_SMOKE);
    expect(whyFor({ physicsDay: Array.from({ length: 24 }, () => 0), hourOfPeak: 0, windFromDeg: 180 })).toBe(LITTLE_SMOKE);
  });

  it("ends at the hour when no wind is stored for it", () => {
    expect(whyFor({ physicsDay: dayWithSwing(20), hourOfPeak: 3, windFromDeg: null })).toBe("Simulated smoke peaks around 03:00.");
  });

  it("reads the wind on the eight compass points", () => {
    const points: [number, string][] = [
      [0, "north"],
      [45, "north-east"],
      [90, "east"],
      [135, "south-east"],
      [180, "south"],
      [225, "south-west"],
      [270, "west"],
      [315, "north-west"],
      [-135, "south-west"],
      [359, "north"],
    ];
    for (const [degrees, name] of points) {
      expect(whyFor({ physicsDay: dayWithSwing(20), hourOfPeak: 15, windFromDeg: degrees })).toBe(`Simulated smoke peaks around 15:00 on a ${name} wind.`);
    }
  });
});
