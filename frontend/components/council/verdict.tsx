import Link from "next/link";

import type { CouncilEvent, CouncilRun, Verdict } from "@/lib/api/council-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { VerdictChart } from "./verdict-chart";
import { VerdictCompare } from "./verdict-compare";
import { VerdictCost } from "./verdict-cost";
import { VerdictFacts, VerdictSources } from "./verdict-facts";
import { VerdictMap } from "./verdict-map";
import { VerdictNotes } from "./verdict-notes";
import { VerdictStrikes } from "./verdict-strikes";

/**
 * The verdict lets the pictures carry it: the headline, then the proof that
 * KL's haze falls (the chart and the maps), then three figures and the strike
 * list. The committee's reasoning, its dissent and the caveats wait behind one
 * "Why this plan" disclosure. Every number is the smoke model's or the stored
 * data's.
 */

/** Runs held before the council assumed Indonesia's consent also carry what to ask and tell Indonesia. */
const EXTRA_TRACKS: { key: "ask" | "share"; label: string }[] = [
  { key: "ask", label: "Ask Indonesia for" },
  { key: "share", label: "Tell Indonesia" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[20px] leading-[26px] text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function WhyThisPlan({ verdict }: { verdict: Verdict }) {
  const tracks = EXTRA_TRACKS.filter((track) => (verdict[track.key] ?? "").trim() !== "");
  return (
    <details className="group mt-10 rounded-lg border border-hairline bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-strong font-medium text-ink">
        Why this plan
        <svg viewBox="0 0 16 16" aria-hidden className="size-4 text-ink-tertiary transition-transform group-open:rotate-180">
          <path d="M4 6.25 L8 10.25 L12 6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="space-y-5 border-t border-hairline px-4 py-4 text-body text-ink-secondary">
        <p className="max-w-[68ch] whitespace-pre-line">{verdict.reasoning}</p>
        {tracks.map((track) => (
          <div key={track.key}>
            <h3 className="text-strong font-semibold text-ink">{track.label}</h3>
            <p className="mt-1 max-w-[68ch]">{verdict[track.key]}</p>
          </div>
        ))}
        <VerdictNotes verdict={verdict} />
        {verdict.cost ? (
          <div>
            <h3 className="mb-2 text-strong font-semibold text-ink">What it costs</h3>
            <VerdictCost cost={verdict.cost} />
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function VerdictView({ run, verdict, events, switcher }: { run: CouncilRun; verdict: Verdict; events: CouncilEvent[]; switcher: React.ReactNode }) {
  const asOf = run.asOf ?? events.find((event) => event.kind === "run_started")?.at ?? null;

  return (
    <main className="flex min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-16 md:px-10 min-[900px]:pt-28">
        <article className="mx-auto max-w-[860px]">
          <div className="flex flex-wrap items-center justify-between gap-3 text-small">
            <span className="text-ink-tertiary">
              Run {run.id}
              {run.finishedAt ? `, decided ${malaysiaWhen(run.finishedAt)}` : ""}. Played by AI.
            </span>
            {switcher}
          </div>

          <h1 className="mt-5 max-w-[36ch] font-display text-[28px] leading-[36px] text-ink md:text-[32px] md:leading-[40px]">{verdict.headline}</h1>
          <p className="mt-3 line-clamp-2 max-w-[72ch] text-body text-ink-secondary" title={verdict.actNow}>
            <span className="font-medium text-ink">The plan: </span>
            {verdict.actNow}
          </p>

          <div className="mt-8 rounded-lg border border-hairline bg-surface p-4">
            <VerdictChart verdict={verdict} asOf={asOf} />
          </div>

          <div className="mt-8">
            <VerdictMap verdict={verdict} />
          </div>

          <div className="mt-8">
            <VerdictFacts verdict={verdict} />
          </div>

          <Section title="Which fires, in what order">
            <VerdictStrikes lines={verdict.strikeList} />
          </Section>

          <Section title="Against simple plans">
            <VerdictCompare verdict={verdict} />
          </Section>

          {verdict.sources ? (
            <Section title="Where KL's smoke comes from">
              <VerdictSources sources={verdict.sources} />
            </Section>
          ) : null}

          <WhyThisPlan verdict={verdict} />

          <p className="mt-10 text-caption text-ink-tertiary">
            <Link href="/simulation" className="text-ink-secondary underline underline-offset-2 hover:text-accent">
              How the smoke model was checked
            </Link>
            . A student project, not an official advisory.
          </p>
        </article>
      </div>
    </main>
  );
}
