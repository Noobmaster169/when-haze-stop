import { describe, expect, it } from "vitest";

import { screenDetections } from "../../src/haze/fire-screen";
import { nearLand } from "../../src/haze/land";
import { parseFirmsCsv } from "../../src/sources/firms";
import { COAST, FLARES, GLINT, SMALL_SATURATED } from "../fixtures/recorded-fires";

const read = (group: { satellite: string; csv: string }) => parseFirmsCsv(group.csv, group.satellite);

describe("telling land from open sea", () => {
  it("knows the peninsula, Sumatra and Borneo from the sea between them", () => {
    expect(nearLand(3.139, 101.687)).toBe(true); // Kuala Lumpur
    expect(nearLand(-2.99, 104.76)).toBe(true); // Palembang
    expect(nearLand(-3.32, 114.59)).toBe(true); // Banjarmasin
    expect(nearLand(0.7, 106.2)).toBe(false); // the open sea of the 9 October glint
    expect(nearLand(5.6, 105.0)).toBe(false); // the Malay Basin gas fields
  });
});

describe("screening fire detections", () => {
  it("drops a pass that saturated a whole block of sea in daylight", () => {
    const glint = read(GLINT);
    expect(glint.every((hit) => hit.saturated && hit.daytime)).toBe(true);
    expect(screenDetections(glint)).toEqual({ kept: [], glint: 60, offshore: 0 });
  });

  it("drops gas flares far from any coast and keeps fires on a coast the outline misses", () => {
    const flares = read(FLARES);
    const coast = read(COAST);
    const screened = screenDetections([...flares, ...coast]);
    expect(screened.offshore).toBe(flares.length);
    expect(screened.kept).toEqual(coast);
  });

  it("does not call a block glint on too few detections, even when every one is saturated", () => {
    const small = read(SMALL_SATURATED);
    expect(small.length).toBeLessThan(50);
    expect(screenDetections(small)).toEqual({ kept: small, glint: 0, offshore: 0 });
  });

  it("never lets a sunlit glint block take real fires in other passes with it", () => {
    const coast = read(COAST);
    const screened = screenDetections([...read(GLINT), ...coast]);
    expect(screened.kept).toEqual(coast);
    expect(screened.glint).toBe(60);
  });
});
