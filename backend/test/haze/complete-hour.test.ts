import { describe, expect, it } from "vitest";

import { newestCompleteHour } from "../../src/haze/complete-hour";

const at = (iso: string) => new Date(iso);

/** Stations reporting each hour as DOE had posted them on 10 October 2026. */
const AT_0705 = [
  { at: at("2026-10-10T05:00:00Z"), stations: 68 },
  { at: at("2026-10-10T06:00:00Z"), stations: 68 },
  { at: at("2026-10-10T07:00:00Z"), stations: 3 },
];
const AT_0720 = [...AT_0705.slice(0, 2), { at: at("2026-10-10T07:00:00Z"), stations: 68 }];

describe("the hour a run starts from", () => {
  it("passes over an hour DOE has only begun to post", () => {
    expect(newestCompleteHour(AT_0705)).toEqual(at("2026-10-10T06:00:00Z"));
  });

  it("takes the hour once most stations are in", () => {
    expect(newestCompleteHour(AT_0720)).toEqual(at("2026-10-10T07:00:00Z"));
  });

  it("has no hour when nothing is stored", () => {
    expect(newestCompleteHour([])).toBeNull();
  });
});
