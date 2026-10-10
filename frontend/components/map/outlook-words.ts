import type { DayOutlook, StationOutlook } from "@/lib/api/haze-schemas";

/**
 * A station's outlook said in words: one headline for the days ahead, one
 * line per day, and how the reading has moved. Pure.
 *
 * The headline uses the alert rules' own thresholds (backend
 * haze/alert-rules.ts), so the panel and the alerts never disagree.
 */

const LINES = [100, 150, 180, 200] as const;
/** Likely enough to plan around: the alerts' "arriving" and "clearing" threshold. */
const LIKELY = 0.6;
/** Said as near certain. */
const CERTAIN = 0.9;
/** Below this a line is not worth naming. */
const REMOTE = 0.1;

/** What crossing each line means, from the official guidelines. */
const MEANS: Record<number, string> = {
  100: "unhealthy",
  150: "three days of it closes schools",
  180: "schools close",
  200: "very unhealthy",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekday(day: string): string {
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
}

const chanceOf = (day: DayOutlook, line: number): number => day.chance[String(line)] ?? 0;

/** The outlook in one sentence, from the latest reading and the day outlooks (today first). */
export function headline(api: number, days: DayOutlook[]): string | null {
  const [, tomorrow, ...later] = days;
  if (!tomorrow) return null;
  const rising = [...LINES].reverse().find((line) => api <= line && chanceOf(tomorrow, line) >= LIKELY);
  if (rising) return `Rising: likely above ${rising} tomorrow.`;
  const ahead = [tomorrow, ...later].filter((day) => day.forecastPeak !== null);
  if (api > 100) {
    const clear = ahead.find((day) => chanceOf(day, 100) <= 1 - LIKELY);
    if (!clear) return "Likely to stay above 100 for the next few days.";
    return clear === tomorrow ? "Easing: likely below 100 by tomorrow." : `Easing: likely below 100 by ${weekday(clear.day)}.`;
  }
  const arriving = ahead.find((day) => chanceOf(day, 100) >= LIKELY);
  return arriving ? `Haze likely: above 100 by ${weekday(arriving.day)}.` : "Likely to stay under 100 for the next few days.";
}

/** One day in a line: the highest line already passed or near certain, then the one still in doubt. */
export function dayLine(day: DayOutlook): string {
  const passed = day.observedPeak !== null ? [...LINES].reverse().find((line) => chanceOf(day, line) >= 0.995) : undefined;
  const sure = passed ?? [...LINES].reverse().find((line) => chanceOf(day, line) >= CERTAIN);
  const doubt = LINES.find((line) => line > (sure ?? 0) && chanceOf(day, line) >= REMOTE && chanceOf(day, line) < CERTAIN);
  const parts: string[] = [];
  if (passed) parts.push(`Passed ${passed}, ${MEANS[passed]}`);
  else if (sure) parts.push(`Almost certainly above ${sure}`);
  if (doubt) parts.push(`${Math.round(chanceOf(day, doubt) * 100)}% chance above ${doubt}`);
  if (parts.length === 0) return chanceOf(day, 100) < REMOTE ? "Likely under 100" : "";
  const [first, ...rest] = parts;
  return [first, ...rest.map((part) => part.charAt(0).toLowerCase() + part.slice(1))].join(", ");
}

/** How the readings moved over the hours before a moment, or null without a reading that far back. */
export function trend(readings: StationOutlook["readings"], at: number, hours = 6): number | null {
  const before = (moment: number) => readings.filter((point) => Date.parse(point.at) <= moment).at(-1);
  const now = before(at);
  const then = before(at - hours * 3_600_000);
  if (!now || !then || Date.parse(now.at) - Date.parse(then.at) < (hours - 1) * 3_600_000) return null;
  return now.api - then.api;
}
