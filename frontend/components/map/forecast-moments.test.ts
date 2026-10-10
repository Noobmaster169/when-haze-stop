import { describe, expect, it } from "vitest";

import { forecastMoments } from "./forecast-moments";

const at = (iso: string): number => Date.parse(iso);
const keys = (asOf: string, last: string): string[] => forecastMoments(at(asOf), at(last)).map((moment) => moment.key);

describe("the moments the chips jump to", () => {
  // The run of 10 October 2026 at 08:00 UTC: 16:00 in Malaysia, frames to the morning of the 13th.
  const asOf = "2026-10-10T08:00:00Z";
  const last = "2026-10-13T00:00:00Z";

  it("are now, tonight at 20:00, and the next two afternoons at 14:00, Malaysian time", () => {
    expect(forecastMoments(at(asOf), at(last))).toEqual([
      { key: "now", label: "Now", at: at(asOf) },
      { key: "tonight", label: "Tonight", at: at("2026-10-10T12:00:00Z") },
      { key: "tomorrow", label: "Tomorrow", at: at("2026-10-11T06:00:00Z") },
      { key: "dayAfter", label: "Day after", at: at("2026-10-12T06:00:00Z") },
    ]);
  });

  it("leave out tonight once 20:00 has passed", () => {
    expect(keys("2026-10-10T12:00:00Z", last)).toEqual(["now", "tomorrow", "dayAfter"]);
    expect(keys("2026-10-10T13:30:00Z", last)).toEqual(["now", "tomorrow", "dayAfter"]);
  });

  it("keep to the Malaysian day across UTC midnight: 23:00 UTC is 07:00 the next morning in Malaysia", () => {
    expect(forecastMoments(at("2026-10-10T23:00:00Z"), at(last)).map((moment) => [moment.key, new Date(moment.at).toISOString()])).toEqual([
      ["now", "2026-10-10T23:00:00.000Z"],
      ["tonight", "2026-10-11T12:00:00.000Z"],
      ["tomorrow", "2026-10-12T06:00:00.000Z"],
    ]);
  });

  it("start the day at a reading taken exactly at Malaysian midnight", () => {
    expect(keys("2026-10-10T16:00:00Z", last)).toEqual(["now", "tonight", "tomorrow"]);
    expect(forecastMoments(at("2026-10-10T16:00:00Z"), at(last))[1].at).toBe(at("2026-10-11T12:00:00Z"));
  });

  it("drop a moment past the last frame, and keep now whatever the frames", () => {
    expect(keys(asOf, "2026-10-11T06:00:00Z")).toEqual(["now", "tonight", "tomorrow"]);
    expect(keys(asOf, "2026-10-10T10:00:00Z")).toEqual(["now"]);
    expect(keys(asOf, "2026-10-09T00:00:00Z")).toEqual(["now"]);
  });
});
