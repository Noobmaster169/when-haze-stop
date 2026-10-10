import type { DayOutlook } from "@/lib/api/haze-schemas";
import { dayName } from "@/lib/malaysia-time";

/**
 * Each of the next days against the official lines: the peak so far or the
 * forecast peak with its range, then the chance of passing each line.
 */

function chance(value: number | undefined): string {
  if (value === undefined) return "";
  if (value >= 0.995) return "yes";
  if (value < 0.005) return "0%";
  return `${Math.round(value * 100)}%`;
}

/** A day partly gone shows what was read, since no forecast can lower a peak that already happened. */
function Peak({ day }: { day: DayOutlook }) {
  const note = "text-caption text-ink-tertiary";
  if (day.observedPeak !== null) {
    return (
      <>
        {Math.max(day.observedPeak, day.forecastPeak ?? 0)} <span className={note}>{day.forecastPeak !== null && day.forecastPeak > day.observedPeak ? "forecast" : "so far"}</span>
      </>
    );
  }
  if (day.forecastPeak === null) return null;
  return (
    <>
      {day.forecastPeak}{" "}
      <span className={note}>
        {day.low} to {day.high}
      </span>
    </>
  );
}

/** Likely enough to plan around. The same line the alert uses to say haze is arriving. */
const LIKELY = 0.6;

export function DayTable({ days }: { days: DayOutlook[] }) {
  if (days.length === 0) return null;
  const lines = Object.keys(days[0].chance);
  return (
    <table className="w-full border-collapse text-small">
      <thead>
        <tr className="text-caption text-ink-tertiary">
          <th className="py-1 text-left font-normal">Day</th>
          <th className="py-1 text-left font-normal">Peak</th>
          {lines.map((line) => (
            <th key={line} className="py-1 text-right font-normal">
              &gt;{line}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.day} className="border-t border-hairline-faint">
            <td className="whitespace-nowrap py-1.5 text-ink-secondary">{dayName(day.day).slice(0, -4)}</td>
            <td className="whitespace-nowrap py-1.5 text-ink">
              <Peak day={day} />
            </td>
            {lines.map((line) => (
              <td key={line} className={`py-1.5 text-right font-mono text-mono-sm ${(day.chance[line] ?? 0) >= LIKELY ? "font-medium text-fault" : "text-ink-secondary"}`}>
                {chance(day.chance[line])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
