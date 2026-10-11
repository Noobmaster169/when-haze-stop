import type { DayOutlook, Station } from "../contracts";
import type { Queryable } from "../db";
import { addHours, DOMAIN, WEATHER } from "../haze/grid";
import { localDay } from "../haze/outlook";
import { windFrom } from "../haze/regions";
import { whyFor } from "../haze/why";
import { weather } from "../repositories";

/**
 * The reason under each learned day of a station's outlook: the simulation's
 * smoke on that day and the wind at the station when it peaks. The wind is
 * read for the peak hours alone, because the whole stored week is far more
 * than one sentence needs.
 */

const MALAYSIA_OFFSET_HOURS = 8;

/** The weather grid point nearest a place; one degree is the finest the stored wind knows. */
function nearestWeatherPoint(station: Pick<Station, "lat" | "lon">): number {
  const column = Math.min(WEATHER.nx - 1, Math.max(0, Math.round((station.lon - DOMAIN.lon0) / WEATHER.step)));
  const row = Math.min(WEATHER.ny - 1, Math.max(0, Math.round((station.lat - DOMAIN.lat0) / WEATHER.step)));
  return row * WEATHER.nx + column;
}

interface Peak {
  at: Date;
  physicsDay: number[];
}

/** Where each learned day's line peaks and what the simulation gave over the day. `line` is the reshaped series from asOf + 1. */
function peaksOf(asOf: Date, line: number[], physics: number[] | null, days: DayOutlook[]): Map<string, Peak> {
  const peaks = new Map<string, Peak>();
  for (const day of days) {
    if (day.source !== "learned") continue;
    let best = -1;
    const physicsDay: number[] = [];
    line.forEach((value, index) => {
      if (localDay(addHours(asOf, index + 1)) !== day.day) return;
      physicsDay.push(physics?.[index] ?? 0);
      if (best < 0 || value > line[best]) best = index;
    });
    if (best >= 0) peaks.set(day.day, { at: addHours(asOf, best + 1), physicsDay });
  }
  return peaks;
}

/** The days with `why` filled in for every learned day. Days on the hourly forecast keep null: the hourly forecast's reason is the readings themselves. */
export async function withWhy(db: Queryable, station: Station, asOf: Date, line: number[], physics: number[] | null, days: DayOutlook[]): Promise<DayOutlook[]> {
  const peaks = peaksOf(asOf, line, physics, days);
  if (peaks.size === 0) return days;
  const stored = await weather.windAt(db, [...peaks.values()].map((peak) => peak.at));
  const point = nearestWeatherPoint(station);
  const windAt = new Map(stored.map((hour) => [hour.validAt.toISOString(), windFrom(hour.u[point], hour.v[point])]));
  return days.map((day) => {
    const peak = peaks.get(day.day);
    if (!peak) return day;
    const hourOfPeak = (peak.at.getUTCHours() + MALAYSIA_OFFSET_HOURS) % 24;
    return { ...day, why: whyFor({ physicsDay: peak.physicsDay, hourOfPeak, windFromDeg: windAt.get(peak.at.toISOString()) ?? null }) };
  });
}
