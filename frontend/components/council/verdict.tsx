import Link from "next/link";

import type { CouncilEvent, CouncilRun, Verdict } from "@/lib/api/council-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { VerdictChart } from "./verdict-chart";
import { VerdictCompare } from "./verdict-compare";
import { VerdictMap } from "./verdict-map";
import { VerdictNotes } from "./verdict-notes";
import { VerdictStrikes } from "./verdict-strikes";

/**
 * The verdict, in reading order: the answer in three lines, before and after,
 * the strike list, why this plan, what could go wrong. Every number is the
 * engine's or the stored data's; the words are the Chair's.
 */

const TRACKS: { key: "actNow" | "ask" | "share"; label: string; hint: string }[] = [
  { key: "actNow", label: "Act now", hint: "What Malaysia does today with what it controls" },
  { key: "ask", label: "Ask", hint: "The requests to Indonesia worth making" },
  { key: "share", label: "Share", hint: "The targeting picture for Indonesia's own crews" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-[22px] leading-[28px] text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function VerdictView({ run, verdict, events, onReplay, onStart }: { run: CouncilRun; verdict: Verdict; events: CouncilEvent[]; onReplay(): void; onStart(): void }) {
  const finished = events.find((event) => event.kind === "run_finished");
  const calls = finished?.kind === "run_finished" ? finished.payload.calls : null;
  const asOf = run.asOf ?? events.find((event) => event.kind === "run_started")?.at ?? null;

  return (
    <main className="flex min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-16 md:px-10">
        <article className="mx-auto max-w-[860px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
            <button type="button" onClick={onStart} className="text-ink-secondary underline-offset-2 hover:text-accent hover:underline">
              Suppression Council
            </button>
            <span className="text-ink-faint">/</span>
            <span className="text-ink-tertiary">Verdict</span>
            <button type="button" onClick={onReplay} className="ml-auto rounded-md border border-hairline-strong px-3 py-1 text-small text-ink transition-colors hover:bg-sunken">
              Replay the meeting
            </button>
          </div>

          <h1 className="mt-6 max-w-[36ch] font-display text-[28px] leading-[36px] text-ink md:text-[32px] md:leading-[40px]">{verdict.headline}</h1>
          <p className="mt-3 text-small text-ink-tertiary">
            Plan {verdict.planId}, {verdict.title}. Decided {run.finishedAt ? `${malaysiaWhen(run.finishedAt)} MYT` : ""}
            {asOf ? ` on data as of ${malaysiaWhen(asOf)} MYT` : ""}
            {calls !== null ? `, after ${calls} model calls` : ""}. The council is role-played by AI.
          </p>
          {verdict.budgetLimited ? <p className="mt-2 text-small text-differ">The meeting hit its budget of model calls before the ranking settled; the verdict is budget-limited.</p> : null}

          <dl className="mt-8 divide-y divide-hairline border-y border-hairline">
            {TRACKS.map((track) => (
              <div key={track.key} className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
                <dt>
                  <div className="text-strong font-semibold text-ink">{track.label}</div>
                  <div className="text-caption text-ink-tertiary">{track.hint}</div>
                </dt>
                <dd className="max-w-[64ch] text-[15px] leading-[24px] text-ink">{verdict[track.key]}</dd>
              </div>
            ))}
          </dl>

          <Section title={verdict.maps ? "Before and after" : "Where the plan strikes"}>
            <VerdictMap verdict={verdict} />
          </Section>

          <Section title="The strike list">
            <VerdictStrikes lines={verdict.strikeList} />
          </Section>

          <Section title="Why this plan">
            <p className="max-w-[68ch] text-body whitespace-pre-line text-ink-secondary">{verdict.reasoning}</p>
            <div className="mt-6 rounded-lg border border-hairline bg-surface p-4">
              <VerdictChart verdict={verdict} asOf={asOf} />
            </div>
            <div className="mt-4 rounded-lg border border-hairline bg-surface p-4">
              <VerdictCompare verdict={verdict} />
            </div>
          </Section>

          <Section title="What could go wrong">
            <VerdictNotes verdict={verdict} />
          </Section>

          <p className="mt-12 border-t border-hairline pt-4 text-caption text-ink-tertiary">
            The verdict rests on the smoke model.{" "}
            <Link href="/simulation" className="text-ink-secondary underline underline-offset-2 hover:text-accent">
              How the engine was checked
            </Link>
            . A student project, not an official advisory.
          </p>
        </article>
      </div>
    </main>
  );
}
