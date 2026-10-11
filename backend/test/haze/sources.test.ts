import { describe, expect, it } from "vitest";

import { toCellDays } from "../../src/haze/fires";
import { parseReadings, parseStations } from "../../src/sources/doe";
import { parseFirmsCsv } from "../../src/sources/firms";
import { assembleGrid } from "../../src/sources/weather";
import { DOE_HOURLY_JSON, DOE_MAP_JSON, FIRMS_CSV } from "../fixtures/recorded";
import { OPEN_METEO_ROW } from "../fixtures/recorded-weather";

describe("reading what the sources send", () => {
  it("reads DOE stations, with the town split from the state", () => {
    const stations = parseStations(DOE_MAP_JSON);
    expect(stations).toHaveLength(2);
    expect(stations[0]).toEqual({ id: "CA01R", name: "Kangar", state: "Perlis", stateId: 9, lat: 6.429928, lon: 100.210937 });
  });

  it("reads DOE hours as Malaysian time", () => {
    const readings = parseReadings(DOE_HOURLY_JSON);
    expect(readings.map((reading) => reading.api)).toEqual([167, 167, 169]);
    // 11:00 in Malaysia is 03:00 UTC.
    expect(readings[0].observedAt.toISOString()).toBe("2026-10-10T03:00:00.000Z");
  });

  it("reads FIRMS rows and keeps only the cells inside the region", () => {
    const detections = parseFirmsCsv(FIRMS_CSV, "snpp");
    expect(detections).toHaveLength(9);
    expect(detections[0]).toEqual({ satellite: "snpp", lat: -3.15776, lon: 113.95805, day: "2026-10-03", hour: 6, daytime: true, saturated: false, frpMw: 2.44 });
    // The other eight are east of New Guinea.
    expect(toCellDays(detections)).toEqual([{ day: "2026-10-03", lat10: -32, lon10: 1139, frpMw: 2.44 }]);
  });

  it("takes the largest satellite for a cell, not the sum of all three", () => {
    const [snpp] = parseFirmsCsv(FIRMS_CSV, "snpp");
    const cells = toCellDays([snpp, { ...snpp, satellite: "noaa20" }, { ...snpp, satellite: "noaa20" }]);
    expect(cells).toHaveLength(1);
    expect(cells[0].frpMw).toBeCloseTo(4.88);
  });

  it("turns an Open-Meteo row into eastward and northward wind, averaged over the two levels", () => {
    const grid = assembleGrid([OPEN_METEO_ROW]);
    expect(grid.start.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(grid.hours).toBe(3);
    // 6.9 m/s from 295 degrees at 925 hPa and 6.85 from 295 at 850: a wind blowing toward the east-south-east.
    expect(grid.u[0]).toBeCloseTo(6.231, 2);
    expect(grid.v[0]).toBeCloseTo(-2.906, 2);
    expect(grid.rain[1]).toBeCloseTo(2.7);
  });
});
