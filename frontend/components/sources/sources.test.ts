import { describe, expect, it } from "vitest";

import type { SourceFetch, SourceStatus } from "@/lib/api/source-schemas";

import { DATASETS } from "./datasets";
import { ago, duration, nextFetch, sourceState, worstState } from "./source-state";

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
  marks: [{ at: "2026-10-10T06:20:00.000Z", ok: true }],
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

describe("a dataset as a whole", () => {
  it("is as healthy as its least healthy fetch", () => {
    expect(worstState([SOURCE, { ...SOURCE, id: "doe-readings", lastFailure: FAILED }], NOW)).toBe("failing");
    expect(worstState([SOURCE, SOURCE], NOW)).toBe("fresh");
  });

  it("expects the next fetch at the first cycle a full interval after the last attempt", () => {
    expect(nextFetch(SOURCE)).toBe(Date.parse("2026-10-10T07:20:00Z"));
    // A fetch after a restart at 06:25 is still followed by the 07:20 cycle.
    expect(nextFetch({ ...SOURCE, lastFailure: FAILED })).toBe(Date.parse("2026-10-10T07:20:00Z"));
    // Fires go every third cycle: a fetch at 06:20 is next asked at 09:20.
    expect(nextFetch({ ...SOURCE, everyHours: 3 })).toBe(Date.parse("2026-10-10T09:20:00Z"));
    expect(nextFetch({ ...SOURCE, everyHours: null })).toBeNull();
  });

  it("shows the station counts from the station list fetch and the newest hour in Malaysian time", () => {
    const air = DATASETS[0];
    const details: Record<string, SourceFetch["detail"]> = { "doe-stations": FETCHED.detail, "doe-readings": { received: 1234, newestReading: "2026-10-10T07:00:00.000Z" } };
    expect(air.stats((id) => details[id] ?? null)).toEqual([
      { icon: "pin", value: "68", label: "stations" },
      { icon: "map", value: "16", label: "states" },
      { icon: "chart", value: "1,234", label: "readings received" },
      { icon: "clock", value: "15:00", label: "newest hour, 10 Oct" },
    ]);
  });

  it("writes the weather span short, naming the month once when it does not change", () => {
    const weather = DATASETS[2];
    const span = (from: string, to: string) => weather.stats(() => ({ points: 345, hours: 312, from, to }))[2].value;
    expect(span("2026-10-02T00:00:00.000Z", "2026-10-14T23:00:00.000Z")).toBe("2 to 15 Oct");
    expect(span("2026-09-28T00:00:00.000Z", "2026-10-03T00:00:00.000Z")).toBe("28 Sep to 3 Oct");
  });

  it("counts measured PM2.5 from both of its sources, and says n/a for OpenAQ where no key is set", () => {
    const pm25 = DATASETS.find((dataset) => dataset.key === "pm25");
    const nea = { stations: 5, hours: 210, added: 5, newestReading: "2026-10-10T11:00:00.000Z" };
    expect(pm25?.stats((id) => (id === "nea" ? nea : { sensors: 62, added: 118 })).map((stat) => stat.value)).toEqual(["5", "62", "118", "19:00"]);
    expect(pm25?.stats((id) => (id === "nea" ? nea : null)).map((stat) => stat.value)).toEqual(["5", "n/a", "n/a", "19:00"]);
    expect(pm25?.summary(nea)).toBe("5 new of 210 hours");
  });

  it("says n/a for a number an older fetch did not record", () => {
    const fires = DATASETS[1];
    expect(fires.stats(() => ({ detections: 267264, cellDays: 8544 })).map((stat) => stat.value)).toEqual(["267,264", "n/a", "n/a", "8,544"]);
  });
});

describe("how a fetch reads", () => {
  it("gives how long it took and how long ago", () => {
    expect(duration(FETCHED)).toBe("5.6 s");
    expect(duration({ ...FETCHED, finishedAt: "2026-10-10T06:23:10.000Z" })).toBe("3 min 10 s");
    expect(ago(FETCHED.finishedAt, NOW)).toBe("10 min ago");
    expect(ago("2026-10-09T06:30:00Z", NOW)).toBe("24 h ago");
  });
});
