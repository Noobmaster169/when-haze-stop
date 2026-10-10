import { z } from "zod";

import { TerminalError } from "../lib/errors";
import { fetchText } from "./http";

/**
 * Airport weather reports (METARs) from NOAA's aviation weather service, for
 * the airports of Malaysia, Singapore, Brunei and the Indonesian provinces
 * the smoke comes from.
 *
 * A METAR is the one hourly, human-checked measure of haze there is: the
 * prevailing visibility in metres, and whether the observer called it haze
 * (HZ) or smoke (FU). Airlines decide on it, which the API never tells them.
 */

export interface MetarReport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  observedAt: Date;
  /** Metres, where 10000 means ten kilometres or more. Null when the report gives none. */
  visibilityM: number | null;
  /** Present weather codes as reported, space separated, or null. */
  weather: string | null;
  raw: string;
}

export interface MetarClient {
  /** The reports of the last `hours` hours at every airport in the list, newest first as the service sends them. */
  recent(hours: number): Promise<MetarReport[]>;
}

/** Peninsula and Borneo airports, Changi, Brunei, then Sumatra and Kalimantan, which sit among the fires. */
export const AIRPORTS = [
  "WMKK", "WMSA", "WMKP", "WMKJ", "WMKM", "WMKI", "WMKD", "WMKC", "WMKN", "WMKL", "WMKA",
  "WBKK", "WBGG", "WBGB", "WBGR", "WBGS", "WBKW", "WBKS", "WBKL",
  "WSSS", "WBSB",
  "WIBB", "WIMM", "WIPP", "WIDD", "WIDN", "WIOO", "WAOO", "WALL",
] as const;

/** The names people use for the airports they ask about, to the code the reports use. */
export const AIRPORT_ALIASES: Record<string, string> = {
  klia: "WMKK", klia2: "WMKK", sepang: "WMKK", subang: "WMSA", penang: "WMKP", senai: "WMKJ", changi: "WSSS",
  "kota kinabalu": "WBKK", kuching: "WBGG", langkawi: "WMKL", brunei: "WBSB", pekanbaru: "WIBB", medan: "WIMM", palembang: "WIPP", pontianak: "WIOO",
};

const BASE = "https://aviationweather.gov/api/data/metar";
const TIMEOUT_MS = 30_000;
/** What a METAR means by "ten kilometres or more". */
export const FAR_M = 10_000;
const MILE_M = 1609.344;

const Report = z.object({
  icaoId: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  /** Seconds since the epoch. */
  obsTime: z.number(),
  /** Statute miles, or "6+" for as far as the report says. */
  visib: z.union([z.number(), z.string()]).nullish(),
  wxString: z.string().nullish(),
  rawOb: z.string(),
});
const Body = z.array(Report);

/**
 * The visibility group of the raw report, in metres, which is how airports
 * outside the United States write it: four digits, or CAVOK for clear. The
 * JSON's miles are the fallback, for a report with neither.
 */
export function visibilityOf(raw: string, visib: number | string | null | undefined): number | null {
  const tokens = raw.split(/\s+/);
  const end = tokens.indexOf("RMK");
  for (const token of tokens.slice(3, end < 0 ? undefined : end)) {
    if (token === "CAVOK") return FAR_M;
    // 9999 is the code for ten kilometres or more, not a distance.
    const metres = /^(\d{4})(?:NDV)?$/.exec(token);
    if (metres) return metres[1] === "9999" ? FAR_M : Number(metres[1]);
  }
  if (typeof visib === "number") return Math.min(FAR_M, Math.round((visib * MILE_M) / 100) * 100);
  if (typeof visib === "string" && /^\d+\+$/.test(visib)) return FAR_M;
  return null;
}

/** "Singapore/Changi Intl, 4, SG" is the airport; the rest is a region code and the country. */
function nameOf(full: string): string {
  return full.split(",")[0].trim();
}

export function parseMetars(text: string): MetarReport[] {
  const parsed = Body.safeParse(JSON.parse(text));
  if (!parsed.success) throw new TerminalError("aviationweather.gov answered in a shape this client does not know", { cause: parsed.error });
  return parsed.data.map((report) => ({
    icao: report.icaoId,
    name: nameOf(report.name),
    lat: report.lat,
    lon: report.lon,
    observedAt: new Date(report.obsTime * 1000),
    visibilityM: visibilityOf(report.rawOb, report.visib),
    weather: report.wxString?.trim() ? report.wxString.trim() : null,
    raw: report.rawOb,
  }));
}

export function metarClient(): MetarClient {
  return {
    async recent(hours) {
      const url = `${BASE}?ids=${AIRPORTS.join(",")}&format=json&hours=${hours}`;
      return parseMetars(await fetchText(url, "aviationweather.gov METARs", TIMEOUT_MS));
    },
  };
}
