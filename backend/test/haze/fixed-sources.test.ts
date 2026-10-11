import { describe, expect, it } from "vitest";

import { toCellDays } from "../../src/haze/fires";
import { FIXED_MIN_DAYS, fixedMask, withoutFixedSources } from "../../src/haze/fixed-sources";
import { parseFirmsCsv } from "../../src/sources/firms";
import { parseFixedSources, parseSpans } from "../../src/sources/firms-archive";
import { AVAILABILITY, LABELLED_KERTEH, LIVE_FIRE, LIVE_KERTEH } from "../fixtures/recorded-archive";

/** The cells the labelled rows mark on enough separate days, the way the repository counts them. */
function sitesOf(csv: string): { lat100: number; lon100: number }[] {
  const days = new Map<string, Set<string>>();
  for (const source of parseFixedSources(csv)) {
    const key = `${Math.floor(source.lat * 100)}|${Math.floor(source.lon * 100)}`;
    days.set(key, (days.get(key) ?? new Set()).add(source.day));
  }
  return [...days]
    .filter(([, seen]) => seen.size >= FIXED_MIN_DAYS)
    .map(([key]) => ({ lat100: Number(key.split("|")[0]), lon100: Number(key.split("|")[1]) }));
}

describe("reading the FIRMS archive", () => {
  it("finds the days each VIIRS feed can be asked for and ignores the other products", () => {
    const spans = parseSpans(AVAILABILITY);
    expect(spans).toHaveLength(5);
    expect(spans).toContainEqual({ satellite: "snpp", labelled: true, from: "2012-01-20", to: "2026-06-30" });
    expect(spans).toContainEqual({ satellite: "noaa21", labelled: false, from: "2024-01-17", to: "2026-10-10" });
  });

  it("keeps only the rows NASA labels as something other than a vegetation fire", () => {
    const sources = parseFixedSources(LABELLED_KERTEH);
    expect(sources).toHaveLength(19);
    expect(sources.every((source) => source.kind === "static")).toBe(true);
  });

  it("refuses a file without the label column, which is what the live feed looks like", () => {
    expect(() => parseFixedSources(LIVE_FIRE.csv)).toThrow("missing a column");
  });
});

describe("taking fixed heat sources out of the fires", () => {
  const mask = fixedMask(sitesOf(LABELLED_KERTEH));
  const kerteh = LIVE_KERTEH.flatMap((group) => parseFirmsCsv(group.csv, group.satellite));
  const fire = parseFirmsCsv(LIVE_FIRE.csv, LIVE_FIRE.satellite);

  it("drops the gas complex the live feed reports every day, eight months after it was labelled", () => {
    const { burning, fixed } = withoutFixedSources(kerteh, mask);
    expect(kerteh).toHaveLength(67);
    expect(fixed).toBe(64);
    // What is left is two hotspots 4 km south of the complex and one 17 km west of it.
    expect(burning.map((hit) => hit.frpMw)).toEqual([0.9, 5.42, 2.01]);
    const before = toCellDays(kerteh).reduce((sum, cell) => sum + cell.frpMw, 0);
    const after = toCellDays(burning).reduce((sum, cell) => sum + cell.frpMw, 0);
    expect(after).toBeLessThan(before * 0.15);
  });

  it("leaves vegetation burning as it was", () => {
    expect(withoutFixedSources(fire, mask)).toEqual({ burning: fire, fixed: 0 });
  });

  it("changes nothing while no fixed source is known", () => {
    expect(withoutFixedSources(kerteh, fixedMask([]))).toEqual({ burning: kerteh, fixed: 0 });
  });
});
