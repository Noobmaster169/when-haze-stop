import { malaysiaMidnights } from "@/lib/malaysia-time";

/**
 * The moments a person asks about: now, tonight, tomorrow afternoon, the
 * afternoon after. Tonight is 20:00 and the afternoons 14:00, Malaysian time,
 * the hours the peaks the day rows name tend to fall at. Pure.
 */

export interface Moment {
  key: "now" | "tonight" | "tomorrow" | "dayAfter";
  label: string;
  at: number;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const TONIGHT_HOUR = 20;
const AFTERNOON_HOUR = 14;

/** The Malaysian midnight a moment's day began at: the one midnight in the day up to and including it. */
function dayStart(at: number): number {
  return malaysiaMidnights(at - DAY_MS, at + 1)[0];
}

/** Now, then each later moment the frames reach. Tonight is left out once it has passed. */
export function forecastMoments(asOfMs: number, lastFrameMs: number): Moment[] {
  const today = dayStart(asOfMs);
  const ahead: Moment[] = [
    { key: "tonight", label: "Tonight", at: today + TONIGHT_HOUR * HOUR_MS },
    { key: "tomorrow", label: "Tomorrow", at: today + DAY_MS + AFTERNOON_HOUR * HOUR_MS },
    { key: "dayAfter", label: "Day after", at: today + 2 * DAY_MS + AFTERNOON_HOUR * HOUR_MS },
  ];
  return [{ key: "now", label: "Now", at: asOfMs }, ...ahead.filter((moment) => moment.at > asOfMs && moment.at <= lastFrameMs)];
}
