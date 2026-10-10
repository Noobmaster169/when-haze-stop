"use client";

import { useMemo, useState } from "react";

import { nameOf } from "./caption";
import { PlanTray } from "./plan-tray";
import type { Timeline } from "./timeline";
import { type Said, saidUpTo, trayAt } from "./tray";
import { ACT_COLOUR, ACT_WORD, ARGUMENT_ACTS, listNames } from "./words";

/**
 * Beside the table: who is speaking now and what they said, then the plans on
 * the board or the transcript. Re-rendered only when the beat changes.
 */

type Tab = "plans" | "transcript";

function lastThought(timeline: Timeline, index: number): { agent: string; gist: string } | null {
  for (let position = Math.min(index, timeline.beats.length - 1); position >= 0; position--) {
    const event = timeline.beats[position].event;
    if (event.kind === "thinking") return event.payload;
    if (event.kind === "stage") return null;
  }
  return null;
}

function ActChip({ said }: { said: Said }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-caption font-medium text-ink-secondary">
      <span className="size-2 rounded-full" style={{ background: ACT_COLOUR[said.act] }} />
      {ACT_WORD[said.act]}
    </span>
  );
}

function Now({ said, timeline }: { said: Said | null; timeline: Timeline }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!said) return <p className="text-small text-ink-tertiary">Nobody has spoken yet.</p>;
  const expanded = open === said.id;
  return (
    <div key={said.id} className="motion-safe:animate-[island-drop_320ms_var(--ease-island)_both]">
      <div className="flex flex-wrap items-baseline gap-x-2 text-small">
        <span className="font-medium text-ink">{nameOf(timeline.agents, said.from)}</span>
        <span className="text-ink-tertiary" title={said.to.map((id) => nameOf(timeline.agents, id)).join(", ")}>
          to {listNames(said.to.map((id) => nameOf(timeline.agents, id)), timeline.agents.length)}
        </span>
      </div>
      <div className="mt-1.5">
        <ActChip said={said} />
        {said.planId ? <span className="ml-2 text-caption text-ink-tertiary">on plan {said.planId}</span> : null}
      </div>
      <p className="mt-2 font-display text-[17px] leading-[24px] text-ink">{said.headline}</p>
      {said.detail ? (
        <button type="button" onClick={() => setOpen(expanded ? null : said.id)} className="mt-2 text-caption font-medium text-ink-secondary underline-offset-2 hover:text-accent hover:underline">
          {expanded ? "Hide the full text" : "Read the full text"}
        </button>
      ) : null}
      {expanded ? <p className="mt-2 max-h-56 overflow-y-auto text-small whitespace-pre-line text-ink-secondary">{said.detail}</p> : null}
      {said.unverified.length > 0 ? (
        <p className="mt-2 rounded-sm bg-differ-tint px-2 py-1 text-caption text-differ-ink">
          Not found in what it was shown: {said.unverified.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function Transcript({ said, timeline, onSeek }: { said: Said[]; timeline: Timeline; onSeek(beat: number): void }) {
  const [arguing, setArguing] = useState(false);
  const shown = (arguing ? said.filter((item) => ARGUMENT_ACTS.has(item.act)) : said).slice().reverse();
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2 text-caption text-ink-secondary">
        <input type="checkbox" checked={arguing} onChange={(event) => setArguing(event.target.checked)} className="accent-[var(--accent)]" />
        Only challenges and concessions
      </label>
      <ol className="mt-3 space-y-3">
        {shown.length === 0 ? <li className="text-small text-ink-tertiary">{arguing ? "No challenges or concessions yet." : "Nothing said yet."}</li> : null}
        {shown.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onSeek(item.beat)} className="w-full rounded-md text-left transition-colors hover:bg-sunken">
              <div className="flex items-center gap-2 text-caption">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: ACT_COLOUR[item.act] }} />
                <span className="font-medium text-ink">{nameOf(timeline.agents, item.from)}</span>
                <span className="text-ink-tertiary">{ACT_WORD[item.act].toLowerCase()}</span>
                {item.planId ? <span className="text-ink-tertiary">{item.planId}</span> : null}
              </div>
              <p className="mt-0.5 pl-3.5 text-small text-ink-secondary">{item.headline}</p>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Rail({ timeline, index, onSeek }: { timeline: Timeline; index: number; onSeek(beat: number): void }) {
  const [tab, setTab] = useState<Tab>("plans");
  const said = useMemo(() => saidUpTo(timeline, index), [timeline, index]);
  const tray = useMemo(() => trayAt(timeline, index), [timeline, index]);
  const thought = useMemo(() => lastThought(timeline, index), [timeline, index]);

  return (
    <div className="flex min-h-0 flex-col">
      <section className="border-b border-hairline px-5 pt-4 pb-5" aria-live="polite">
        <h2 className="text-caption text-ink-tertiary">Speaking now</h2>
        <div className="mt-2">
          <Now said={said.at(-1) ?? null} timeline={timeline} />
        </div>
        {thought ? (
          <p className="mt-4 border-l-2 border-hairline-strong pl-2.5 text-caption text-ink-tertiary">
            <span className="text-ink-secondary">{nameOf(timeline.agents, thought.agent)} is weighing:</span> {thought.gist}
          </p>
        ) : null}
      </section>
      <div className="flex gap-4 border-b border-hairline px-5" role="tablist">
        {(["plans", "transcript"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 py-2.5 text-small transition-colors ${tab === key ? "border-ink font-medium text-ink" : "border-transparent text-ink-tertiary hover:text-ink"}`}
          >
            {key === "plans" ? `Plans ${tray.plans.length ? tray.plans.length : ""}` : `Transcript ${said.length ? said.length : ""}`}
          </button>
        ))}
      </div>
      <div className="min-h-0 grow overflow-y-auto px-5 pt-4 pb-6">
        {tab === "plans" ? <PlanTray tray={tray} timeline={timeline} /> : <Transcript said={said} timeline={timeline} onSeek={onSeek} />}
      </div>
    </div>
  );
}
