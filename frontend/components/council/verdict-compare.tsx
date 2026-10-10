import type { ScoreSummary, Verdict } from "@/lib/api/council-schemas";

import { scoreWords, share } from "./words";

/**
 * The chosen plan beside the simple plans made by computer, as a share of the clearable smoke:
 * a dot at the expected value on a line from the pessimistic case to the
 * optimistic one, with the ug/m3 and the hours over API 100 it is worth.
 */

/** Hours averaged over wind members are not whole; one decimal says so without pretending to precision. */
function hoursText(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

interface Row {
  key: string;
  title: string;
  chosen: boolean;
  score: ScoreSummary;
}

export function VerdictCompare({ verdict }: { verdict: Verdict }) {
  const rows: Row[] = [
    { key: verdict.planId, title: verdict.baselines.some((baseline) => baseline.planId === verdict.planId) ? "The committee's plan (one worked out by computer)" : "The committee's plan", chosen: true, score: verdict.score },
    // When the committee adopted a computer plan, that plan is the chosen row, not a second one.
    ...verdict.baselines.filter((baseline) => baseline.planId !== verdict.planId).map((baseline) => ({ key: baseline.planId, title: baseline.title, chosen: false, score: baseline.score })),
  ];
  const span = Math.max(1e-9, ...rows.flatMap((row) => [row.score.optimistic, row.score.pessimistic, row.score.expected]));
  const at = (share: number) => `${Math.max(0, Math.min(100, (100 * share) / span))}%`;

  return (
    <figure>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-tertiary" />
          likeliest
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-hairline-strong" />
          bad wind to good wind
        </span>
      </figcaption>
      <ul className="mt-3 space-y-4">
        {rows.map((row) => {
          const low = Math.min(row.score.pessimistic, row.score.optimistic);
          const high = Math.max(row.score.pessimistic, row.score.optimistic);
          return (
            <li key={row.key} className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] sm:items-center">
              <div className={`text-small ${row.chosen ? "font-medium text-ink" : "text-ink-secondary"}`}>
                {row.title}
                {row.chosen ? <span className="ml-1.5 text-caption text-accent">chosen</span> : null}
              </div>
              <div className="relative h-4" role="img" aria-label={`${row.title}: clears ${share(row.score.expected)}, from ${share(low)} to ${share(high)}`}>
                <div className="absolute inset-x-0 top-1/2 h-px bg-hairline" />
                <div className={`absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full ${row.chosen ? "bg-accent-line" : "bg-hairline-strong"}`} style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }} />
                <div className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${row.chosen ? "bg-accent" : "bg-ink-tertiary"}`} style={{ left: at(row.score.expected) }} />
              </div>
              <div className="text-caption text-ink-secondary tabular-nums sm:text-right" title={`${scoreWords(row.score).clears}; ${scoreWords(row.score).ifWindTurns}.`}>
                <span className="font-medium text-ink">{row.score.meanRemoved.toFixed(1)} ug/m3 cleaner</span>
                <span className="block text-ink-tertiary">
                  clears {share(row.score.expected)}, {hoursText(row.score.hoursOver100Avoided)} fewer above API 100
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
