import type { Attribution } from "../../src/suppression/attribution";
import type { Complex, Place } from "../../src/suppression/complexes";

/**
 * A test vector for the scoring arithmetic, NOT data: three made-up complexes
 * with flat, round contributions, so a test can work out by hand what a plan
 * must remove. Nothing here is shown to a person. Real fire cells for the
 * council are in recorded-council.ts.
 */

const place = (area: Place["area"], country: Place["country"]): Place => ({ name: "test", province: "test", country, area });

function complex(id: string, area: Place["area"], peat: boolean, detections: number, lat: number, lon: number): Complex {
  return {
    id,
    place: place(area, area === "peninsula" ? "Malaysia" : "Indonesia"),
    lat,
    lon,
    cells: [{ lat10: Math.floor(lat * 10), lon10: Math.floor(lon * 10) }],
    firePowerMw: detections * 7,
    detections,
    persistenceDays: peat ? 20 : 1,
    nightShare: peat ? 0.7 : 0,
    peatShare: peat ? 0.8 : 0,
    peat,
  };
}

export const VECTOR_COMPLEXES: Complex[] = [
  complex("C01", "kalimantan", true, 100, -2.9, 110.8),
  complex("C02", "peninsula", false, 10, 1.65, 103.0),
  complex("C03", "sumatra", true, 50, -1.8, 103.9),
];

const HOURS = 24;
const DAYS = 14;
const flat = (value: number) => new Float32Array(HOURS).fill(value);

/** One wind member; each complex adds `perDay` ug/m3 at every hour for each of its emission days. */
export function vectorAttribution(perDay: Record<string, number> = { C01: 0.1, C02: 0.2, C03: 0.3 }): Attribution {
  const contributions = new Map<string, Float32Array[][]>();
  let ceiling = 0;
  for (const [id, value] of Object.entries(perDay)) {
    contributions.set(id, [Array.from({ length: DAYS + 1 }, () => flat(value))]);
    ceiling += value * DAYS;
  }
  return {
    asOf: "2026-10-10T06:00:00.000Z",
    dayOne: "2026-10-12",
    hours: HOURS,
    days: DAYS,
    members: [{ id: "W1", label: "test vector" }],
    baseline: [flat(60 + ceiling)],
    ceiling: [flat(ceiling)],
    contributions,
    complexes: VECTOR_COMPLEXES,
    winds: [],
  };
}
