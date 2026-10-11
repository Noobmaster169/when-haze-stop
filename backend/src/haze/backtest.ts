import { apiToPm25 } from "./api-index";
import { seeded } from "./rng";
import { forecastStation, SLOPE_HOURS } from "./station-forecast";

/**
 * The station forecast replayed at every stored hour, each time from the
 * readings up to that hour alone, and scored against "no change" on exactly
 * the same cases. Pure: hand it the readings, get the proof back.
 *
 * Nothing it forecasts from postdates the hour it forecasts from, and it uses
 * no weather, so there is nothing for it to leak.
 */

export const BACKTEST_LEADS = [1, 3, 6, 12, 24, 36, 48, 60, 72];
const HORIZON = 72;
const HOUR_MS = 3_600_000;
const RESAMPLES = 2000;

/** Readings by station, each an hourly series from a shared first hour, NaN where missing. */
export interface ReadingGrid {
  first: Date;
  stations: Map<string, Float32Array>;
}

export interface LeadSkill {
  lead: number;
  cases: number;
  /** Mean absolute error in API points. */
  model: number;
  persistence: number;
  /** 90% interval of (model - persistence) resampling whole days, since a day's cases move together. */
  low: number;
  high: number;
}

export interface DaySkill {
  /** UTC day the forecasts were made, `YYYY-MM-DD`. */
  day: string;
  cases: number;
  model: number;
  persistence: number;
}

interface Case {
  lead: number;
  day: string;
  model: number;
  persistence: number;
}

function forecastAt(series: Float32Array, hour: number): Float32Array | null {
  if (Number.isNaN(series[hour]) || hour < SLOPE_HOURS) return null;
  return forecastStation({ readings: series, anchorHour: hour, now: hour, end: hour + HORIZON });
}

function cases(grid: ReadingGrid): Case[] {
  const out: Case[] = [];
  for (const series of grid.stations.values()) {
    for (let hour = SLOPE_HOURS; hour < series.length - 1; hour++) {
      const api = forecastAt(series, hour);
      if (!api) continue;
      const day = new Date(grid.first.getTime() + hour * HOUR_MS).toISOString().slice(0, 10);
      for (const lead of BACKTEST_LEADS) {
        const observed = series[hour + lead];
        if (observed === undefined || Number.isNaN(observed)) continue;
        out.push({ lead, day, model: Math.abs(api[lead - 1] - observed), persistence: Math.abs(series[hour] - observed) });
      }
    }
  }
  return out;
}

function interval(byDay: Map<string, { diff: number; count: number }>): [number, number] {
  const days = [...byDay.values()];
  const random = seeded(20261010);
  const means: number[] = [];
  for (let draw = 0; draw < RESAMPLES; draw++) {
    let diff = 0;
    let count = 0;
    for (let pick = 0; pick < days.length; pick++) {
      const day = days[Math.floor(random.next() * days.length)];
      diff += day.diff;
      count += day.count;
    }
    means.push(count === 0 ? 0 : diff / count);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.05 * RESAMPLES)], means[Math.floor(0.95 * RESAMPLES)]];
}

export function backtest(grid: ReadingGrid, dayLead: number): { leads: LeadSkill[]; days: DaySkill[] } {
  const all = cases(grid);
  const leads = BACKTEST_LEADS.map((lead) => {
    const mine = all.filter((item) => item.lead === lead);
    const byDay = new Map<string, { diff: number; count: number }>();
    for (const item of mine) {
      const day = byDay.get(item.day) ?? { diff: 0, count: 0 };
      day.diff += item.model - item.persistence;
      day.count += 1;
      byDay.set(item.day, day);
    }
    const [low, high] = mine.length === 0 ? [0, 0] : interval(byDay);
    const mean = (pick: (item: Case) => number): number => (mine.length === 0 ? 0 : mine.reduce((sum, item) => sum + pick(item), 0) / mine.length);
    return { lead, cases: mine.length, model: mean((item) => item.model), persistence: mean((item) => item.persistence), low, high };
  });

  const perDay = new Map<string, DaySkill>();
  for (const item of all.filter((entry) => entry.lead === dayLead)) {
    const day = perDay.get(item.day) ?? { day: item.day, cases: 0, model: 0, persistence: 0 };
    day.cases += 1;
    day.model += item.model;
    day.persistence += item.persistence;
    perDay.set(item.day, day);
  }
  const days = [...perDay.values()].sort((a, b) => a.day.localeCompare(b.day)).map((day) => ({ ...day, model: day.model / day.cases, persistence: day.persistence / day.cases }));
  return { leads, days };
}

export interface Replay {
  stationId: string;
  /** The hour the forecast was made from. */
  madeAt: Date;
  /** Readings from a day before `madeAt` to `lead` hours after it. */
  readings: { at: Date; api: number }[];
  forecast: { at: Date; api: number }[];
  /** Mean absolute error over the `lead` hours after `madeAt`. */
  model: number;
  persistence: number;
}

/**
 * Haze arriving, replayed: at each station the steepest three-hour crossing
 * from 100 or under to over 100 with a full `lead` of readings after it, the
 * `count` steepest stations, each forecast from the hour it crossed. Chosen by
 * that rule alone, so the cases it loses are shown with the ones it wins.
 */
export function arrivals(grid: ReadingGrid, lead: number, count: number): Replay[] {
  const found: { stationId: string; hour: number; rise: number }[] = [];
  for (const [stationId, series] of grid.stations) {
    let best: { hour: number; rise: number } | null = null;
    for (let hour = 24; hour + lead < series.length; hour++) {
      const before = series[hour - SLOPE_HOURS];
      if (Number.isNaN(series[hour]) || Number.isNaN(before) || !(before <= 100 && series[hour] > 100)) continue;
      let complete = true;
      for (let ahead = 1; ahead <= lead && complete; ahead++) complete = !Number.isNaN(series[hour + ahead]);
      const rise = apiToPm25(series[hour]) - apiToPm25(before);
      if (complete && (!best || rise > best.rise)) best = { hour, rise };
    }
    if (best) found.push({ stationId, ...best });
  }
  const at = (hour: number): Date => new Date(grid.first.getTime() + hour * HOUR_MS);
  return found
    .sort((a, b) => b.rise - a.rise)
    .slice(0, count)
    .map(({ stationId, hour }) => {
      const series = grid.stations.get(stationId) as Float32Array;
      const api = (forecastAt(series, hour) as Float32Array).subarray(0, lead);
      const readings = [];
      for (let back = hour - 24; back <= hour + lead; back++) if (!Number.isNaN(series[back])) readings.push({ at: at(back), api: series[back] });
      let model = 0;
      let persistence = 0;
      for (let ahead = 1; ahead <= lead; ahead++) {
        model += Math.abs(api[ahead - 1] - series[hour + ahead]) / lead;
        persistence += Math.abs(series[hour] - series[hour + ahead]) / lead;
      }
      return { stationId, madeAt: at(hour), readings, forecast: Array.from(api, (value, index) => ({ at: at(hour + index + 1), api: value })), model, persistence };
    });
}
