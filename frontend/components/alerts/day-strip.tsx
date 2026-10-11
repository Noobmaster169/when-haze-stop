import { BAND_SWATCH, bandKey } from "@/components/map/scale";
import type { DayOutlook } from "@/lib/api/haze-schemas";
import { dayName } from "@/lib/malaysia-time";

/** The schools' closing line, marked where a day's peak passes it. */
const CLOSE_LINE = 180;

/** A day's number: what was read so far today, else the forecast peak. */
export function dayPeak(day: DayOutlook): number | null {
  if (day.observedPeak !== null && (day.forecastPeak === null || day.observedPeak >= day.forecastPeak)) return day.observedPeak;
  return day.forecastPeak;
}

/** Four days of peaks, coloured by band, today first. */
export function DayStrip({ days }: { days: DayOutlook[] }) {
  if (days.length === 0) return null;
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Peak by day">
      {days.map((day, index) => {
        const peak = dayPeak(day);
        return (
          <li key={day.day} className="rounded-md bg-sunken px-2.5 py-2">
            <p className="text-caption text-ink-tertiary">{index === 0 ? "Today" : dayName(day.day).slice(0, 6)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-strong font-medium text-ink tabular-nums">
              {peak === null ? (
                <span className="text-ink-faint">n/a</span>
              ) : (
                <>
                  <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${BAND_SWATCH[bandKey(peak)]}`} />
                  {peak}
                  {peak > CLOSE_LINE ? <span className="sr-only">, above the closing line</span> : null}
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
