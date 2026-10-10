"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { type CouncilEvent, type CouncilRun, type CouncilRunSummary, CouncilStart } from "@/lib/api/council-schemas";

import { TARGETS } from "./package";
import { Replay } from "./replay";
import { fresherRun, hrefFor, laterStatus, longerLog, type View } from "./route-state";
import { StartPanel } from "./start-panel";
import { isLive, useCouncilRun } from "./use-council-run";
import { VerdictView } from "./verdict";

/**
 * The council page's three views of one run: the start panel with that run
 * selected, its replay, its verdict. Which run and which view come from the
 * address alone (route-state.ts); every move is a navigation, and this
 * component, keyed by run, keeps the live tail it has polled across them.
 */

/** The run this browser has just convened, so its replay opens with the objective arriving. Read once by the run's first render. */
let convened: number | null = null;

const TAB = "rounded-md px-2.5 py-1 transition-colors";

function Switcher({ runId, view, verdictReady }: { runId: number; view: View; verdictReady: boolean }) {
  const tabs: { key: View; label: string; ready: boolean }[] = [
    { key: "start", label: "Council", ready: true },
    { key: "replay", label: "Replay", ready: true },
    { key: "verdict", label: "Verdict", ready: verdictReady },
  ];
  return (
    <nav className="flex gap-1 rounded-lg bg-sunken p-0.5 text-small" aria-label="Views of this run">
      {tabs.map((tab) =>
        tab.key === view ? (
          <span key={tab.key} aria-current="page" className={`${TAB} bg-canvas text-ink shadow-overlay`}>
            {tab.label}
          </span>
        ) : tab.ready ? (
          <Link key={tab.key} href={hrefFor({ runId, view: tab.key })} scroll={false} className={`${TAB} text-ink-secondary hover:text-ink`}>
            {tab.label}
          </Link>
        ) : (
          <span key={tab.key} title="The verdict comes when the meeting ends" className={`${TAB} text-ink-faint`}>
            {tab.label}
          </span>
        ),
      )}
    </nav>
  );
}

export function CouncilExperience({ runs, run, events, view, named, missingRun }: { runs: CouncilRunSummary[]; run: CouncilRun | null; events: CouncilEvent[]; view: View; named: boolean; missingRun: number | null }) {
  const router = useRouter();
  const followed = useCouncilRun({ runId: run?.id ?? null, status: run?.status ?? null, events, run, error: null });
  const [arrived] = useState(() => run !== null && convened === run.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (arrived) convened = null;
  }, [arrived]);

  const convene = async (budgetRm: number) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/council/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ budgetRm }) });
      const body: unknown = await response.json().catch(() => null);
      const parsed = CouncilStart.safeParse(body);
      if (!response.ok || !parsed.success) {
        setError(typeof body === "object" && body !== null && "error" in body ? String(body.error) : `The council could not be convened (${response.status}).`);
        setBusy(false);
        return;
      }
      if (!parsed.data.attached) convened = parsed.data.run.id;
      router.push(hrefFor({ runId: parsed.data.run.id, view: "replay" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  };

  // The server reads the run on every navigation and the browser polls it while live: show whichever is further along.
  const current = fresherRun(run, followed.run);
  const log = longerLog(events, followed.events);
  const status = laterStatus(current?.status ?? null, followed.status);
  const started = log.find((event) => event.kind === "run_started");
  const targetName = started?.kind === "run_started" ? started.payload.targetName : TARGETS[0].name;
  const verdict = current?.status === "done" ? current.verdict : null;

  if (view === "verdict" && verdict && current) {
    return <VerdictView run={current} verdict={verdict} events={log} switcher={<Switcher runId={current.id} view="verdict" verdictReady />} />;
  }

  // A verdict asked for before this copy of the run has one falls back to the replay, never to the start panel.
  if (view !== "start" && current) {
    return (
      <main className="flex min-w-0 grow flex-col">
        <Replay
          key={current.id}
          events={log}
          live={isLive(status)}
          targetName={targetName}
          arrived={arrived}
          onVerdict={verdict ? () => router.push(hrefFor({ runId: current.id, view: "verdict" })) : null}
          header={
            <div className="flex flex-col items-end gap-1.5">
              <Switcher runId={current.id} view="replay" verdictReady={verdict !== null} />
              {followed.error ? <p className="text-caption text-differ">The newest events are late: {followed.error}</p> : null}
              {status === "failed" ? <p className="max-w-[46ch] text-right text-caption text-fault">This meeting stopped before a decision ({(current.error ?? "no reason was recorded").replace(/^stopped:\s*/i, "")}). The replay shows what it said up to then.</p> : null}
              {status === "done" && !verdict ? <p className="max-w-[46ch] text-right text-caption text-differ">This meeting ended, but its verdict can no longer be read by this version of the page.</p> : null}
            </div>
          }
        />
      </main>
    );
  }

  return (
    <main className="flex min-w-0 grow flex-col">
      <StartPanel
        runs={runs.map((item) => (item.id === current?.id && status ? { ...item, status } : item))}
        selected={current?.id ?? null}
        named={named}
        missingRun={missingRun}
        busy={busy}
        error={error}
        onConvene={convene}
      />
    </main>
  );
}
