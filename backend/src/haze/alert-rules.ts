import type { AlertKind, DayOutlook } from "../contracts";
import { LINES } from "./guidelines";

/**
 * What is worth telling someone about a station, decided from its reading and
 * its outlook. Pure: the job hands in the state and stores what comes back.
 *
 * Three things are worth saying. A reading passed a line. The forecast says a
 * line will be passed tomorrow. The forecast says the air will drop back under
 * 100. Each is said once and stays open until it stops being true.
 */

export interface StationState {
  stationId: string;
  name: string;
  api: number | null;
  /** Today first, then the days after it. */
  days: DayOutlook[];
}

export interface Condition {
  stationId: string;
  kind: AlertKind;
  threshold: number;
  message: string;
  detail: Record<string, unknown>;
}

/** A forecast alert is only sent when the model gives at least this chance, so a wrong one stays rare. */
const LIKELY = 0.6;
/** A reading has to fall this far under a line before the alert for it can fire again. */
const SLACK = 5;
const CLEAR_LINE = 100;

const MEANS: Record<number, string> = {
  100: "Schools stop outdoor activities and the Health Ministry advises limiting time outdoors.",
  150: "Three days in a row above 150 closes schools.",
  180: "Schools close under the Education Ministry rule.",
  200: "The Health Ministry advises avoiding strenuous outdoor work.",
};

function weekday(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** The conditions that hold for one station right now. At most one per kind: the highest line that applies. */
export function conditionsFor(state: StationState, stillOpen: (kind: AlertKind, threshold: number) => boolean): Condition[] {
  const { api, days, stationId, name } = state;
  if (api === null) return [];
  const found: Condition[] = [];

  // An open alert holds until the reading is clearly back under its line, so one hovering at the line says it once.
  const passed = [...LINES].reverse().find((line) => api > line || (stillOpen("observed", line) && api > line - SLACK));
  if (passed !== undefined) {
    found.push({ stationId, kind: "observed", threshold: passed, message: `${name}: API ${api}, above ${passed}. ${MEANS[passed]}`, detail: { api } });
  }

  const tomorrow = days[1];
  if (tomorrow) {
    const coming = [...LINES].reverse().find((line) => api <= line && (tomorrow.chance[line] ?? 0) >= LIKELY);
    if (coming !== undefined) {
      const percent = Math.round((tomorrow.chance[coming] ?? 0) * 100);
      found.push({
        stationId,
        kind: "arriving",
        threshold: coming,
        message: `${name}: ${percent}% chance of API above ${coming} tomorrow. ${MEANS[coming]}`,
        detail: { api, day: tomorrow.day, forecastPeak: tomorrow.forecastPeak, chance: tomorrow.chance[coming] },
      });
    }
  }

  if (api > CLEAR_LINE) {
    const clear = days.slice(1).find((day) => day.forecastPeak !== null && (day.chance[CLEAR_LINE] ?? 1) <= 1 - LIKELY);
    if (clear) {
      found.push({
        stationId,
        kind: "clearing",
        threshold: CLEAR_LINE,
        message: `${name}: likely to drop below ${CLEAR_LINE} by ${weekday(clear.day)}. Outdoor activities could resume then.`,
        detail: { api, day: clear.day, forecastPeak: clear.forecastPeak },
      });
    }
  }
  return found;
}
