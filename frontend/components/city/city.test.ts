import { describe, expect, it } from "vitest";

import { airAt, middayOf } from "./air-at";
import { beamTransmission, lookFor, type Palette } from "./haze-look";
import { sunPosition } from "./sun";

const KLCC = { lat: 3.15785, lon: 101.71165 };
/** Kuala Lumpur time on 10 October 2026, as a UTC instant. */
const klTime = (hours: number): number => Date.UTC(2026, 9, 10) - 8 * 3_600_000 + hours * 3_600_000;

const palette: Palette = { zenith: [0.3, 0.5, 0.8], horizon: [0.8, 0.88, 0.95], haze: [0.8, 0.77, 0.68], night: [0.05, 0.07, 0.12], glow: [0.89, 0.65, 0.39] };

describe("the sun over Kuala Lumpur", () => {
  it("stands about 80 degrees up at 13:00, its October noon", () => {
    expect(sunPosition(klTime(13), KLCC.lat, KLCC.lon).elevation).toBeCloseTo(80.2, 0);
  });

  it("rises in the east a little after seven and sets in the west a little before seven", () => {
    const dawn = sunPosition(klTime(7.25), KLCC.lat, KLCC.lon);
    const dusk = sunPosition(klTime(19), KLCC.lat, KLCC.lon);
    expect(sunPosition(klTime(7), KLCC.lat, KLCC.lon).elevation).toBeLessThan(0);
    expect(dawn.elevation).toBeGreaterThan(0);
    expect(dawn.azimuth).toBeCloseTo(97, 0);
    expect(dusk.elevation).toBeLessThan(0);
    expect(dusk.azimuth).toBeCloseTo(263, 0);
  });
});

describe("what an hour of haze looks like", () => {
  // KL at 07:00 UTC on 10 October 2026: API 167, 88 ug/m3, the backend's 6.8 km and depth 0.71.
  const hazy = { visibilityKm: 6.8, aerosolDepth: 0.71 };
  const clean = { visibilityKm: 296, aerosolDepth: 0 };
  const noon = { elevation: 80, azimuth: 180 };

  it("leaves 2% contrast at the visibility distance", () => {
    const { fogDensity } = lookFor(hazy, noon, palette);
    expect(Math.exp(-fogDensity * 6800)).toBeCloseTo(0.02, 4);
  });

  it("dims the noon sun to under half and reddens it", () => {
    const [red, , blue] = beamTransmission(hazy.aerosolDepth, 80);
    const [cleanRed, , cleanBlue] = beamTransmission(0, 80);
    expect((red + blue) / 2).toBeLessThan(0.5);
    expect(red / blue).toBeGreaterThan(cleanRed / cleanBlue);
  });

  it("turns the light lost from the beam into a brighter, flatter sky light", () => {
    const hazyLook = lookFor(hazy, noon, palette);
    const cleanLook = lookFor(clean, noon, palette);
    expect(hazyLook.sunIntensity).toBeLessThan(cleanLook.sunIntensity);
    expect(hazyLook.ambientIntensity).toBeGreaterThan(cleanLook.ambientIntensity);
  });

  it("greys a blue sky toward the haze colour", () => {
    const [, , cleanBlue] = lookFor(clean, noon, palette).skyTop;
    const [, , hazyBlue] = lookFor(hazy, noon, palette).skyTop;
    expect(hazyBlue).toBeLessThan(cleanBlue);
  });

  it("glows warmer on a hazy night than on a clean one, from the city's light on the smoke", () => {
    const midnight = { elevation: -60, azimuth: 270 };
    const [hazyRed, , hazyBlue] = lookFor(hazy, midnight, palette).fogColour;
    const [cleanRed, , cleanBlue] = lookFor(clean, midnight, palette).fogColour;
    expect(hazyRed - hazyBlue).toBeGreaterThan(cleanRed - cleanBlue);
  });

  it("has no sun at night", () => {
    const night = lookFor(hazy, { elevation: -30, azimuth: 270 }, palette);
    expect(night.sunIntensity).toBe(0);
    expect(night.daylight).toBe(0);
  });
});

describe("the city's air between its hours", () => {
  const hour = (at: string, api: number, visibilityKm: number, observed = true) => ({ at, observed, api, pm25: api / 2, visibilityKm, aerosolDepth: 3.9 / visibilityKm });
  const hours = [hour("2026-10-10T06:00:00.000Z", 160, 2), hour("2026-10-10T07:00:00.000Z", 170, 20), hour("2026-10-10T08:00:00.000Z", 171, 20, false)];

  it("answers an hour's own values on the hour", () => {
    const onTheHour = airAt(hours, Date.parse("2026-10-10T07:00:00.000Z"));
    expect(onTheHour).toMatchObject({ api: 170, observed: true });
    expect(onTheHour?.visibilityKm).toBeCloseTo(20, 9);
  });

  it("blends visibility through extinction between hours", () => {
    const half = airAt(hours, Date.parse("2026-10-10T06:30:00.000Z"));
    expect(half?.api).toBe(165);
    expect(half?.visibilityKm).toBeCloseTo(3.64, 2);
  });

  it("holds the ends outside the span, and has nothing for no hours", () => {
    expect(airAt(hours, Date.parse("2026-10-09T00:00:00.000Z"))?.api).toBe(160);
    expect(airAt(hours, Date.parse("2026-10-20T00:00:00.000Z"))).toMatchObject({ api: 171, observed: false });
    expect(airAt([], 0)).toBeNull();
  });

  it("finds 13:00 Kuala Lumpur time on the same local day", () => {
    expect(new Date(middayOf(Date.parse("2026-10-10T07:00:00.000Z"))).toISOString()).toBe("2026-10-10T05:00:00.000Z");
    // 01:00 on the 11th in KL is 17:00 UTC on the 10th: its midday is the 11th's.
    expect(new Date(middayOf(Date.parse("2026-10-10T17:00:00.000Z"))).toISOString()).toBe("2026-10-11T05:00:00.000Z");
  });
});
