import type { ForecastSource } from "@/lib/api/haze-schemas";
import { malaysiaClock, malaysiaDate, malaysiaDay } from "@/lib/malaysia-time";

/**
 * The words under the map when it shows a moment ahead: whose forecast it
 * is, when that forecast was issued, and how it has done. Pure.
 */

/** The committed backtest spans June 2025 to October 2026 (docs/MODEL.md). */
const BACKTEST_MONTHS = 15;

/** "Mon 12 Oct 14:00". */
export function momentWhen(at: number | string): string {
  return `${malaysiaDay(at).slice(0, 3)} ${malaysiaDate(at)} ${malaysiaClock(at)}`;
}

/** "Sun 08:00": the day and hour a forecast was issued at. */
export function issuedWhen(at: number | string): string {
  return `${malaysiaDay(at).slice(0, 3)} ${malaysiaClock(at)}`;
}

/** "Checked on 3 days so far." */
export function checkedLine(checkedDays: number): string {
  return `Checked on ${checkedDays} ${checkedDays === 1 ? "day" : "days"} so far.`;
}

/** How much closer the learned model came than no change in its backtest, as a whole percent, or null without a backtest. */
export function backtestGain(source: ForecastSource): number | null {
  const backtest = source.record.backtest;
  if (!backtest || backtest.persistence === 0) return null;
  return Math.round(100 * (1 - backtest.model / backtest.persistence));
}

/** "the learned model and the smoke simulation, averaged", or the learned model alone. */
export function whose(source: ForecastSource): string {
  return source.kind === "blend" ? "the learned model and the smoke simulation, averaged" : "the learned model";
}

/** Empty at or before the newest reading, where nothing is forecast. */
export function captionFor(atMs: number, asOfMs: number, source: ForecastSource | null, learnedFromMs: number | null): string {
  if (atMs <= asOfMs) return "";
  const when = `Forecast for ${momentWhen(atMs)}`;
  if (!source || source.kind === "hourly" || learnedFromMs === null || atMs < learnedFromMs) {
    return `${when} by the hourly forecast, level with no change beyond a day.`;
  }
  const issued = source.issuedAt ? `, issued ${issuedWhen(source.issuedAt)}` : "";
  const gain = backtestGain(source);
  const record = gain === null ? "" : ` In the ${BACKTEST_MONTHS} month backtest the model was ${gain}% closer than no change on hazy days.`;
  return `${when} by ${whose(source)}${source.trial ? " (trial)" : ""}${issued}. ${checkedLine(source.record.checkedDays)}${record}`;
}
