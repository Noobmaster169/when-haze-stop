import type { DayOutlook, ForecastSourceKind } from "@/lib/api/haze-schemas";
import { dayName } from "@/lib/malaysia-time";

import { dayLine } from "./outlook-words";
import { BAND_SWATCH, bandKey } from "./scale";

/**
 * The days ahead, one row each: the day's peak in its band's colour, the
 * likely range, in words the line that matters that day, and the reason the
 * simulation gives for it. A day the learned model has no row for, while the
 * station's forecast is otherwise learned, is tagged as the hourly forecast's.
 */

function Peak({ day }: { day: DayOutlook }) {
  const peak = day.observedPeak !== null ? Math.max(day.observedPeak, day.forecastPeak ?? 0) : day.forecastPeak;
  if (peak === null) return null;
  return (
    <span className="flex items-baseline gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-1 shrink-0 self-center rounded-full ${BAND_SWATCH[bandKey(peak)]}`} />
      <span className="font-mono text-mono text-ink">{peak}</span>
      <span className="text-caption text-ink-tertiary">{day.observedPeak !== null ? "so far" : `${day.low} to ${day.high}`}</span>
    </span>
  );
}

export function DayRows({ days, source }: { days: DayOutlook[]; source: ForecastSourceKind }) {
  return (
    <ul className="divide-y divide-hairline-faint">
      {days.map((day) => (
        <li key={day.day} className="grid grid-cols-[52px_1fr] gap-x-3 py-2">
          <span className="text-small text-ink-secondary">{dayName(day.day).slice(0, -4)}</span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <Peak day={day} />
              {source !== "hourly" && day.source === "hourly" && day.forecastPeak !== null ? (
                <span title="The learned model has no row for this day, so it is the hourly forecast's" className="rounded-sm border border-hairline-strong px-1 text-micro leading-4 text-ink-tertiary">
                  hourly
                </span>
              ) : null}
            </div>
            <p className="text-caption text-ink-tertiary">{dayLine(day)}</p>
            {day.why ? <p className="text-caption text-ink-tertiary">{day.why}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
