"use client";

import type { FireDay } from "@/lib/api/haze-schemas";
import { dayName } from "@/lib/malaysia-time";

/**
 * Every stored day as one bar of fire power. Pressing a bar puts that day on
 * the map; Live goes back to now. The days are UTC days, as the satellites'
 * files count them.
 */

interface Props {
  days: FireDay[];
  day: string | null;
  onChoose(day: string | null): void;
}

/** A square root, so a quiet day still shows as a bar beside a day twenty times its size. */
function height(frpMw: number, largest: number): string {
  return `${Math.max(6, Math.sqrt(frpMw / largest) * 100)}%`;
}

export function HistoryStrip({ days, day, onChoose }: Props) {
  if (days.length === 0) return null;
  const largest = Math.max(...days.map((entry) => entry.frpMw), 1);
  const chosen = days.find((entry) => entry.day === day) ?? null;

  return (
    <div className="shrink-0 border-t border-hairline bg-canvas px-4 py-2 md:px-6">
      <div className="flex items-center gap-x-3">
        <div className="w-[164px] shrink-0">
          <p className="text-strong font-medium text-ink">{chosen ? dayName(chosen.day) : "History"}</p>
          <p className="text-caption text-ink-tertiary">
            {chosen ? `${chosen.cells.toLocaleString("en-GB")} fire cells, ${chosen.frpMw.toLocaleString("en-GB")} MW` : `Fires by day since ${dayName(days[0].day)}`}
          </p>
        </div>
        <div className="flex h-9 min-w-0 grow items-end gap-px" role="group" aria-label="Choose a past day">
          {days.map((entry) => (
            <button
              key={entry.day}
              type="button"
              title={`${dayName(entry.day)}: ${entry.cells.toLocaleString("en-GB")} fire cells, ${entry.frpMw.toLocaleString("en-GB")} MW`}
              aria-label={`Show ${dayName(entry.day)}`}
              aria-pressed={entry.day === day}
              onClick={() => onChoose(entry.day)}
              style={{ height: height(entry.frpMw, largest) }}
              className={`min-w-0 flex-1 rounded-t-[1px] ${entry.day === day ? "bg-accent" : "bg-hairline-strong hover:bg-ink-tertiary"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChoose(null)}
          disabled={!day}
          className="h-8 shrink-0 rounded-md border border-hairline-strong px-3 text-small font-medium text-ink-secondary hover:bg-active hover:text-ink disabled:cursor-default disabled:text-ink-faint disabled:hover:bg-transparent"
        >
          Live
        </button>
      </div>
    </div>
  );
}
