import type { Verdict } from "@/lib/api/council-schemas";

import { ringgit } from "./verdict-cost";
import { scoreWords, share } from "./words";

/** The verdict's three figures, and where KL's smoke comes from, kept to numbers with short labels. */

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-3" title={note}>
      <div className="text-caption text-ink-tertiary">{label}</div>
      <div className="mt-0.5 font-display text-[22px] leading-[28px] text-ink">{value}</div>
    </div>
  );
}

function arrival(hours: number | null): string {
  if (hours === null) return "Not within two weeks";
  const days = Math.round(hours / 24);
  return days < 1 ? "Within a day" : `After about ${days} day${days > 1 ? "s" : ""}`;
}

export function VerdictFacts({ verdict }: { verdict: Verdict }) {
  const words = scoreWords(verdict.score);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Figure label="KL's air, on average" value={`${verdict.score.meanRemoved.toFixed(1)} ug/m3 cleaner`} note={`${words.clears}; ${words.ifWindTurns}. Every fire out would give ${verdict.ceiling.toFixed(1)} ug/m3.`} />
      <Figure label="Cost" value={verdict.cost ? ringgit(verdict.cost.total) : "Not worked out"} note={verdict.cost ? `Of the ${ringgit(verdict.cost.budget)} set aside` : "Held before budgets were part of the plan"} />
      <Figure label="When KL feels it" value={arrival(verdict.score.arrivalHours)} note="When the smoke model first shows a tenth of the plan's biggest effect on KL" />
    </div>
  );
}

/** Where KL's coming smoke comes from, by area, for this week's wind. */
export function VerdictSources({ sources }: { sources: NonNullable<Verdict["sources"]> }) {
  return (
    <ul className="space-y-2">
      {sources.map((item) => (
        <li key={item.area} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_48px] items-center gap-3 text-small">
          <span className="truncate text-ink">{item.area}</span>
          <span className="h-2 overflow-hidden rounded-full bg-sunken">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(1, 100 * item.share)}%` }} />
          </span>
          <span className="text-right text-ink-secondary tabular-nums">{share(item.share)}</span>
        </li>
      ))}
    </ul>
  );
}
