import type { ScoreSummary, Verdict } from "@/lib/api/council-schemas";

import { percent } from "./words";

/**
 * The chosen plan beside the plans made by code, as a share of the ceiling:
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
    { key: verdict.planId, title: `${verdict.planId}, ${verdict.title}`, chosen: true, score: verdict.score },
    ...verdict.baselines.map((baseline) => ({ key: baseline.planId, title: baseline.title, chosen: false, score: baseline.score })),
  ];
  const span = Math.max(1e-9, ...rows.flatMap((row) => [row.score.optimistic, row.score.pessimistic, row.score.expected]));
  const at = (share: number) => `${Math.max(0, Math.min(100, (100 * share) / span))}%`;

  return (
    <figure>
      <figcaption className="text-small font-medium text-ink">Against the plans made by code</figcaption>
      <p className="mt-0.5 text-caption text-ink-tertiary">
        Share of the ceiling: every fire out from day 1 would remove {verdict.ceiling.toFixed(2)} ug/m3 of KL&apos;s PM2.5 on average over the horizon. Dot: expected; line: pessimistic to optimistic.
      </p>
      <ul className="mt-4 space-y-4">
        {rows.map((row) => {
          const low = Math.min(row.score.pessimistic, row.score.optimistic);
          const high = Math.max(row.score.pessimistic, row.score.optimistic);
          return (
            <li key={row.key} className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] sm:items-center">
              <div className={`text-small ${row.chosen ? "font-medium text-ink" : "text-ink-secondary"}`}>
                {row.title}
                {row.chosen ? <span className="ml-1.5 text-caption text-accent">chosen</span> : null}
              </div>
              <div className="relative h-4" role="img" aria-label={`${row.title}: expected ${percent(row.score.expected)}, from ${percent(low)} to ${percent(high)}`}>
                <div className="absolute inset-x-0 top-1/2 h-px bg-hairline" />
                <div className={`absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full ${row.chosen ? "bg-accent-line" : "bg-hairline-strong"}`} style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }} />
                <div className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${row.chosen ? "bg-accent" : "bg-ink-tertiary"}`} style={{ left: at(row.score.expected) }} />
              </div>
              <div className="text-caption text-ink-secondary tabular-nums sm:text-right">
                <span className="font-medium text-ink">{percent(row.score.expected)}</span> ({percent(low)} to {percent(high)})
                <span className="block text-ink-tertiary">
                  {row.score.meanRemoved.toFixed(2)} ug/m3, {hoursText(row.score.hoursOver100Avoided)} over API 100 avoided
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
