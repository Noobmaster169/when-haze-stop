"use client";

import Link from "next/link";
import { useState } from "react";

import type { CouncilRunSummary } from "@/lib/api/council-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { hrefFor } from "./route-state";

/**
 * The meetings so far, newest first, each with its replay and verdict, and a
 * quiet delete for one that is over. Deleting asks once, inline.
 */

const STATUS_WORD: Record<CouncilRunSummary["status"], string> = { queued: "waiting", running: "in session", done: "decided", failed: "stopped" };
const STATUS_TONE: Record<CouncilRunSummary["status"], string> = {
  queued: "bg-sunken text-ink-secondary",
  running: "bg-fault-tint text-fault",
  done: "bg-match-tint text-match",
  failed: "bg-sunken text-ink-tertiary",
};
const LINK = "rounded-md border border-hairline-strong px-3 py-1.5 text-small text-ink transition-colors hover:bg-sunken";

function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
}

function DeleteControl({ runId, onDelete }: { runId: number; onDelete(runId: number): Promise<string | null> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="rounded-md px-2 py-1.5 text-small text-ink-tertiary transition-colors hover:bg-sunken hover:text-fault" aria-label={`Delete run ${runId}`}>
        Delete
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-small">
      <span className="text-ink-secondary">{error ?? "Delete?"}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const failed = await onDelete(runId);
          setBusy(false);
          setError(failed);
        }}
        className="rounded-md bg-fault px-2 py-1 font-medium text-ink-inverse disabled:opacity-60"
      >
        Yes
      </button>
      <button type="button" onClick={() => {
          setAsking(false);
          setError(null);
        }} className="rounded-md px-2 py-1 text-ink-secondary hover:bg-sunken">
        No
      </button>
    </span>
  );
}

export function RunList({ runs, selected, onDelete }: { runs: CouncilRunSummary[]; selected: number | null; onDelete(runId: number): Promise<string | null> }) {
  return (
    <ul className="mt-2 divide-y divide-hairline">
      {runs.map((run) => {
        const minutes = minutesBetween(run.startedAt, run.finishedAt);
        const live = run.status === "running" || run.status === "queued";
        return (
          <li key={run.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${run.id === selected ? "text-ink" : ""}`} aria-current={run.id === selected ? "true" : undefined}>
            <div className="text-small text-ink-secondary">
              <span className="font-medium text-ink">Run {run.id}</span>
              <span className="ml-2">{run.startedAt ? malaysiaWhen(run.startedAt) : "not started"}</span>
              <span className={`ml-2 inline-block rounded-full px-2 py-px text-caption whitespace-nowrap ${STATUS_TONE[run.status]}`}>{STATUS_WORD[run.status]}</span>
              {minutes !== null ? <span className="ml-2 text-caption text-ink-tertiary">{minutes} min</span> : null}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {live ? null : <DeleteControl runId={run.id} onDelete={onDelete} />}
              <Link href={hrefFor({ runId: run.id, view: "replay" })} className={LINK}>
                {live ? "Watch live" : "Replay"}
              </Link>
              {run.status === "done" ? (
                <Link href={hrefFor({ runId: run.id, view: "verdict" })} className={LINK}>
                  Verdict
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
