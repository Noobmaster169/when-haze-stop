"use client";

import Link from "next/link";
import { useState } from "react";

import { BUDGET_CHOICES, type CouncilRunSummary, DEFAULT_BUDGET_RM } from "@/lib/api/council-schemas";

import { PACKAGE_LINES, TARGETS } from "./package";
import { hrefFor } from "./route-state";
import { RunList } from "./run-list";
import { SelectField } from "./select-field";

/**
 * Before a run: the question, where and with what budget, what Malaysia can
 * send, and the button. The meetings so far sit underneath. Words are kept to
 * labels; what a number rests on is in each chip's tooltip.
 */

const BIG = "inline-flex h-12 items-center rounded-full bg-ink px-6 text-title font-medium text-ink-inverse shadow-overlay transition-[transform,opacity] duration-200 ease-[var(--ease-island)] hover:scale-[1.02] active:scale-[0.98]";
/** The runs listed under the button, newest first. */
const LISTED = 8;

function EmptyTable() {
  const seats = Array.from({ length: 8 }, (_, index) => -Math.PI / 2 + (2 * Math.PI * index) / 8);
  return (
    <svg viewBox="0 0 240 180" className="w-full max-w-[260px]" aria-hidden>
      <ellipse cx="120" cy="88" rx="92" ry="64" fill="none" stroke="var(--hairline-strong)" strokeDasharray="1 6" strokeLinecap="round" />
      <circle cx="120" cy="88" r="17" fill="var(--verdict-review-tint)" stroke="var(--verdict-review)" strokeWidth="1.25" />
      {seats.map((angle, index) => (
        <circle key={index} cx={(120 + 92 * Math.cos(angle)).toFixed(2)} cy={(88 + 64 * Math.sin(angle)).toFixed(2)} r={index === 0 ? 8 : 6.5} fill="var(--canvas)" stroke={index === 0 ? "var(--accent)" : "var(--ink-faint)"} strokeWidth="1.25" />
      ))}
    </svg>
  );
}

export function StartPanel({
  runs,
  selected,
  missingRun,
  busy,
  error,
  onConvene,
  onDelete,
}: {
  runs: CouncilRunSummary[];
  selected: number | null;
  missingRun: number | null;
  busy: boolean;
  error: string | null;
  onConvene(budgetRm: number): void;
  onDelete(runId: number): Promise<string | null>;
}) {
  // The selected run is always listed, even when it is older than the newest few.
  const shown = [...runs.slice(0, LISTED), ...runs.slice(LISTED).filter((run) => run.id === selected)];
  const going = runs.find((run) => run.status === "running" || run.status === "queued");
  const [budget, setBudget] = useState<number>(DEFAULT_BUDGET_RM);
  return (
    <div className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-12 md:px-10 min-[900px]:pt-28">
      <div className="mx-auto grid max-w-[980px] gap-10 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
        <div>
          <h1 className="font-display text-display-lg text-ink">Suppression Council</h1>
          <p className="mt-2 font-display text-[21px] leading-[29px] text-ink-secondary">Which fires should Malaysia&apos;s help put out first?</p>

          <div className="mt-8 space-y-3">
            <SelectField id="council-target" label="Clear the haze over" defaultValue="klang-valley">
              {TARGETS.map((target) => (
                <option key={target.id} value={target.id} disabled={!target.enabled}>
                  {target.enabled ? target.name : `${target.name} (later)`}
                </option>
              ))}
            </SelectField>
            <SelectField id="council-budget" label="With a budget of" title="Your choice: the government's real figure is not public" value={budget} onChange={(event) => setBudget(Number(event.target.value))}>
              {BUDGET_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  RM {choice / 1_000_000} million
                </option>
              ))}
            </SelectField>
          </div>

          <div className="mt-6">
            <div className="text-caption text-ink-tertiary">
              What Malaysia can send <span className="ml-1 inline-block border-b border-dashed border-differ-line text-differ-ink">assumed</span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {PACKAGE_LINES.map((line) => (
                <li
                  key={line.label}
                  title={line.note}
                  className={`rounded-full px-2.5 py-1 text-small ${line.basis === "accepted" ? "border border-hairline-strong bg-surface text-ink" : "border border-dashed border-differ-line bg-differ-tint text-differ-ink"}`}
                >
                  {line.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8">
            {going ? (
              <Link href={hrefFor({ runId: going.id, view: "replay" })} className={BIG}>
                Watch the meeting in session
              </Link>
            ) : (
              <button type="button" onClick={() => onConvene(budget)} disabled={busy} className={`${BIG} disabled:opacity-60`}>
                {busy ? "Convening..." : "Convene the council"}
              </button>
            )}
            {error ? <p className="mt-3 text-small text-fault">{error}</p> : null}
          </div>
        </div>
        <div className="hidden justify-center md:flex">
          <EmptyTable />
        </div>
      </div>

      <section className="mx-auto mt-12 max-w-[980px] border-t border-hairline pt-5">
        <h2 className="text-strong font-semibold text-ink">Meetings so far</h2>
        {missingRun !== null ? <p className="mt-1 text-small text-differ">There is no run {missingRun}.</p> : null}
        {shown.length === 0 ? <p className="mt-1 text-small text-ink-tertiary">None yet.</p> : null}
        <RunList runs={shown} selected={selected} onDelete={onDelete} />
      </section>
    </div>
  );
}
