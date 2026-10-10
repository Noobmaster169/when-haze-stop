"use client";

import { useState } from "react";

import { type CouncilEvent, type CouncilRun, type CouncilRunSummary, CouncilStart } from "@/lib/api/council-schemas";

import { TARGETS } from "./package";
import { Replay } from "./replay";
import { StartPanel } from "./start-panel";
import { isLive, useCouncilRun } from "./use-council-run";
import { VerdictView } from "./verdict";

/**
 * The council page's three states: before a run, the replay, the verdict.
 * The view is kept in the address (?run=&view=) so a replay or a verdict can
 * be shared, without a navigation that would restart the replay.
 */

export type View = "start" | "replay" | "verdict";

function remember(runId: number | null, view: View): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("run");
  url.searchParams.delete("view");
  if (view !== "start" && runId !== null) {
    url.searchParams.set("run", String(runId));
    url.searchParams.set("view", view);
  }
  window.history.replaceState(null, "", url);
}

export function CouncilExperience({ runs, run, events, initialView }: { runs: CouncilRunSummary[]; run: CouncilRun | null; events: CouncilEvent[]; initialView: View }) {
  const followed = useCouncilRun({ runId: run?.id ?? null, status: run?.status ?? null, events, run, error: null });
  const [view, setViewState] = useState<View>(initialView);
  const [arrived, setArrived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setView = (next: View, runId = followed.runId) => {
    setViewState(next);
    remember(runId, next);
  };

  const convene = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/council/runs", { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      const parsed = CouncilStart.safeParse(body);
      if (!response.ok || !parsed.success) {
        const refusal = typeof body === "object" && body !== null && "error" in body ? String(body.error) : `The council could not be convened (${response.status}).`;
        setError(refusal);
        return;
      }
      followed.follow(parsed.data.run.id, parsed.data.run.status);
      setArrived(true);
      setView("replay", parsed.data.run.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const started = followed.events.find((event) => event.kind === "run_started");
  const targetName = started?.kind === "run_started" ? started.payload.targetName : TARGETS[0].name;
  const verdict = followed.run?.verdict ?? null;
  const live = isLive(followed.status);

  if (view === "verdict" && verdict && followed.run) {
    return <VerdictView run={followed.run} verdict={verdict} events={followed.events} onReplay={() => setView("replay")} onStart={() => setView("start")} />;
  }

  if (view !== "start" && followed.runId !== null) {
    return (
      <main className="flex min-w-0 grow flex-col">
        <Replay
          key={followed.runId}
          events={followed.events}
          live={live}
          targetName={targetName}
          arrived={arrived}
          onVerdict={verdict ? () => setView("verdict") : null}
          header={
            <div className="flex flex-col items-end gap-1.5">
              <nav className="flex gap-1 rounded-lg bg-sunken p-0.5 text-small" aria-label="Council views">
                <button type="button" onClick={() => setView("start")} className="rounded-md px-2.5 py-1 text-ink-secondary transition-colors hover:text-ink">
                  Council
                </button>
                <span className="rounded-md bg-canvas px-2.5 py-1 text-ink shadow-overlay">Replay</span>
                <button type="button" disabled={!verdict} onClick={() => setView("verdict")} className="rounded-md px-2.5 py-1 text-ink-secondary transition-colors hover:text-ink disabled:text-ink-faint">
                  Verdict
                </button>
              </nav>
              {followed.error ? <p className="text-caption text-differ">The newest events are late: {followed.error}</p> : null}
              {followed.status === "failed" ? <p className="text-caption text-fault">This run stopped: {followed.run?.error ?? "no reason recorded"}</p> : null}
            </div>
          }
        />
      </main>
    );
  }

  return (
    <main className="flex min-w-0 grow flex-col">
      <StartPanel runs={runs.map((item) => (item.id === followed.runId && followed.status ? { ...item, status: followed.status } : item))} busy={busy} error={error} onConvene={convene} />
    </main>
  );
}
