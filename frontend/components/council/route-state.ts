import type { CouncilEvent, CouncilRun, RunStatus } from "@/lib/api/council-schemas";

/**
 * Where the council page is, as the address says. The address is the only
 * source of truth for which run and which view: every move between views is a
 * navigation, so back, forward, reload and a shared link land on the same view.
 * Pure.
 *
 * The flow, address to what shows:
 *
 * | address                      | the run                     | shows                                              |
 * | ---------------------------- | --------------------------- | -------------------------------------------------- |
 * | /council                     | none yet                    | start panel, nothing listed                        |
 * | /council                     | newest is N                 | start panel, N selected                            |
 * | ?run=N                       | exists                      | start panel, N selected                            |
 * | ?run=N                       | does not exist              | start panel, "there is no run N"                   |
 * | ?run=N&view=replay           | done                        | replay from the start, Verdict open                |
 * | ?run=N&view=replay           | queued or running           | live replay at the tail, polled every 3 s          |
 * | ?run=N&view=replay           | failed                      | replay of what was recorded, the failure shown     |
 * | ?run=N&view=verdict          | done, verdict readable      | verdict                                            |
 * | ?run=N&view=verdict          | anything else               | replaced by ?run=N&view=replay                     |
 * | ?view=replay or verdict      | newest is N                 | replaced by ?run=N&view=..., then as above         |
 * | ?view=anything else          |                             | start panel                                        |
 *
 * The moves: Watch live and Replay go to ?run=N&view=replay, Verdict to
 * ?run=N&view=verdict, the switcher's Council to ?run=N (the same run stays
 * selected). Convening goes to ?run=NEW&view=replay with the objective card.
 * A live run that finishes while watched stays on its replay and opens Verdict.
 */

export type View = "start" | "replay" | "verdict";

export interface Place {
  runId: number | null;
  view: View;
}

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parsePlace(query: Query): Place {
  const id = Number.parseInt(first(query.run) ?? "", 10);
  const view = first(query.view);
  return { runId: Number.isInteger(id) && id > 0 ? id : null, view: view === "replay" || view === "verdict" ? view : "start" };
}

export function hrefFor(place: Place): string {
  if (place.runId === null) return "/council";
  return place.view === "start" ? `/council?run=${place.runId}` : `/council?run=${place.runId}&view=${place.view}`;
}

export interface RunFacts {
  status: RunStatus;
  hasVerdict: boolean;
}

/**
 * What the page shows for an address, and the address it should have instead
 * when the asked one cannot be shown as it stands (null when it can).
 */
export function resolvePlace(asked: Place, newest: number | null, run: RunFacts | null): { shown: Place; replaceWith: string | null; missing: boolean } {
  if (asked.runId === null) {
    if (asked.view === "start" || newest === null) return { shown: { runId: newest, view: "start" }, replaceWith: null, missing: false };
    // The address must name the run it shows, so a shared link keeps meaning the same meeting.
    const named = resolvePlace({ runId: newest, view: asked.view }, newest, run);
    return { ...named, replaceWith: named.missing ? null : hrefFor(named.shown) };
  }
  if (!run) return { shown: { runId: null, view: "start" }, replaceWith: null, missing: true };
  const view = asked.view === "verdict" && !(run.status === "done" && run.hasVerdict) ? "replay" : asked.view;
  const shown = { runId: asked.runId, view };
  const canonical = hrefFor(shown);
  return { shown, replaceWith: canonical === hrefFor(asked) ? null : canonical, missing: false };
}

const RANK: Record<RunStatus, number> = { queued: 0, running: 1, done: 2, failed: 2 };

/**
 * Of two copies of the same run, the one further along. The server reads the
 * run on every navigation and the browser polls it while live, so either can be
 * the newer one.
 */
export function fresherRun(a: CouncilRun | null, b: CouncilRun | null): CouncilRun | null {
  if (!a || !b) return a ?? b;
  if (RANK[b.status] !== RANK[a.status]) return RANK[b.status] > RANK[a.status] ? b : a;
  return b.verdict && !a.verdict ? b : a;
}

/** The further along of two readings of a run's status. */
export function laterStatus(a: RunStatus | null, b: RunStatus | null): RunStatus | null {
  if (!a || !b) return a ?? b;
  return RANK[b] > RANK[a] ? b : a;
}

/** The longer of two copies of an append-only event log. */
export function longerLog(a: CouncilEvent[], b: CouncilEvent[]): CouncilEvent[] {
  return (b.at(-1)?.seq ?? -1) > (a.at(-1)?.seq ?? -1) ? b : a;
}
