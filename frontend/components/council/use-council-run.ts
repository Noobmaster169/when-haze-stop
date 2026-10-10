"use client";

import { useCallback, useEffect, useState } from "react";

import { type CouncilEvent, CouncilEventPage, CouncilRun, type RunStatus } from "@/lib/api/council-schemas";
import { parsedFetcher } from "@/lib/poll";

/**
 * The run the page follows: its events so far and, once it is done, its
 * verdict. While the run is queued or running the log is polled for anything
 * after the last event seen, so a live run is the same replay with the tail
 * still arriving.
 */

const POLL_MS = 3_000;
const readEvents = parsedFetcher(CouncilEventPage);
const readRun = parsedFetcher(CouncilRun);

export interface Followed {
  runId: number | null;
  status: RunStatus | null;
  events: CouncilEvent[];
  run: CouncilRun | null;
  error: string | null;
}

export const isLive = (status: RunStatus | null) => status === "queued" || status === "running";

function merge(known: CouncilEvent[], fresh: CouncilEvent[]): CouncilEvent[] {
  if (fresh.length === 0) return known;
  const seen = new Set(known.map((event) => event.seq));
  return [...known, ...fresh.filter((event) => !seen.has(event.seq))].sort((a, b) => a.seq - b.seq);
}

export function useCouncilRun(initial: Followed): Followed & { follow(runId: number, status: RunStatus): void } {
  const [state, setState] = useState<Followed>(initial);
  /** Bumped by every poll, so a poll that brought nothing new still schedules the next. */
  const [polls, setPolls] = useState(0);

  const follow = useCallback((runId: number, status: RunStatus) => {
    setState((current) => (current.runId === runId ? { ...current, status } : { runId, status, events: [], run: null, error: null }));
  }, []);

  const { runId, status } = state;
  const lastSeq = state.events.at(-1)?.seq ?? -1;
  const needsRun = (status === "done" || status === "failed") && state.run?.status !== status;

  useEffect(() => {
    // A finished run is read once, when the page follows it without its events; a live one is polled.
    if (runId === null || !(isLive(status) || (lastSeq === -1 && polls === 0))) return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        try {
          const page = await readEvents(`/api/council/runs/${runId}/events?after=${lastSeq}`);
          if (cancelled) return;
          setState((current) => (current.runId === runId ? { ...current, events: merge(current.events, page.events), status: page.status, error: null } : current));
        } catch (error) {
          // A missed poll is retried on the next tick; the page says the tail is late rather than going blank.
          if (!cancelled) setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
        }
        if (!cancelled) setPolls((count) => count + 1);
      },
      lastSeq === -1 && polls === 0 ? 0 : POLL_MS,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId, status, lastSeq, polls]);

  useEffect(() => {
    if (runId === null || !needsRun) return;
    let cancelled = false;
    const load = async () => {
      try {
        const run = await readRun(`/api/council/runs/${runId}`);
        if (!cancelled) setState((current) => (current.runId === runId ? { ...current, run } : current));
      } catch (error) {
        if (!cancelled) setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [runId, needsRun]);

  return { ...state, follow };
}
