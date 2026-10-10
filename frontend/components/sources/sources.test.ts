import { describe, expect, it } from "vitest";

import type { SourceFetch, SourceStatus } from "@/lib/api/source-schemas";

import { ago, describeDetail, duration, sourceState } from "./source-state";

const NOW = new Date("2026-10-10T06:30:00Z");

/** The station list as DOE served it on 10 October 2026: 68 stations in 16 states. */
const FETCHED: SourceFetch = {
  id: 1,
  source: "doe-stations",
  startedAt: "2026-10-10T06:20:00.000Z",
  finishedAt: "2026-10-10T06:20:05.600Z",
  ok: true,
  detail: { stations: 68, states: 16 },
  error: null,
};

const FAILED: SourceFetch = { ...FETCHED, id: 2, startedAt: "2026-10-10T06:25:00.000Z", finishedAt: "2026-10-10T06:25:20.000Z", ok: false, detail: {}, error: "DOE station map did not answer" };

const SOURCE: SourceStatus = {
  id: "doe-stations",
  name: "Station list",
  provider: "Department of Environment Malaysia (APIMS)",
  what: "",
  endpoint: "",
  link: "",
  cadence: "Every hour, at 20 past",
  everyHours: 1,
  tracked: true,
  lastSuccess: FETCHED,
  lastFailure: null,
  day: { ok: 1, failed: 0 },
};

describe("the state of a source", () => {
  it("is up to date within two cycles of its last fetch", () => {
    expect(sourceState(SOURCE, NOW)).toBe("fresh");
    expect(sourceState(SOURCE, new Date("2026-10-10T08:45:00Z"))).toBe("fresh");
  });

  it("is late once two cycles and the grace have passed", () => {
    expect(sourceState(SOURCE, new Date("2026-10-10T08:55:00Z"))).toBe("late");
  });

  it("is failing when the newest attempt failed, and recovers with the next good one", () => {
    expect(sourceState({ ...SOURCE, lastFailure: FAILED }, NOW)).toBe("failing");
    expect(sourceState({ ...SOURCE, lastSuccess: null, lastFailure: FAILED }, NOW)).toBe("failing");
    const later = { ...FETCHED, startedAt: "2026-10-10T06:28:00.000Z", finishedAt: "2026-10-10T06:28:05.000Z" };
    expect(sourceState({ ...SOURCE, lastSuccess: later, lastFailure: FAILED }, NOW)).toBe("fresh");
  });

  it("separates a source never fetched from one not on a schedule", () => {
    expect(sourceState({ ...SOURCE, lastSuccess: null }, NOW)).toBe("never");
    expect(sourceState({ ...SOURCE, tracked: false, everyHours: null, lastSuccess: null }, NOW)).toBe("untracked");
  });
});

describe("how a fetch reads", () => {
  it("names the counts in reading order and shows times in UTC", () => {
    expect(describeDetail({ lastDay: "2026-10-10", added: 1234, stations: 68, newestReading: "2026-10-10T06:00:00.000Z" })).toEqual([
      { label: "stations", value: "68" },
      { label: "new readings", value: "1,234" },
      { label: "newest reading", value: "10 Oct 06:00" },
      { label: "last day", value: "2026-10-10" },
    ]);
  });

  it("gives how long it took and how long ago", () => {
    expect(duration(FETCHED)).toBe("5.6 s");
    expect(duration({ ...FETCHED, finishedAt: "2026-10-10T06:23:10.000Z" })).toBe("3 min 10 s");
    expect(ago(FETCHED.finishedAt, NOW)).toBe("10 min ago");
    expect(ago("2026-10-09T06:30:00Z", NOW)).toBe("24 h ago");
  });
});
