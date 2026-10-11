import type { Moment } from "./forecast-moments";

/**
 * The row beside the slider that puts the map on a moment a person asks
 * about: now, tonight, the next two afternoons. The one the map is on is
 * pressed. Looking back at a past day they are greyed out, as the Now mark
 * is: the History strip is the way back to the live map.
 */

const CHIP = "h-8 rounded-md border px-3 text-small font-medium transition-colors duration-150 disabled:cursor-default disabled:border-hairline-strong disabled:bg-transparent disabled:text-ink-faint";
const ON = "border-ink bg-ink text-ink-inverse";
const OFF = "border-hairline-strong text-ink-secondary hover:bg-active hover:text-ink";

export function JumpChips({ moments, at, disabled, onJump }: { moments: Moment[]; at: number; disabled: boolean; onJump(at: number): void }) {
  return (
    <div role="group" aria-label="Jump to" className="flex shrink-0 flex-wrap gap-1">
      {moments.map((moment) => {
        const on = at === moment.at;
        return (
          <button key={moment.key} type="button" aria-pressed={on} disabled={disabled} onClick={() => onJump(moment.at)} className={`${CHIP} ${on ? ON : OFF}`}>
            {moment.label}
          </button>
        );
      })}
    </div>
  );
}
