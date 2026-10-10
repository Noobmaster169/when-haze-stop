import { describe, expect, it } from "vitest";

import { dayLabel, linear, niceAxis } from "./scale";

describe("niceAxis", () => {
  it("rounds out to whole steps that hold every value", () => {
    expect(niceAxis([21.3, 138], 25)).toEqual({ low: 0, high: 150, ticks: [0, 25, 50, 75, 100, 125, 150] });
  });

  it("reaches below zero for falls", () => {
    expect(niceAxis([-71.8, 94.6], 20).ticks).toEqual([-80, -60, -40, -20, 0, 20, 40, 60, 80, 100]);
  });

  it("gives a flat series one step of height", () => {
    expect(niceAxis([40, 40], 10)).toEqual({ low: 40, high: 50, ticks: [40, 50] });
  });
});

describe("linear", () => {
  it("maps the ends of the domain onto the ends of the range, either way round", () => {
    const y = linear(0, 150, 200, 20);
    expect(y(0)).toBe(200);
    expect(y(150)).toBe(20);
    expect(y(75)).toBe(110);
  });
});

describe("dayLabel", () => {
  it("names the calendar day without shifting it", () => {
    expect(dayLabel("2026-09-14")).toBe("14 Sep");
  });
});
