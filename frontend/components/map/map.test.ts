import { describe, expect, it } from "vitest";

import { dayName, malaysiaMidnights, malaysiaWhen } from "@/lib/malaysia-time";

import { bracket, decodeBytes, sampleField, sampleWind } from "./field";
import { clampView, fitScale, REGION, toLat, toLon, toX, toY, zoomAt } from "./geo";
import { visibilityAt } from "./map-data";
import { band, colourAt, parseHex, type Stop } from "./scale";

const GRID = { lon0: 96, lat0: -6, nx: 2, ny: 2, step: 1 };

describe("reading an airport's reports", () => {
  const airport = {
    icao: "WMKK",
    name: "Kuala Lumpur Intl",
    lat: 2.74,
    lon: 101.71,
    reports: [
      { at: "2026-10-10T07:00:00Z", m: 5000, wx: "HZ" },
      { at: "2026-10-10T08:00:00Z", m: 6000, wx: null },
    ],
    times: [Date.parse("2026-10-10T07:00:00Z"), Date.parse("2026-10-10T08:00:00Z")],
  };

  it("gives the newest report at or before a moment, and nothing once the airport has been silent three hours", () => {
    expect(visibilityAt(airport, Date.parse("2026-10-10T07:30:00Z"))).toEqual({ at: "2026-10-10T07:00:00Z", m: 5000, wx: "HZ" });
    expect(visibilityAt(airport, Date.parse("2026-10-10T09:00:00Z"))?.m).toBe(6000);
    expect(visibilityAt(airport, Date.parse("2026-10-10T06:00:00Z"))).toBeNull();
    expect(visibilityAt(airport, Date.parse("2026-10-10T12:00:00Z"))).toBeNull();
  });
});

describe("reading a frame", () => {
  it("decodes one byte a cell and reads it back as API", () => {
    const bytes = decodeBytes(btoa(String.fromCharCode(50, 100, 50, 100)));
    expect([...bytes]).toEqual([50, 100, 50, 100]);
    expect(sampleField(bytes, GRID, 96.5, -5.5)).toBe(100);
    expect(sampleField(bytes, GRID, 97.0, -5.5)).toBeCloseTo(150, 0);
  });

  it("reads wind in metres a second from signed bytes", () => {
    const uv = new Int8Array([8, -16, 8, -16, 8, -16, 8, -16]);
    expect(sampleWind(uv, GRID, 96.4, -5.2)).toEqual([1, -2]);
  });

  it("finds the two frames a moment sits between", () => {
    const times = [0, 10, 20, 40];
    expect(bracket(times, -5)).toEqual({ from: 0, to: 0, share: 0 });
    expect(bracket(times, 15)).toEqual({ from: 1, to: 2, share: 0.5 });
    expect(bracket(times, 30)).toEqual({ from: 2, to: 3, share: 0.5 });
    expect(bracket(times, 99)).toEqual({ from: 3, to: 3, share: 0 });
  });
});

describe("the scale", () => {
  const stops: Stop[] = [
    { at: 0, rgb: parseHex("#000000") },
    { at: 100, rgb: parseHex("#c86432") },
  ];

  it("names Malaysia's bands at their edges", () => {
    expect([50, 51, 100, 101, 200, 201, 300, 301].map(band)).toEqual(["Good", "Moderate", "Moderate", "Unhealthy", "Unhealthy", "Very unhealthy", "Very unhealthy", "Hazardous"]);
  });

  it("blends between stops and holds at the ends", () => {
    expect(colourAt(stops, 50)).toEqual([100, 50, 25]);
    expect(colourAt(stops, 500)).toEqual([200, 100, 50]);
    expect(colourAt(stops, -3)).toEqual([0, 0, 0]);
  });
});

describe("the view", () => {
  const size = { width: 880, height: 560 };

  it("round-trips a point through the projection", () => {
    const view = { cx: 103, cy: 2, scale: 50 };
    expect(toLon(view, size, toX(view, size, 101.7))).toBeCloseTo(101.7);
    expect(toLat(view, size, toY(view, size, 3.1))).toBeCloseTo(3.1);
  });

  it("keeps the point under the cursor still while zooming", () => {
    const view = { cx: 103, cy: 2, scale: 60 };
    const lon = toLon(view, size, 200);
    const zoomed = zoomAt(view, size, 200, 150, 1.5);
    expect(toLon(zoomed, size, 200)).toBeCloseTo(lon);
    expect(zoomed.scale).toBeCloseTo(90);
  });

  it("does not zoom out past the region or in past nine times it", () => {
    const fit = fitScale(size);
    expect(clampView({ cx: 103, cy: 2, scale: 1 }, size).scale).toBeCloseTo(fit);
    expect(clampView({ cx: 103, cy: 2, scale: 1e6 }, size).scale).toBeCloseTo(fit * 9);
  });

  it("never lets the view's edge pass the region's, however far it is dragged", () => {
    const scale = fitScale(size) * 2;
    for (const [cx, cy] of [[60, 2], [150, 2], [108, -40], [108, 40]]) {
      const view = clampView({ cx, cy, scale }, size);
      expect(toLon(view, size, 0)).toBeGreaterThanOrEqual(REGION.lon0 - 1e-9);
      expect(toLon(view, size, size.width)).toBeLessThanOrEqual(REGION.lon1 + 1e-9);
      expect(toLat(view, size, 0)).toBeLessThanOrEqual(REGION.lat1 + 1e-9);
      expect(toLat(view, size, size.height)).toBeGreaterThanOrEqual(REGION.lat0 - 1e-9);
    }
  });

  it("reaches all of Malaysia, Semporna in eastern Sabah included", () => {
    expect(REGION.lon1).toBeGreaterThan(118.62);
  });
});

describe("Malaysian time", () => {
  it("reads an instant eight hours ahead of UTC", () => {
    expect(malaysiaWhen("2026-10-10T03:00:00Z")).toBe("Sat 10 Oct, 11:00");
    expect(malaysiaWhen("2026-10-10T17:30:00Z")).toBe("Sun 11 Oct, 01:30");
    expect(dayName("2026-10-11")).toBe("Sun 11 Oct");
  });

  it("marks local midnights inside a span", () => {
    const marks = malaysiaMidnights(Date.parse("2026-10-10T03:00:00Z"), Date.parse("2026-10-12T03:00:00Z"));
    expect(marks.map((mark) => new Date(mark).toISOString())).toEqual(["2026-10-10T16:00:00.000Z", "2026-10-11T16:00:00.000Z"]);
  });
});
