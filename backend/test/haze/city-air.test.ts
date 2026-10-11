import { describe, expect, it } from "vitest";

import { apiToPm25 } from "../../src/haze/api-index";
import { cityHours, stationShares, type StationSeries } from "../../src/haze/city-air";
import { aerosolDepth, massExtinction, visibilityKm } from "../../src/haze/visibility";

// The Petronas Twin Towers, where the KL scene is centred.
const KLCC = { lat: 3.15785, lon: 101.71165 };

// KL's two DOE stations as recorded at 07:00 UTC on 10 October 2026, with the next hour's stored forecast.
function batuMuda(): StationSeries {
  return { id: "CA15W", name: "Batu Muda", lat: 3.212429, lon: 101.682218, readings: [{ at: "2026-10-10T07:00:00.000Z", api: 162 }], forecast: [{ at: "2026-10-10T08:00:00.000Z", api: 160 }] };
}
function cheras(): StationSeries {
  return { id: "CA16W", name: "Cheras", lat: 3.10626, lon: 101.717931, readings: [{ at: "2026-10-10T07:00:00.000Z", api: 171 }], forecast: [{ at: "2026-10-10T08:00:00.000Z", api: 171 }] };
}

describe("how far one can see through haze", () => {
  it("uses 6.4 m2/g at the assumed 70% humidity", () => {
    expect(massExtinction()).toBeCloseTo(6.4, 2);
  });

  it("sees about 296 km through clean dry air, the Rayleigh limit", () => {
    expect(visibilityKm(0)).toBeCloseTo(296, 0);
    expect(aerosolDepth(0)).toBe(0);
  });

  it("sees about 12 km at API 100 and about 2.4 km at API 300", () => {
    expect(visibilityKm(apiToPm25(100))).toBeCloseTo(11.7, 1);
    expect(visibilityKm(apiToPm25(300))).toBeCloseTo(2.4, 1);
  });

  it("sees less the higher the index, all the way up", () => {
    const seen = [25, 50, 100, 150, 200, 300, 400, 500].map((api) => visibilityKm(apiToPm25(api)));
    seen.slice(1).forEach((km, index) => expect(km).toBeLessThan(seen[index]));
  });
});

describe("one city's air from the stations around it", () => {
  it("leans to the nearer station, and the shares add to one", () => {
    const [far, near] = stationShares(KLCC.lat, KLCC.lon, [batuMuda(), cheras()]);
    expect(near.km).toBeLessThan(far.km);
    expect(near.share).toBeGreaterThan(far.share);
    expect(near.share + far.share).toBeCloseTo(1, 9);
  });

  it("blends a read hour in concentration, between the two readings", () => {
    const [read] = cityHours(KLCC.lat, KLCC.lon, [batuMuda(), cheras()]);
    expect(read).toMatchObject({ at: "2026-10-10T07:00:00.000Z", observed: true, api: 167, pm25: 88.2, visibilityKm: 6.8 });
  });

  it("marks forecast hours, and blends the forecasts", () => {
    const [, ahead] = cityHours(KLCC.lat, KLCC.lon, [batuMuda(), cheras()]);
    expect(ahead).toMatchObject({ at: "2026-10-10T08:00:00.000Z", observed: false, api: 166 });
  });

  it("takes a reading over another station's forecast for the same hour", () => {
    const lagging = { ...batuMuda(), readings: [], forecast: [{ at: "2026-10-10T07:00:00.000Z", api: 400 }] };
    const [hour] = cityHours(KLCC.lat, KLCC.lon, [lagging, cheras()]);
    expect(hour).toMatchObject({ observed: true, api: 171 });
  });

  it("answers from the one station that read when the other was silent", () => {
    const silent = { ...cheras(), readings: [], forecast: [] };
    const [hour] = cityHours(KLCC.lat, KLCC.lon, [batuMuda(), silent]);
    expect(hour).toMatchObject({ observed: true, api: 162 });
  });
});
