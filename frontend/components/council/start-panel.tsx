"use client";

import Link from "next/link";
import { useState } from "react";

import { BUDGET_CHOICES, type CouncilRunSummary, DEFAULT_BUDGET_RM } from "@/lib/api/council-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { DOC_LINKS, PACKAGE_LINES, TARGETS } from "./package";

/**
 * Before a run: the question, the one area it can be asked about, what
 * Malaysia can send, and the button that convenes the council. The newest run,
 * and the newest decided one, sit underneath with their replay and verdict.
 */

const STATUS_WORD: Record<CouncilRunSummary["status"], string> = { queued: "waiting to start", running: "in session now", done: "decided", failed: "stopped" };

function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
}

function EmptyTable() {
  const seats = Array.from({ length: 12 }, (_, index) => -Math.PI / 2 + (2 * Math.PI * index) / 12);
  return (
    <svg viewBox="0 0 240 180" className="w-full max-w-[280px]" aria-hidden>
      <ellipse cx="120" cy="88" rx="92" ry="64" fill="none" stroke="var(--hairline-strong)" strokeDasharray="1 6" strokeLinecap="round" />
      <circle cx="120" cy="88" r="17" fill="var(--verdict-review-tint)" stroke="var(--verdict-review)" strokeWidth="1.25" />
      {seats.map((angle, index) => (
        <circle key={index} cx={(120 + 92 * Math.cos(angle)).toFixed(2)} cy={(88 + 64 * Math.sin(angle)).toFixed(2)} r={index === 0 ? 8 : 6.5} fill="var(--canvas)" stroke={index === 0 ? "var(--accent)" : "var(--ink-faint)"} strokeWidth="1.25" />
      ))}
    </svg>
  );
}

const LINK = "rounded-md border border-hairline-strong px-3 py-1.5 text-small text-ink transition-colors hover:bg-sunken";

/** The newest run, and the newest decided one when the newest is still going or stopped. */
function recent(runs: CouncilRunSummary[]): { run: CouncilRunSummary; label: string }[] {
  const [newest] = runs;
  if (!newest) return [];
  const decided = runs.find((run) => run.status === "done");
  if (newest.status === "done" || !decided) return [{ run: newest, label: "Last run" }];
  return [
    { run: newest, label: "Newest run" },
    { run: decided, label: "Last decided run" },
  ];
}

export function StartPanel({ runs, busy, error, onConvene }: { runs: CouncilRunSummary[]; busy: boolean; error: string | null; onConvene(budgetRm: number): void }) {
  const shown = recent(runs);
  const [budget, setBudget] = useState<number>(DEFAULT_BUDGET_RM);
  return (
    <div className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-12 md:px-10">
      <div className="mx-auto grid max-w-[980px] gap-10 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
        <div>
          <h1 className="font-display text-display-lg text-ink">Suppression Council</h1>
          <p className="mt-2 max-w-[44ch] font-display text-[21px] leading-[29px] text-ink-secondary">Which fires should Malaysia&apos;s help put out first?</p>
          <p className="mt-4 max-w-[62ch] text-body text-ink-secondary">
            Twelve offices, role-played by AI, argue it from the same fires, wind and air. Every plan they table is scored by the smoke model, and the plan that holds up best becomes the verdict. A meeting takes ten to twenty minutes; you can watch it live or replay it after.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-ink">
            <label htmlFor="council-target">Clear the haze over</label>
            <select id="council-target" defaultValue="klang-valley" className="rounded-md border border-hairline-strong bg-surface px-2.5 py-1.5 text-body text-ink">
              {TARGETS.map((target) => (
                <option key={target.id} value={target.id} disabled={!target.enabled}>
                  {target.enabled ? target.name : `${target.name} (later)`}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-ink">
            <label htmlFor="council-budget">With a budget of</label>
            <select id="council-budget" value={budget} onChange={(event) => setBudget(Number(event.target.value))} className="rounded-md border border-hairline-strong bg-surface px-2.5 py-1.5 text-body text-ink">
              {BUDGET_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  RM {choice / 1_000_000} million
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 max-w-[62ch] text-caption text-ink-tertiary">
            The government&apos;s real figure is not public, so this is your choice for the run. Every plan must fit inside it: aircraft cost about RM 100,000 to RM 450,000 a day each, a Bomba firefighter about RM 250.
          </p>

          <div className="mt-5">
            <div className="text-caption text-ink-tertiary">What Malaysia can send</div>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {PACKAGE_LINES.map((line) => (
                <li
                  key={line.label}
                  title={line.note}
                  className={`rounded-full px-2.5 py-1 text-small ${line.basis === "accepted" ? "border border-hairline-strong bg-surface text-ink" : "border border-dashed border-differ-line bg-differ-tint text-differ-ink"}`}
                >
                  {line.label}
                  {line.basis === "assumption" ? <span className="ml-1.5 text-caption opacity-80">assumed</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-caption text-ink-tertiary">
              Solid: offered and accepted for Kalimantan in September. Dashed: an assumption the council plans with.{" "}
              <a href={DOC_LINKS.package} target="_blank" rel="noreferrer" className="text-ink-secondary underline underline-offset-2 hover:text-accent">
                What this rests on
              </a>
            </p>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => onConvene(budget)}
              disabled={busy}
              className="rounded-full bg-ink px-6 py-3 text-title font-medium text-ink-inverse shadow-overlay transition-[transform,opacity] duration-200 ease-[var(--ease-island)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Convening..." : "Convene the council"}
            </button>
            {error ? <p className="mt-3 text-small text-fault">{error}</p> : null}
          </div>
        </div>
        <div className="hidden justify-center md:flex">
          <EmptyTable />
        </div>
      </div>

      {shown.length > 0 ? (
        <ul className="mx-auto mt-12 max-w-[980px] divide-y divide-hairline border-t border-hairline">
          {shown.map(({ run, label }) => {
            const minutes = minutesBetween(run.startedAt, run.finishedAt);
            const live = run.status === "running" || run.status === "queued";
            return (
              <li key={run.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                <div className="text-small text-ink-secondary">
                  <span className="text-ink">{label}</span>, {run.startedAt ? `${malaysiaWhen(run.startedAt)} MYT` : "not started"}, {STATUS_WORD[run.status]}
                  {minutes !== null ? `, ${minutes} min` : ""}
                </div>
                <div className="ml-auto flex gap-2">
                  <Link href={`/council?run=${run.id}&view=replay`} className={LINK}>
                    {live ? "Watch live" : "Replay"}
                  </Link>
                  {run.status === "done" ? (
                    <Link href={`/council?run=${run.id}&view=verdict`} className={LINK}>
                      Verdict
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
