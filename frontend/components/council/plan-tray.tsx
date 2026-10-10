import type { PlanCard, Tray } from "./tray";
import { scoreWords } from "./words";

/**
 * The plans on the board, each gaining the smoke model's number as the replay
 * reaches it: one bar against the best plan so far, and how much cleaner KL's
 * air gets. The share of the clearable smoke is in the tooltip.
 */

function Card({ card, best, scoring }: { card: PlanCard; best: number; scoring: boolean }) {
  const tone = card.chosen ? "border-accent-line bg-accent-tint/40" : scoring ? "border-review-line" : "border-hairline";
  const words = card.score ? scoreWords(card.score) : null;
  return (
    <li className={`rounded-lg border bg-surface px-3 py-2.5 transition-[border-color,opacity] duration-300 ${tone} ${card.refused ? "opacity-50" : ""}`} title={card.refused ? "Refused: it breaks a rule of the package" : undefined}>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 grow text-small font-medium text-ink">{card.title}</span>
        {card.chosen ? <span className="shrink-0 rounded-full bg-accent px-2 py-px text-micro font-medium text-ink-inverse">Chosen</span> : null}
      </div>
      {card.score && words ? (
        <div className="mt-2" title={`${words.clears}; ${words.ifWindTurns}.`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <div
              className={`h-full origin-left rounded-full transition-transform duration-500 ease-[var(--ease-island)] ${card.chosen ? "bg-accent" : card.baseline ? "bg-ink-faint" : "bg-review"}`}
              style={{ transform: `scaleX(${best > 0 ? Math.max(0.02, card.score.meanRemoved / best) : 0})` }}
            />
          </div>
          <div className="mt-1 text-caption text-ink-secondary tabular-nums">{words.cleaner}</div>
        </div>
      ) : null}
    </li>
  );
}

export function PlanTray({ tray }: { tray: Tray }) {
  if (tray.plans.length === 0) return <p className="text-small text-ink-tertiary">No plan on the table yet.</p>;
  const best = Math.max(0, ...tray.plans.map((card) => card.score?.meanRemoved ?? 0));
  const council = tray.plans.filter((card) => !card.baseline);
  const baselines = tray.plans.filter((card) => card.baseline);
  return (
    <div className="space-y-5">
      {council.length > 0 ? (
        <ul className="space-y-2">
          {council.map((card) => (
            <Card key={card.planId} card={card} best={best} scoring={tray.scoring === card.planId} />
          ))}
        </ul>
      ) : null}
      {baselines.length > 0 ? (
        <div>
          <h3 className="mb-2 text-caption text-ink-tertiary">Simple plans to beat, made by computer</h3>
          <ul className="space-y-2">
            {baselines.map((card) => (
              <Card key={card.planId} card={card} best={best} scoring={tray.scoring === card.planId} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
