import type { Verdict } from "@/lib/api/council-schemas";

/** What the chosen plan costs against the money set aside, line by line. Runs made before budgets have no cost and show nothing. */

export function ringgit(rm: number): string {
  if (rm >= 1_000_000) return `RM ${(rm / 1_000_000).toFixed(1)} million`;
  return `RM ${Math.round(rm).toLocaleString("en-MY")}`;
}

export function VerdictCost({ cost }: { cost: NonNullable<Verdict["cost"]> }) {
  const used = Math.min(1, cost.total / Math.max(1, cost.budget));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-small">
        <span className="text-ink">
          <span className="font-semibold">{ringgit(cost.total)}</span> of the {ringgit(cost.budget)} set aside
        </span>
        <span className="text-ink-tertiary">{ringgit(Math.max(0, cost.budget - cost.total))} left over</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${Math.round(100 * used)}% of the budget used`}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${100 * used}%` }} />
      </div>
      <ul className="mt-4 divide-y divide-hairline-faint text-small">
        {[...cost.lines]
          .sort((a, b) => b.rm - a.rm)
          .map((line) => (
            <li key={line.label} className="flex justify-between gap-3 py-1.5">
              <span className="text-ink-secondary">{line.label}</span>
              <span className="text-ink tabular-nums">{ringgit(line.rm)}</span>
            </li>
          ))}
      </ul>
      <p className="mt-2 text-caption text-ink-tertiary">Costs are estimates from published rates: about EUR 15,000 an hour for the water bomber, about USD 6,000 an hour for a helicopter, about RM 1,000 a day for a person working abroad.</p>
    </div>
  );
}
