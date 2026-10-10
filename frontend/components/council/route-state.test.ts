import { describe, expect, it } from "vitest";

import { CouncilEvent, CouncilRun } from "@/lib/api/council-schemas";

import events from "./fixtures/council-run-1.json";
import recorded from "./fixtures/council-run-1-run.json";
import { fresherRun, hrefFor, laterStatus, longerLog, parsePlace, resolvePlace, type RunFacts } from "./route-state";

const done: RunFacts = { status: "done", hasVerdict: true };
const running: RunFacts = { status: "running", hasVerdict: false };
const queued: RunFacts = { status: "queued", hasVerdict: false };
const failed: RunFacts = { status: "failed", hasVerdict: false };
const unreadable: RunFacts = { status: "done", hasVerdict: false };

describe("reading the address", () => {
  it("reads the run and the view, and anything else as the start panel", () => {
    expect(parsePlace({})).toEqual({ runId: null, view: "start" });
    expect(parsePlace({ run: "8", view: "replay" })).toEqual({ runId: 8, view: "replay" });
    expect(parsePlace({ run: "8", view: "verdict" })).toEqual({ runId: 8, view: "verdict" });
    expect(parsePlace({ run: "8", view: "map" })).toEqual({ runId: 8, view: "start" });
    expect(parsePlace({ run: "-3", view: "replay" })).toEqual({ runId: null, view: "replay" });
    expect(parsePlace({ run: ["7", "8"], view: ["replay"] })).toEqual({ runId: 7, view: "replay" });
  });

  it("writes an address that reads back the same", () => {
    for (const place of [
      { runId: null, view: "start" as const },
      { runId: 7, view: "start" as const },
      { runId: 7, view: "replay" as const },
      { runId: 7, view: "verdict" as const },
    ]) {
      const query = Object.fromEntries(new URL(hrefFor(place), "http://x").searchParams);
      expect(parsePlace(query)).toEqual(place);
    }
    expect(hrefFor({ runId: 7, view: "start" })).toBe("/council?run=7");
  });
});

describe("what an address shows", () => {
  it.each([
    ["start, no runs", { runId: null, view: "start" }, null, null, { runId: null, view: "start" }, null],
    ["start, newest selected", { runId: null, view: "start" }, 8, done, { runId: 8, view: "start" }, null],
    ["a chosen run on the start panel", { runId: 7, view: "start" }, 8, done, { runId: 7, view: "start" }, null],
    ["a finished replay", { runId: 1, view: "replay" }, 8, done, { runId: 1, view: "replay" }, null],
    ["a live replay", { runId: 9, view: "replay" }, 9, running, { runId: 9, view: "replay" }, null],
    ["a queued run's replay", { runId: 9, view: "replay" }, 9, queued, { runId: 9, view: "replay" }, null],
    ["a failed run's replay", { runId: 2, view: "replay" }, 8, failed, { runId: 2, view: "replay" }, null],
    ["a verdict", { runId: 8, view: "verdict" }, 8, done, { runId: 8, view: "verdict" }, null],
    ["a running run's verdict", { runId: 9, view: "verdict" }, 9, running, { runId: 9, view: "replay" }, "/council?run=9&view=replay"],
    ["a failed run's verdict", { runId: 2, view: "verdict" }, 8, failed, { runId: 2, view: "replay" }, "/council?run=2&view=replay"],
    ["an unreadable verdict", { runId: 3, view: "verdict" }, 8, unreadable, { runId: 3, view: "replay" }, "/council?run=3&view=replay"],
    ["a replay with no run named", { runId: null, view: "replay" }, 8, done, { runId: 8, view: "replay" }, "/council?run=8&view=replay"],
  ] as const)("%s", (_name, asked, newest, run, shown, replaceWith) => {
    const result = resolvePlace(asked, newest, run);
    expect(result.shown).toEqual(shown);
    expect(result.replaceWith).toBe(replaceWith);
    expect(result.missing).toBe(false);
  });

  it("says so when the named run does not exist", () => {
    expect(resolvePlace({ runId: 99, view: "replay" }, 8, null)).toEqual({ shown: { runId: null, view: "start" }, replaceWith: null, missing: true });
  });
});

describe("keeping the freshest copy of a run", () => {
  const finished = CouncilRun.parse(recorded);
  const live = { ...finished, status: "running" as const, verdict: null, finishedAt: null };
  const log = CouncilEvent.array().parse(events);

  it("prefers the copy further along, whichever side it came from", () => {
    expect(fresherRun(live, finished)).toBe(finished);
    expect(fresherRun(finished, live)).toBe(finished);
    expect(fresherRun(null, live)).toBe(live);
    expect(fresherRun({ ...finished, verdict: null }, finished)).toBe(finished);
  });

  it("takes the later of two readings of the status", () => {
    expect(laterStatus("running", "done")).toBe("done");
    expect(laterStatus("failed", "running")).toBe("failed");
    expect(laterStatus(null, "queued")).toBe("queued");
    expect(laterStatus("queued", "running")).toBe("running");
  });

  it("prefers the longer event log", () => {
    expect(longerLog(log.slice(0, 10), log)).toBe(log);
    expect(longerLog(log, log.slice(0, 10))).toBe(log);
    expect(longerLog([], [])).toEqual([]);
  });
});
