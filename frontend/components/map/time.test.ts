import { describe, expect, it } from "vitest";

import { firesAt } from "./fires";
import type { MapData } from "./map-data";
import { atEdge, windowAround } from "./time-window";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (iso: string): number => Date.parse(iso);

/** Three cells in south Sumatra as stored on 7 to 10 October 2026: one that burned all four days, one that faded, one seen once. */
const BIG = { lat: -3.55, lon: 105.75 };
const FADING = { lat: -2.95, lon: 104.85 };
const ONCE = { lat: -3.25, lon: 112.15 };
const BY_DAY = new Map([
  ["2026-10-07", [{ ...BIG, frpMw: 2083 }, { ...FADING, frpMw: 58 }]],
  ["2026-10-08", [{ ...BIG, frpMw: 3132 }, { ...FADING, frpMw: 22 }]],
  ["2026-10-09", [{ ...BIG, frpMw: 2694 }]],
  ["2026-10-10", [{ ...BIG, frpMw: 2099 }, { ...ONCE, frpMw: 1122 }]],
]);

function mapWith(part: Partial<MapData>): MapData {
  const grid = { lon0: 96, lat0: -6, nx: 1, ny: 1, step: 1 };
  return { grid, windGrid: grid, asOf: at("2026-10-10T14:00:00Z"), times: [], fields: [], windTimes: [], winds: [], stations: [], fires: [], firesByDay: new Map(), airports: [], monitors: [], dayStart: null, ...part };
}

describe("the fires at a moment of the timeline", () => {
  const live = mapWith({ firesByDay: BY_DAY });
  const power = (moment: string): number[] => firesAt(live, at(moment)).map((fire) => fire.frpMw).sort((a, b) => b - a);

  it("are the cells seen that day and the two before, each at its strongest", () => {
    expect(power("2026-10-10T14:00:00Z")).toEqual([3132, 1122, 22]);
    expect(power("2026-10-09T02:00:00Z")).toEqual([3132, 58]);
  });

  it("change as the timeline goes back, and leave out what had not burned yet", () => {
    expect(power("2026-10-07T20:00:00Z")).toEqual([2083, 58]);
    expect(firesAt(live, at("2026-10-07T20:00:00Z")).some((fire) => fire.lon === ONCE.lon)).toBe(false);
  });

  it("stay as the run knew them through the forecast", () => {
    expect(power("2026-10-13T00:00:00Z")).toEqual(power("2026-10-10T14:00:00Z"));
  });

  it("are a past day's own fires at every hour of it", () => {
    const day = mapWith({ fires: [{ ...BIG, frpMw: 3132 }], dayStart: at("2026-10-08T00:00:00Z") });
    expect(firesAt(day, at("2026-10-08T03:00:00Z"))).toBe(day.fires);
  });
});

describe("the week the timeline spans while looking back", () => {
  const first = at("2024-12-31T00:00:00Z");
  const newest = at("2026-10-10T14:00:00Z");

  it("has the moment's day in the middle", () => {
    expect(windowAround(at("2025-08-20T12:00:00Z"), first, newest)).toEqual({ from: at("2025-08-17T00:00:00Z"), to: at("2025-08-24T00:00:00Z") });
  });

  it("ends at the newest reading and starts at the first stored day", () => {
    expect(windowAround(at("2026-10-09T12:00:00Z"), first, newest)).toEqual({ from: newest - 7 * DAY, to: newest });
    expect(windowAround(at("2025-01-01T12:00:00Z"), first, newest)).toEqual({ from: first, to: at("2025-01-05T00:00:00Z") });
  });

  it("moves on from its own end, so one drag after another reaches any day", () => {
    const week = windowAround(at("2025-08-20T12:00:00Z"), first, newest);
    expect(atEdge(week.from, week)).toBe(true);
    expect(atEdge(week.from + HOUR, week)).toBe(false);
    const earlier = windowAround(week.from, first, newest);
    expect(earlier.from).toBe(week.from - 3 * DAY);
    expect(windowAround(week.to, first, newest).to).toBe(week.to + 4 * DAY);
  });
});
