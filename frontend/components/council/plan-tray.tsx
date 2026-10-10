import { nameOf } from "./caption";
import type { Timeline } from "./timeline";
import { meanRating, type PlanCard, type Tray } from "./tray";
import { percent } from "./words";

/**
 * The plans on the board, each gaining the engine's numbers and the seats'
 * ratings as the replay reaches them. Bars are drawn against the best plan on
 * the board, so the gap between plans reads at a glance; the figure beside
 * each is the share of the ceiling itself.
 */

function Card({ card, best, scoring, timeline }: { card: PlanCard; best: number; scoring: boolean; timeline: Timeline }) {
  const mean = meanRating(card);
  const tone = card.chosen ? "border-accent-line bg-accent-tint/40" : scoring ? "border-review-line" : "border-hairline";
  return (
    <li className={`rounded-lg border bg-surface px-3 py-2.5 transition-[border-color,opacity] duration-300 ${tone} ${card.refused ? "opacity-60" : ""}`}>
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-caption font-semibold text-ink-tertiary tabular-nums">{card.planId}</span>
        <span className="min-w-0 grow text-small font-medium text-ink">{card.title}</span>
        {card.chosen ? <span className="shrink-0 rounded-full bg-accent px-2 py-px text-micro font-medium text-ink-inverse">Chosen</span> : null}
      </div>
      <div className="mt-0.5 line-clamp-2 text-caption text-ink-tertiary" title={card.premise ?? undefined}>
        {card.baseline ? "Made by code, a plan to beat" : `${nameOf(timeline.agents, card.by)}${card.premise ? `, ${card.premise.replace(/\.$/, "").toLowerCase()}` : ""}`}
      </div>
      {card.refused ? <div className="mt-1 text-caption text-fault">Refused by the validator</div> : null}
      {card.score ? (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <div
              className={`h-full origin-left rounded-full transition-transform duration-500 ease-[var(--ease-island)] ${card.chosen ? "bg-accent" : card.baseline ? "bg-ink-faint" : "bg-review"}`}
              style={{ transform: `scaleX(${best > 0 ? Math.max(0.02, card.score.expected / best) : 0})` }}
            />
          </div>
          <div className="mt-1 flex justify-between gap-2 text-caption text-ink-secondary tabular-nums">
            <span>{percent(card.score.expected)} of the ceiling expected</span>
            <span className="text-ink-tertiary">worst wind {percent(card.score.worstWind)}</span>
          </div>
        </div>
      ) : null}
      {card.ratings.length > 0 && mean !== null ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="flex gap-0.5" aria-hidden>
            {card.ratings.map((rating) => (
              <span key={rating.agent} title={`${nameOf(timeline.agents, rating.agent)}: ${rating.score}/10. ${rating.note}`} className="h-2.5 w-1 rounded-full bg-ink-tertiary" style={{ opacity: 0.25 + (0.75 * rating.score) / 10 }} />
            ))}
          </span>
          <span className="text-caption text-ink-secondary tabular-nums">
            {mean.toFixed(1)} of 10 from {card.ratings.length} {card.ratings.length === 1 ? "seat" : "seats"}
          </span>
        </div>
      ) : null}
    </li>
  );
}

export function PlanTray({ tray, timeline }: { tray: Tray; timeline: Timeline }) {
  if (tray.plans.length === 0) return <p className="text-small text-ink-tertiary">No plan on the board yet. Drafts are written blind, one per seat, each under its own premise.</p>;
  const best = Math.max(0, ...tray.plans.map((card) => card.score?.expected ?? 0));
  const council = tray.plans.filter((card) => !card.baseline);
  const baselines = tray.plans.filter((card) => card.baseline);
  return (
    <div className="space-y-5">
      {council.length > 0 ? (
        <ul className="space-y-2">
          {council.map((card) => (
            <Card key={card.planId} card={card} best={best} scoring={tray.scoring === card.planId} timeline={timeline} />
          ))}
        </ul>
      ) : null}
      {baselines.length > 0 ? (
        <div>
          <h3 className="mb-2 text-caption text-ink-tertiary">Plans to beat, made by code</h3>
          <ul className="space-y-2">
            {baselines.map((card) => (
              <Card key={card.planId} card={card} best={best} scoring={tray.scoring === card.planId} timeline={timeline} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
