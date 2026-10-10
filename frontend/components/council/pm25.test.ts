import { describe, expect, it } from "vitest";

import { API_100_PM25, decodeBytes, pm25ToApi } from "./pm25";

describe("PM2.5 to the index", () => {
  it("lands on DOE's band edges", () => {
    expect(pm25ToApi(0)).toBe(0);
    expect(pm25ToApi(12)).toBeCloseTo(50);
    expect(pm25ToApi(API_100_PM25)).toBeCloseTo(100);
    expect(pm25ToApi(55.4)).toBeCloseTo(150);
    expect(pm25ToApi(150.4)).toBeCloseTo(200);
  });

  it("interpolates inside a band and carries on past the top", () => {
    expect(pm25ToApi(31.2)).toBeCloseTo(75);
    expect(pm25ToApi(600)).toBeGreaterThan(500);
  });

  it("decodes the maps' bytes", () => {
    expect([...decodeBytes(btoa(String.fromCharCode(0, 12, 255)))]).toEqual([0, 12, 255]);
  });
});
