import { z } from "zod";

import { TerminalError } from "../lib/errors";
import { fetchText, pause } from "./http";

/**
 * Malaysia's Department of Environment: where the stations are and what they
 * read. This is the public portal's own API (eqms.doe.gov.my/APIMS), the one
 * source of the official Air Pollutant Index.
 *
 * It serves an hourly table of the 24 hours before any instant in about the
 * last seven days, one state at a time, and nothing older.
 */

export interface DoeStation {
  id: string;
  name: string;
  state: string;
  stateId: number;
  lat: number;
  lon: number;
}

export interface DoeReading {
  stationId: string;
  observedAt: Date;
  api: number;
}

export interface DoeClient {
  stations(): Promise<DoeStation[]>;
  /** The 24 hourly readings of every station in a state, ending at `until`. */
  readings(stateId: number, until: Date): Promise<DoeReading[]>;
}

const BASE = "https://eqms.doe.gov.my/api3/publicportalapims";
const TIMEOUT_MS = 20_000;
/** The portal answers an empty body when asked faster than this. */
const SPACING_MS = 700;
const MALAYSIA_OFFSET_MS = 8 * 3_600_000;

const MapRow = z.object({
  STATION_ID: z.string(),
  STATION_LOCATION: z.string(),
  STATE_NAME: z.string(),
  STATE_ID: z.number().int(),
  LATITUDE: z.number(),
  LONGITUDE: z.number(),
});
const MapBody = z.object({ data: z.array(MapRow) });

const HourRow = z.object({ STATION_ID: z.string(), DATETIME: z.string(), API: z.number().nullable() });
const HourBody = z.object({ api_table_hourly: z.array(HourRow) });

/** DOE writes Malaysian wall-clock time with no zone: `2026-10-10T11:00:00` is 03:00 UTC. */
function fromMalaysiaTime(text: string): Date {
  return new Date(Date.parse(`${text}Z`) - MALAYSIA_OFFSET_MS);
}

function toMalaysiaTime(at: Date): string {
  return new Date(at.getTime() + MALAYSIA_OFFSET_MS).toISOString().slice(0, 19);
}

/** "Kuala Selangor, SELANGOR" is the town; the state has its own column. */
function townOf(location: string): string {
  return location.split(",")[0].trim();
}

function parse<T>(schema: z.ZodType<T>, text: string, what: string): T {
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new TerminalError(`${what} answered in a shape this client does not know`, { cause: parsed.error });
  return parsed.data;
}

export function parseStations(text: string): DoeStation[] {
  return parse(MapBody, text, "DOE station map").data.map((row) => ({
    id: row.STATION_ID,
    name: townOf(row.STATION_LOCATION),
    state: row.STATE_NAME,
    stateId: row.STATE_ID,
    lat: row.LATITUDE,
    lon: row.LONGITUDE,
  }));
}

/** A row with no API is a station that was offline that hour, and is left out rather than stored as zero. */
export function parseReadings(text: string): DoeReading[] {
  return parse(HourBody, text, "DOE hourly table").api_table_hourly.flatMap((row) =>
    row.API === null ? [] : [{ stationId: row.STATION_ID, observedAt: fromMalaysiaTime(row.DATETIME), api: row.API }],
  );
}

export function doeClient(): DoeClient {
  let lastCall = 0;
  const spaced = async (url: string, what: string): Promise<string> => {
    const wait = lastCall + SPACING_MS - Date.now();
    if (wait > 0) await pause(wait);
    lastCall = Date.now();
    return fetchText(url, what, TIMEOUT_MS);
  };

  return {
    async stations() {
      return parseStations(await spaced(`${BASE}/mapcaqm`, "DOE station map"));
    },

    async readings(stateId, until) {
      const url = `${BASE}/apitablehourly?stateid=${stateId}&datetime=${toMalaysiaTime(until)}&`;
      let text = await spaced(url, "DOE hourly table");
      // An empty body is the portal shedding load, not a state with no readings. Once more, after a breath.
      if (text.trim() === "") {
        await pause(SPACING_MS * 3);
        text = await spaced(url, "DOE hourly table");
      }
      return text.trim() === "" ? [] : parseReadings(text);
    },
  };
}
