import { describe, expect, it } from "vitest";

import { analogueStarts, extendWeather } from "../../src/suppression/analogue";
import { dayOneFor } from "../../src/suppression/package";
import { steadyWind } from "../fixtures/steady-wind";

describe("wind past the forecast", () => {
  it("keeps the forecast, then repeats the analogue to the end", () => {
    const points = 2;
    const forecast = { hours: 2, u: Float32Array.from([1, 1, 2, 2]), v: new Float32Array(4), rain: new Float32Array(4) };
    const analogue = { hours: 2, u: Float32Array.from([7, 7, 8, 8]), v: new Float32Array(4), rain: new Float32Array(4) };
    const extended = extendWeather(forecast, analogue, 5, points);
    expect(Array.from(extended.u)).toEqual([1, 1, 2, 2, 7, 7, 8, 8, 7, 7]);
    expect(extended.hours).toBe(5);
  });

  it("reads a real-shaped grid without changing the forecast hours", () => {
    const wind = steadyWind(new Date("2026-10-06T00:00:00Z"), 48, 3, -2);
    const extended = extendWeather(wind, wind, 96, wind.u.length / wind.hours);
    expect(extended.u.subarray(0, wind.u.length)).toEqual(wind.u);
  });

  it("takes whole ten-day windows going back from the data's hour", () => {
    const starts = analogueStarts(new Date("2026-10-10T11:00:00Z"), 3).map((date) => date.toISOString());
    expect(starts).toEqual(["2026-09-30T11:00:00.000Z", "2026-09-20T11:00:00.000Z", "2026-09-10T11:00:00.000Z"]);
  });
});

describe("plan day 1", () => {
  it("is two UTC days after the data's day, across a month's end", () => {
    expect(dayOneFor(new Date("2026-10-10T11:00:00Z"))).toBe("2026-10-12");
    expect(dayOneFor(new Date("2026-10-30T23:00:00Z"))).toBe("2026-11-01");
  });
});
