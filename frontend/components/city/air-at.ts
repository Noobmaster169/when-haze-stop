import type { CityHour } from "@/lib/api/city-schemas";

/**
 * The city's air at any moment, read between its hours, so the haze thickens
 * and clears smoothly as the timeline plays rather than jumping each hour.
 * Pure.
 */

export interface AirAt {
  api: number;
  pm25: number;
  visibilityKm: number;
  aerosolDepth: number;
  observed: boolean;
}

const HOUR_MS = 3_600_000;
const MALAYSIA_MS = 8 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;

export function airAt(hours: CityHour[], at: number): AirAt | null {
  if (hours.length === 0) return null;
  const times = hours.map((hour) => Date.parse(hour.at));
  let after = times.findIndex((time) => time >= at);
  if (after === -1) after = hours.length - 1;
  const before = Math.max(0, after - 1);
  const [a, b] = [hours[before], hours[after]];
  const span = times[after] - times[before];
  const share = span > 0 ? Math.min(1, Math.max(0, (at - times[before]) / span)) : 1;
  const blend = (from: number, to: number): number => from + (to - from) * share;
  return {
    api: Math.round(blend(a.api, b.api)),
    pm25: blend(a.pm25, b.pm25),
    // Extinction, not distance, is what blends linearly: halfway between 2 km and 20 km looks like 3.6 km, not 11.
    visibilityKm: 1 / blend(1 / a.visibilityKm, 1 / b.visibilityKm),
    aerosolDepth: blend(a.aerosolDepth, b.aerosolDepth),
    observed: share < 1 ? a.observed : b.observed,
  };
}

/** 13:00 in Kuala Lumpur on the same local day, about when the sun is highest there. */
export function middayOf(at: number): number {
  return Math.floor((at + MALAYSIA_MS) / DAY_MS) * DAY_MS - MALAYSIA_MS + 13 * HOUR_MS;
}
