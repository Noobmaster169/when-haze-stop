import { describe, expect, it } from "vitest";

import type { AirMonitor, StoredDay } from "@/lib/api/haze-schemas";

import { airBand, dayLines, fireHeight, hazeShare, monthMarks, windState } from "./history-days";
import { pm25At } from "./map-data";
import { monitorKind } from "./monitors";
import { pm25ToApi } from "./scale";

const EMPTY: StoredDay = { day: "2025-07-25", cells: 0, frpMw: 0, windHours: 0, airports: 0, hazeAirports: 0, monitors: 0, pm25: null };
/** 20 July 2025 as the backend's test serves it, with the fires and wind of a full day added. */
const HAZY: StoredDay = { day: "2025-07-20", cells: 1234, frpMw: 56789, windHours: 24, airports: 3, hazeAirports: 2, monitors: 1, pm25: 41.3 };

describe("a concentration as an index", () => {
  it("follows DOE's bands, the narrow one between 101 and 150 included", () => {
    expect(pm25ToApi(0)).toBe(0);
    expect(pm25ToApi(12)).toBe(50);
    expect(pm25ToApi(50.4)).toBe(100);
    expect(pm25ToApi(55.4)).toBe(150);
    expect(pm25ToApi(102.9)).toBeCloseTo(175, 5);
    expect(pm25ToApi(600)).toBeGreaterThan(500);
  });
});

describe("reading a stored day for the strip", () => {
  it("says what each of the four kinds of data holds, and that a kind is missing", () => {
    expect(windState(HAZY)).toBe("full");
    expect(windState({ ...HAZY, windHours: 9 })).toBe("part");
    expect(windState(EMPTY)).toBe("none");
    expect(hazeShare(HAZY)).toBeCloseTo(2 / 3, 5);
    expect(hazeShare(EMPTY)).toBeNull();
    expect(airBand(HAZY)).toBe("moderate");
    expect(airBand({ ...HAZY, pm25: 80 })).toBe("unhealthy");
    expect(airBand(EMPTY)).toBeNull();
    expect(fireHeight(0, 100)).toBe(0);
    expect(fireHeight(25, 100)).toBe(50);
    expect(fireHeight(0.1, 100)).toBe(8);
  });

  it("writes a day in three lines", () => {
    expect(dayLines(HAZY)).toEqual(["1,234 fire cells, 56,789 MW", "Haze at 2 of 3 airports", "PM2.5 41 ug/m3 at 1 instrument"]);
    expect(dayLines(EMPTY)).toEqual(["No fires stored", "No airport reports", "No PM2.5 measured"]);
  });

  it("marks where each month starts, with the year where it changes", () => {
    const days = ["2025-11-30", "2025-12-01", "2025-12-31", "2026-01-01", "2026-01-02"].map((day) => ({ ...EMPTY, day }));
    // The strip starts a day before December, so November's name would sit on December's.
    expect(monthMarks(days)).toEqual([
      { index: 1, label: "Dec" },
      { index: 3, label: "Jan 2026" },
    ]);
    expect(monthMarks([{ ...EMPTY, day: "2025-01-01" }])).toEqual([{ index: 0, label: "Jan 2025" }]);
  });
});

describe("an instrument on a past day", () => {
  const start = Date.parse("2025-07-20T00:00:00Z");
  const sensor: AirMonitor = {
    id: "openaq:11760952",
    name: "Taman Tun Dr. Ismail",
    source: "openaq",
    provider: "AirGradient",
    reference: false,
    averaging: "1h",
    lat: 3.141,
    lon: 101.627,
    pm25: [62.2, 47.3, 31.9, 35.8, 29.5, ...new Array<null>(19).fill(null)],
  };

  it("gives the hour a moment falls in, each hour stamped with its end", () => {
    expect(pm25At(sensor, start, start)).toBe(62.2);
    expect(pm25At(sensor, start, start + 3_600_000)).toBe(62.2);
    expect(pm25At(sensor, start, start + 3_600_001)).toBe(47.3);
    expect(pm25At(sensor, start, start + 12 * 3_600_000)).toBeNull();
    expect(pm25At(sensor, start, start + 30 * 3_600_000)).toBeNull();
  });

  it("is named for what it is", () => {
    expect(monitorKind(sensor)).toBe("AirGradient low-cost sensor");
    expect(monitorKind({ ...sensor, provider: "AirNow", reference: true })).toBe("AirNow reference monitor");
    expect(monitorKind({ ...sensor, source: "doe" })).toBe("DOE station");
  });
});
