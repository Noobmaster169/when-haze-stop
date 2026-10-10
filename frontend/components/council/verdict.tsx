import Link from "next/link";

import type { CouncilEvent, CouncilRun, Verdict } from "@/lib/api/council-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { VerdictChart } from "./verdict-chart";
import { ringgit, VerdictCost } from "./verdict-cost";
import { VerdictCompare } from "./verdict-compare";
import { VerdictMap } from "./verdict-map";
import { VerdictNotes } from "./verdict-notes";
import { VerdictStrikes } from "./verdict-strikes";

/**
 * The verdict, in reading order: the answer in three lines, before and after,
 * the strike list, why this plan, what could go wrong. Every number is the
 * engine's or the stored data's; the words are the Chair's.
 */

/** The plan, then what to ask and tell Indonesia: runs before the council assumed Indonesia's consent still carry those two. */
const TRACKS: { key: "actNow" | "ask" | "share"; label: string; hint: string }[] = [
  { key: "actNow", label: "The plan", hint: "Which fires, with what, in what order" },
  { key: "ask", label: "Ask Indonesia for", hint: "Help that needs Indonesia to say yes" },
  { key: "share", label: "Tell Indonesia", hint: "What we know that helps their own crews" },
];

/** When the plan's benefit first reaches KL, in words. */
function clears(hours: number | null): string {
  if (hours === null) return "No benefit reaches KL within the two weeks.";
  const days = Math.round(hours / 24);
  return days < 1 ? "KL starts to feel it within a day." : `KL starts to feel it after about ${days} day${days > 1 ? "s" : ""}.`;
}

/** Where KL's coming smoke comes from, by area: the "memory" of the haze, worked out for this week's wind. */
function Sources({ sources }: { sources: NonNullable<Verdict["sources"]> }) {
  return (
    <ul className="space-y-2">
      {sources.map((item) => (
        <li key={item.area} className="grid grid-cols-[150px_minmax(0,1fr)_48px] items-center gap-3 text-small">
          <span className="text-ink">{item.area}</span>
          <span className="h-2 overflow-hidden rounded-full bg-sunken">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(1, 100 * item.share)}%` }} />
          </span>
          <span className="text-right text-ink-secondary tabular-nums">{Math.round(100 * item.share)}%</span>
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <div className="text-caption text-ink-tertiary">{label}</div>
      <div className="mt-1 font-display text-[24px] leading-[30px] text-ink">{value}</div>
      <div className="mt-1 text-caption text-ink-secondary">{note}</div>
    </div>
  );
}

/** The plain answer in three numbers: how much cleaner KL gets, what it costs, when KL feels it. */
function Facts({ verdict }: { verdict: Verdict }) {
  const arrival = verdict.score.arrivalHours;
  const days = arrival === null ? null : Math.max(1, Math.round(arrival / 24));
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      <Fact
        label="Cleaner air for KL"
        value={`${Math.round(100 * verdict.score.expected)}% of what is possible`}
        note={`About ${verdict.score.meanRemoved.toFixed(1)} ug/m3 less PM2.5 on average over two weeks, if every fire out would give ${verdict.ceiling.toFixed(1)}.`}
      />
      {verdict.cost ? (
        <Fact label="Cost" value={ringgit(verdict.cost.total)} note={`Of the ${ringgit(verdict.cost.budget)} the government set aside.`} />
      ) : (
        <Fact label="Cost" value="Not worked out" note="This meeting was held before budgets were part of the plan." />
      )}
      <Fact label="When KL feels it" value={days === null ? "Not within two weeks" : days === 1 ? "Within a day" : `After about ${days} days`} note={arrival === null ? clears(arrival) : `${clears(arrival)} That is when the smoke model first shows a tenth of the plan's biggest effect on KL.`} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-[22px] leading-[28px] text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function VerdictView({ run, verdict, events, switcher }: { run: CouncilRun; verdict: Verdict; events: CouncilEvent[]; switcher: React.ReactNode }) {
  const asOf = run.asOf ?? events.find((event) => event.kind === "run_started")?.at ?? null;
  const tracks = TRACKS.filter((track) => (verdict[track.key] ?? "").trim() !== "");

  return (
    <main className="flex min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-16 md:px-10 min-[900px]:pt-28">
        <article className="mx-auto max-w-[860px]">
          <div className="flex flex-wrap items-center justify-between gap-3 text-small">
            <span className="text-ink-tertiary">Run {run.id}, the verdict</span>
            {switcher}
          </div>

          <h1 className="mt-6 max-w-[36ch] font-display text-[28px] leading-[36px] text-ink md:text-[32px] md:leading-[40px]">{verdict.headline}</h1>
          <p className="mt-3 text-small text-ink-tertiary">
            Decided {run.finishedAt ? `${malaysiaWhen(run.finishedAt)} MYT` : ""}
            {asOf ? `, using the fires, wind and air as of ${malaysiaWhen(asOf)} MYT` : ""}. The committee members are played by AI.
          </p>

          <Facts verdict={verdict} />

          <dl className="mt-8 divide-y divide-hairline border-y border-hairline">
            {tracks.map((track) => (
              <div key={track.key} className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
                <dt>
                  <div className="text-strong font-semibold text-ink">{track.label}</div>
                  <div className="text-caption text-ink-tertiary">{track.hint}</div>
                </dt>
                <dd className="max-w-[64ch] text-[15px] leading-[24px] text-ink">{verdict[track.key]}</dd>
              </div>
            ))}
          </dl>

          {verdict.sources ? (
            <Section title="Where KL's smoke is coming from">
              <p className="mb-3 max-w-[68ch] text-small text-ink-secondary">Not always the nearest fires: it depends on this week&apos;s wind. This is the smoke still to come over the next two weeks, worked out by the smoke model.</p>
              <Sources sources={verdict.sources} />
            </Section>
          ) : null}

          <Section title={verdict.maps ? "Before and after" : "Where the help goes"}>
            <VerdictMap verdict={verdict} />
          </Section>

          <Section title="Which fires, in what order">
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

          {verdict.cost ? (
            <Section title="What it costs">
              <VerdictCost cost={verdict.cost} />
            </Section>
          ) : null}

          <Section title="What could go wrong">
            <VerdictNotes verdict={verdict} />
          </Section>

          <p className="mt-12 border-t border-hairline pt-4 text-caption text-ink-tertiary">
            Every number comes from the smoke model and the stored data.{" "}
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
