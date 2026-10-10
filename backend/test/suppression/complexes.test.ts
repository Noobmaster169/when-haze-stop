import { describe, expect, it } from "vitest";

import { distanceKm } from "../../src/haze/grid";
import { regionOf } from "../../src/haze/regions";
import { type CellFacts, findComplexes, groupCells, neighbours, type Place, RADIUS_KM, recentCells } from "../../src/suppression/complexes";
import { COUNCIL_CELLS, COUNCIL_DAYS_BURNING } from "../fixtures/recorded-council";

const cells = recentCells(COUNCIL_CELLS.map(([day, lat10, lon10, frpMw]) => ({ day, lat10, lon10, frpMw })));
const days = new Map(COUNCIL_DAYS_BURNING.map(([lat10, lon10, n]) => [`${lat10}|${lon10}`, n]));
const facts: CellFacts = {
  daysBurning: (lat10, lon10) => days.get(`${lat10}|${lon10}`) ?? 0,
  detections: () => null,
  peatShare: () => 0,
};
function placeOf(lat: number, lon: number): Place {
  const region = regionOf(lat, lon);
  if (region === "Borneo") return { name: "", province: "", country: "Indonesia", area: "kalimantan" };
  if (region === "Sumatra and the Riau islands") return { name: "", province: "", country: "Indonesia", area: "sumatra" };
  return { name: "", province: "", country: "Malaysia", area: "peninsula" };
}

describe("fire complexes", () => {
  it("puts every burning cell in exactly one complex", () => {
    const groups = groupCells(cells);
    const placed = groups.flat();
    expect(placed).toHaveLength(cells.length);
    expect(new Set(placed).size).toBe(cells.length);
  });

  it("keeps every complex compact, so a task force can be sent to it", () => {
    for (const group of groupCells(cells)) {
      const [seed] = group;
      for (const cell of group) {
        expect(distanceKm(seed.lat10 / 10, seed.lon10 / 10, cell.lat10 / 10, cell.lon10 / 10)).toBeLessThanOrEqual(RADIUS_KM + 0.01);
      }
    }
  });

  it("names complexes strongest first and conserves fire power", () => {
    const complexes = findComplexes(cells, facts, placeOf);
    expect(complexes[0].id).toBe("C01");
    for (let k = 1; k < complexes.length; k++) expect(complexes[k].firePowerMw).toBeLessThanOrEqual(complexes[k - 1].firePowerMw);
    const total = complexes.reduce((sum, complex) => sum + complex.firePowerMw, 0);
    expect(total).toBeCloseTo(cells.reduce((sum, cell) => sum + cell.frpMw, 0), 3);
  });

  it("tells a smouldering complex from a new surface fire by how long it has burned", () => {
    const complexes = findComplexes(cells, facts, placeOf);
    const jambi = complexes.find((complex) => complex.place.area === "sumatra")!;
    const johor = complexes.find((complex) => complex.place.country === "Malaysia")!;
    // The Jambi belt has burned on most of the last 30 days; the Johor fires are days old.
    expect(jambi.persistenceDays).toBeGreaterThanOrEqual(15);
    expect(jambi.peat).toBe(true);
    expect(johor.persistenceDays).toBeLessThan(7);
    expect(johor.peat).toBe(false);
  });

  it("estimates detections from fire power where the files did not count them", () => {
    const [first] = findComplexes(cells, facts, placeOf);
    expect(first.detections).toBeCloseTo(first.firePowerMw / 7, 6);
    expect(first.nightShare).toBeNull();
  });

  it("counts real detections and the night share where they are known", () => {
    const counted: CellFacts = { ...facts, detections: () => ({ all: 4, night: 3 }) };
    const [first] = findComplexes(cells, counted, placeOf);
    expect(first.detections).toBe(4 * first.cells.length);
    expect(first.nightShare).toBeCloseTo(0.75, 6);
  });

  it("finds neighbours whose fire could relight a complex", () => {
    const complexes = findComplexes(cells, facts, placeOf);
    const near = neighbours(complexes);
    for (const [id, others] of near) {
      for (const other of others) expect(near.get(other)).toContain(id);
    }
  });
});
