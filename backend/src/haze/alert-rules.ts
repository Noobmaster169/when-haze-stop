import type { AlertKind, DayOutlook, Statement } from "../contracts";
import { CLEAR_LINE, CLOSE_LINE, closingOutlook, LIKELY, percent, SUSTAINED_LINE, weekday } from "./closing";

/**
 * What is worth telling someone about a station: what the government will do
 * there, and when. Pure: the job hands in the state and stores what comes back.
 *
 * Three things are said, most impactful first, and only the first that holds
 * is raised: an official order covers the area; the forecast says a line that
 * closes schools will be passed tomorrow; the forecast says the air will drop
 * back under 100. A reading that is above a line now is not an alert: the map
 * and the area's card already show it.
 */

export interface StationState {
  stationId: string;
  name: string;
  api: number | null;
  /** Today first, then the days after it. */
  days: DayOutlook[];
  yesterdayPeak: number | null;
  /** Orders in force or about to be that cover the station, newest first. */
  orders: Statement[];
}

export interface Condition {
  stationId: string;
  kind: AlertKind;
  /** The line, or for an order the statement's id. */
  threshold: number;
  message: string;
  detail: Record<string, unknown>;
}

/** An open forecast alert holds down to this chance, so one hovering at 60% is said once. */
const STILL_LIKELY = 0.5;

function shortDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

function orderCondition(state: StationState): Condition | null {
  const [order] = state.orders;
  if (!order) return null;
  const from = order.status === "upcoming" && order.effectiveFrom ? ` From ${shortDay(order.effectiveFrom)}.` : "";
  return {
    stationId: state.stationId,
    kind: "order",
    threshold: order.id,
    message: `${order.issuerName}: ${order.summary}${from}`,
    detail: { statementId: order.id, url: order.url, action: order.action },
  };
}

function forecastCondition(state: StationState, stillOpen: (kind: AlertKind, threshold: number) => boolean): Condition | null {
  const outlook = closingOutlook(state);
  const bar = (line: number): number => (stillOpen("arriving", line) ? STILL_LIKELY : LIKELY);
  const { tomorrow } = outlook;
  if (!tomorrow) return null;
  const detail = { api: state.api, day: tomorrow.day, forecastPeak: tomorrow.forecastPeak };

  if (outlook.passChance >= bar(CLOSE_LINE)) {
    return {
      stationId: state.stationId,
      kind: "arriving",
      threshold: CLOSE_LINE,
      message: `${state.name}: schools may close tomorrow. ${percent(outlook.passChance)} chance of API above ${CLOSE_LINE}, the Education Ministry's closing line.`,
      detail: { ...detail, chance: outlook.passChance },
    };
  }
  if (outlook.thirdDayChance >= bar(SUSTAINED_LINE)) {
    return {
      stationId: state.stationId,
      kind: "arriving",
      threshold: SUSTAINED_LINE,
      message: `${state.name}: schools may close. ${percent(outlook.thirdDayChance)} chance tomorrow is a third day above ${SUSTAINED_LINE}, which closes schools.`,
      detail: { ...detail, chance: outlook.thirdDayChance },
    };
  }
  return null;
}

function clearingCondition(state: StationState): Condition | null {
  const { clearingDay, tomorrow } = closingOutlook(state);
  if (!clearingDay) return null;
  // Said as the card says it, so the alert and the card never name the same day two ways.
  const when = clearingDay === tomorrow ? "tomorrow" : `by ${weekday(clearingDay.day)}`;
  return {
    stationId: state.stationId,
    kind: "clearing",
    threshold: CLEAR_LINE,
    message: `${state.name}: likely below ${CLEAR_LINE} ${when}. Outdoor activities can resume then.`,
    detail: { api: state.api, day: clearingDay.day, forecastPeak: clearingDay.forecastPeak },
  };
}

/** The one alert that should be open for a station now, or null. */
export function alertFor(state: StationState, stillOpen: (kind: AlertKind, threshold: number) => boolean): Condition | null {
  if (state.api === null && state.orders.length === 0) return null;
  return orderCondition(state) ?? forecastCondition(state, stillOpen) ?? clearingCondition(state);
}
