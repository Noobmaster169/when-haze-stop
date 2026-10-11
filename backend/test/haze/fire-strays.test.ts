import { describe, expect, it } from "vitest";

import { withoutStrays } from "../../src/haze/fire-strays";
import type { FireCellDay } from "../../src/haze/fires";
import { KALIMANTAN_COMPLEX, SARAWAK_LONE } from "../fixtures/recorded-fire-days";

const dot = (cell: FireCellDay) => ({ day: cell.day, lat: cell.lat10 / 10 + 0.05, lon: cell.lon10 / 10 + 0.05, frpMw: cell.frpMw });

describe("lone fire dots", () => {
  const all = [...KALIMANTAN_COMPLEX, SARAWAK_LONE].map(dot);

  it("keeps every cell of a fire complex, the weak ones too", () => {
    const shown = KALIMANTAN_COMPLEX.map(dot);
    expect(withoutStrays(shown, all)).toEqual(shown);
  });

  it("drops a cell with no other fire within 25 km that day", () => {
    expect(withoutStrays([dot(SARAWAK_LONE)], all)).toEqual([]);
  });

  it("does not let a cell count itself, or a fire on another day", () => {
    const yesterday = { ...dot(SARAWAK_LONE), day: "2026-10-08" };
    expect(withoutStrays([dot(SARAWAK_LONE)], [dot(SARAWAK_LONE), { ...yesterday, lat: yesterday.lat + 0.1 }])).toEqual([]);
  });

  it("keeps a lone cell once a neighbour burns within reach", () => {
    // The cell north of it, 11 km away.
    const neighbour = { ...dot(SARAWAK_LONE), lat: dot(SARAWAK_LONE).lat + 0.1 };
    expect(withoutStrays([dot(SARAWAK_LONE)], [...all, neighbour])).toHaveLength(1);
  });
});
