import { describe, expect, it } from "vitest";

import { parseMetars, visibilityOf } from "../../src/sources/metar";
import { parseNea } from "../../src/sources/nea";
import { METAR_JSON, NEA_PM25_DAY_JSON, NEA_PSI_DAY_JSON, NEA_PSI_JSON } from "../fixtures/recorded-context";

describe("reading what the context sources send", () => {
  it("reads the visibility group of a raw METAR in metres, and the miles only as a fallback", () => {
    expect(visibilityOf("METAR WIPP 100800Z 12005KT 0350 R11/0350D R29/0400D FU SCT015 33/23 Q1007", 0.22)).toBe(350);
    expect(visibilityOf("METAR WBGS 100800Z VRB02KT 9999 SCT018 34/23 Q1005", "6+")).toBe(10000);
    expect(visibilityOf("METAR WMKC 100800Z 06009KT 030V100 CAVOK 30/25 Q1005", "6+")).toBe(10000);
    // A remark about smoke is not a visibility, and 4 miles is 6400 m.
    expect(visibilityOf("METAR WAOO 100800Z 10010KT NSC 34/19 Q1005 RMK 1200 FU IN APCH", 3.98)).toBe(6400);
    expect(visibilityOf("METAR WAOO 100800Z 10010KT NSC 34/19", null)).toBeNull();
  });

  it("reads the recorded METARs: the airport, when, how far one could see and what was in the air", () => {
    const reports = parseMetars(METAR_JSON);
    expect(reports).toHaveLength(29);
    const palembang = reports.find((report) => report.icao === "WIPP");
    expect(palembang).toMatchObject({ name: "Palembang/Badaruddin Arpt", visibilityM: 350, weather: "FU", lat: -2.898, lon: 104.7 });
    const changi = reports.find((report) => report.icao === "WSSS");
    expect(changi).toMatchObject({ name: "Singapore/Changi Intl", visibilityM: 3500, weather: "HZ", observedAt: new Date("2026-10-10T08:30:00Z") });
    const bintulu = reports.find((report) => report.icao === "WBGB");
    expect(bintulu).toMatchObject({ visibilityM: 10000, weather: null });
  });

  it("joins NEA's PM2.5 and PSI feeds on region and hour", () => {
    const hours = parseNea(NEA_PM25_DAY_JSON, NEA_PSI_DAY_JSON);
    // 23 hours of PM2.5 and 3 of PSI, five regions each.
    expect(hours).toHaveLength(23 * 5);
    expect(hours[0]).toEqual({ region: "central", observedAt: new Date("2026-10-08T17:00:00Z"), pm25Hourly: 153, pm2524h: 97, psi24h: 144 });
    expect(hours.filter((hour) => hour.psi24h !== null)).toHaveLength(3 * 5);
    expect(hours.at(-1)).toMatchObject({ region: "west", observedAt: new Date("2026-10-09T15:00:00Z"), psi24h: null });
  });

  it("reads the newest PSI hour on its own", () => {
    const hours = parseNea(JSON.stringify({ items: [] }), NEA_PSI_JSON);
    expect(hours).toHaveLength(5);
    expect(hours.find((hour) => hour.region === "central")).toMatchObject({ observedAt: new Date("2026-10-10T08:00:00Z"), psi24h: 170, pm2524h: 122, pm25Hourly: null });
  });
});
