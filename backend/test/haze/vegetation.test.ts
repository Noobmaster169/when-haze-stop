import { describe, expect, it } from "vitest";

import { burningCells } from "../../src/haze/burning";
import { onVegetation } from "../../src/haze/vegetation";
import { parseFirmsCsv } from "../../src/sources/firms";
import { LIVE_FIRE } from "../fixtures/recorded-archive";
import { COAST_GLINT } from "../fixtures/recorded-coast";

describe("whether the ground is vegetation", () => {
  it("says no on a refinery, a city, an industrial island and the sea", () => {
    expect(onVegetation(1.365, 104.13)).toBe(false); // Pengerang refinery, Johor
    expect(onVegetation(3.152, 101.7)).toBe(false); // Kuala Lumpur city centre
    expect(onVegetation(1.265, 103.695)).toBe(false); // Jurong Island, Singapore
    expect(onVegetation(5.0, 105.0)).toBe(false); // South China Sea
  });

  it("says yes on peat swamp forest and plantation", () => {
    expect(onVegetation(-2.5, 113.9)).toBe(true); // Sebangau, Central Kalimantan
    expect(onVegetation(1.75, 103.35)).toBe(true); // inland Johor
  });

  it("leaves a point outside the region to the region check, as the land screen does", () => {
    // Central Thailand: the South East Asia files reach it, and the region check drops it.
    expect(onVegetation(15, 100)).toBe(true);
  });
});

describe("the fire screen and the ground", () => {
  it("drops glint on coastal water that the other screens let through", () => {
    const screened = burningCells(parseFirmsCsv(COAST_GLINT.csv, COAST_GLINT.satellite), new Set());
    expect(screened.notVegetation).toBe(3);
    expect(screened.cells.every((cell) => cell.burningMw === 0)).toBe(true);
  });

  it("keeps a fire burning in Kalimantan's forest", () => {
    const fire = parseFirmsCsv(LIVE_FIRE.csv, LIVE_FIRE.satellite);
    const screened = burningCells(fire, new Set());
    expect(screened.notVegetation).toBe(0);
    expect(screened.cells.some((cell) => (cell.burningMw ?? 0) > 0)).toBe(true);
  });
});
