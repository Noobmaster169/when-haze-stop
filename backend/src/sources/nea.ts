import { z } from "zod";

import { TerminalError } from "../lib/errors";
import { fetchText, pause } from "./http";

/**
 * Singapore's National Environment Agency, through data.gov.sg: the one-hour
 * PM2.5 and the 24-hour PSI for five regions, hourly. Singapore sits inside
 * the map's region, downwind of Sumatra, and publishes concentrations, which
 * DOE does not.
 *
 * Both endpoints answer the newest hour, or every hour of a day when asked
 * with `date=YYYY-MM-DD` in Singapore time.
 */

export const NEA_REGIONS = ["north", "south", "east", "west", "central"] as const;
export type NeaRegion = (typeof NEA_REGIONS)[number];

export interface NeaHour {
  region: NeaRegion;
  observedAt: Date;
  pm25Hourly: number | null;
  pm2524h: number | null;
  psi24h: number | null;
}

/**
 * The regions as stations, placed where NEA labels them on its own map. Their
 * reading is the 24 hour PSI, the index NEA advises on, which is built the
 * same way as Malaysia's API and uses the same bands.
 */
export const NEA_STATIONS: readonly { id: string; region: NeaRegion; name: string; lat: number; lon: number }[] = [
  { id: "SGCENTRAL", region: "central", name: "Singapore Central", lat: 1.35735, lon: 103.82 },
  { id: "SGEAST", region: "east", name: "Singapore East", lat: 1.35735, lon: 103.94 },
  { id: "SGNORTH", region: "north", name: "Singapore North", lat: 1.41803, lon: 103.82 },
  { id: "SGSOUTH", region: "south", name: "Singapore South", lat: 1.29587, lon: 103.82 },
  { id: "SGWEST", region: "west", name: "Singapore West", lat: 1.35735, lon: 103.7 },
];

export function neaRegionOf(stationId: string): NeaRegion | null {
  return NEA_STATIONS.find((station) => station.id === stationId)?.region ?? null;
}

export interface NeaClient {
  /** Every region's hours for one Singapore day, or the newest hour when `day` is null. */
  hours(day: string | null): Promise<NeaHour[]>;
}

const BASE = "https://api.data.gov.sg/v1/environment";
const TIMEOUT_MS = 20_000;
const SPACING_MS = 500;

const byRegion = z.record(z.string(), z.number());
const Item = z.object({ timestamp: z.string(), readings: z.record(z.string(), byRegion) });
const Body = z.object({ items: z.array(Item) });

function parse(text: string, what: string): z.infer<typeof Body> {
  const parsed = Body.safeParse(JSON.parse(text));
  if (!parsed.success) throw new TerminalError(`${what} answered in a shape this client does not know`, { cause: parsed.error });
  return parsed.data;
}

function isRegion(name: string): name is NeaRegion {
  return (NEA_REGIONS as readonly string[]).includes(name);
}

/**
 * Joins the two feeds on region and hour. An hour in one feed and not the
 * other keeps what it has, because NEA posts them seconds apart and a fetch
 * can land between.
 */
export function parseNea(pm25Text: string, psiText: string): NeaHour[] {
  const hours = new Map<string, NeaHour>();
  const at = (region: NeaRegion, timestamp: string): NeaHour => {
    const key = `${region}|${timestamp}`;
    let hour = hours.get(key);
    if (!hour) {
      hour = { region, observedAt: new Date(timestamp), pm25Hourly: null, pm2524h: null, psi24h: null };
      hours.set(key, hour);
    }
    return hour;
  };
  for (const item of parse(pm25Text, "NEA PM2.5").items) {
    for (const [region, value] of Object.entries(item.readings.pm25_one_hourly ?? {})) {
      if (isRegion(region)) at(region, item.timestamp).pm25Hourly = value;
    }
  }
  for (const item of parse(psiText, "NEA PSI").items) {
    for (const [region, value] of Object.entries(item.readings.psi_twenty_four_hourly ?? {})) {
      if (isRegion(region)) at(region, item.timestamp).psi24h = value;
    }
    for (const [region, value] of Object.entries(item.readings.pm25_twenty_four_hourly ?? {})) {
      if (isRegion(region)) at(region, item.timestamp).pm2524h = value;
    }
  }
  return [...hours.values()].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime() || a.region.localeCompare(b.region));
}

export function neaClient(): NeaClient {
  return {
    async hours(day) {
      const query = day ? `?date=${day}` : "";
      const pm25 = await fetchText(`${BASE}/pm25${query}`, "NEA PM2.5", TIMEOUT_MS);
      await pause(SPACING_MS);
      const psi = await fetchText(`${BASE}/psi${query}`, "NEA PSI", TIMEOUT_MS);
      return parseNea(pm25, psi);
    },
  };
}
