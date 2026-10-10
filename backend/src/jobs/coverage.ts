import type { Pool } from "pg";

import type { StoredDay } from "../contracts";
import { hazeDays } from "../services/history";

/**
 * What is stored of the four kinds of data, month by month, as a table for a
 * terminal: the check to make after `pnpm haze:history`, and before training
 * on a span, that the span is really there.
 */

interface MonthRow {
  month: string;
  days: number;
  fireDays: number;
  windDays: number;
  airportDays: number;
  /** The most airports that reported on one day of the month. */
  airports: number;
  airDays: number;
  /** The most instruments that measured PM2.5 on one day of the month. */
  monitors: number;
}

export function byMonth(days: StoredDay[]): MonthRow[] {
  const months = new Map<string, MonthRow>();
  for (const day of days) {
    const month = day.day.slice(0, 7);
    const row = months.get(month) ?? { month, days: 0, fireDays: 0, windDays: 0, airportDays: 0, airports: 0, airDays: 0, monitors: 0 };
    row.days += 1;
    if (day.cells > 0) row.fireDays += 1;
    if (day.windHours === 24) row.windDays += 1;
    if (day.airports > 0) row.airportDays += 1;
    if (day.monitors > 0) row.airDays += 1;
    row.airports = Math.max(row.airports, day.airports);
    row.monitors = Math.max(row.monitors, day.monitors);
    months.set(month, row);
  }
  return [...months.values()];
}

export function formatCoverage(rows: MonthRow[]): string {
  const cell = (value: string | number, width: number): string => String(value).padStart(width);
  const lines = ["month    days  fires  wind  visibility (airports)  PM2.5 (instruments)"];
  for (const row of rows) {
    lines.push(`${row.month}  ${cell(row.days, 4)}  ${cell(row.fireDays, 5)}  ${cell(row.windDays, 4)}  ${cell(row.airportDays, 10)} ${cell(`(${row.airports})`, 10)}  ${cell(row.airDays, 5)} ${cell(`(${row.monitors})`, 13)}`);
  }
  lines.push("Each number is the days of the month with that data; wind counts only days with all 24 hours.");
  return lines.join("\n");
}

export async function coverage(pool: Pool, now: Date, fromDay: string): Promise<string> {
  return formatCoverage(byMonth((await hazeDays(pool, now, fromDay)).days));
}
