import { TerminalError } from "../lib/errors";
import { fetchPatiently, pause } from "./http";
import { AIRPORTS, type MetarReport, visibilityOf } from "./metar";

/**
 * Airport weather reports of the past, from the archive Iowa State University
 * keeps of every METAR the world's airports have issued.
 *
 * The live service answers a few days back and no further, so this is where
 * the months before the app first ran come from: the same reports, word for
 * word, read by the same parser. The archive names no airport, so a report
 * carries its code as its name until the live feed says what it is called.
 */

export interface MetarArchiveClient {
  /** Every listed airport's reports for `days` whole UTC days from `from`. */
  reports(from: string, days: number): Promise<MetarReport[]>;
}

const BASE = "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py";
/** A month of 29 airports is some 40,000 lines; the archive builds the file before it sends a byte. */
const TIMEOUT_MS = 300_000;
/** The archive asks scripts to come one request at a time and not back to back. */
const SPACING_MS = 2000;
const DAY_MS = 86_400_000;
const HEADER = "station,valid,lon,lat,metar,wxcodes";

/** `year1=2025&month1=7&day1=20`, the way the archive takes a day. The second day is the first one left out. */
function dayQuery(which: 1 | 2, at: Date): string {
  return `year${which}=${at.getUTCFullYear()}&month${which}=${at.getUTCMonth() + 1}&day${which}=${at.getUTCDate()}`;
}

/**
 * A line is `station,valid,lon,lat,metar,wxcodes`. The report itself is free
 * text and may hold a comma, so it is whatever lies between the first four
 * cells and the last.
 */
export function parseMetarArchive(csv: string): MetarReport[] {
  const lines = csv.split("\n");
  if (lines[0].trim() !== HEADER) throw new TerminalError(`the METAR archive answered "${lines[0].trim().slice(0, 80)}"`);
  const reports: MetarReport[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.trim().split(",");
    if (cells.length < 6) continue;
    const [icao, valid, lon, lat] = cells;
    const raw = cells.slice(4, -1).join(",");
    const weather = cells[cells.length - 1];
    const observedAt = new Date(`${valid.replace(" ", "T")}:00Z`);
    if (raw === "M" || Number.isNaN(observedAt.getTime())) continue;
    reports.push({
      icao,
      name: icao,
      lat: Number(lat),
      lon: Number(lon),
      observedAt,
      visibilityM: visibilityOf(raw, null),
      weather: weather === "M" || weather === "" ? null : weather,
      raw,
    });
  }
  return reports;
}

export function metarArchiveClient(): MetarArchiveClient {
  return {
    async reports(from, days) {
      const start = new Date(`${from}T00:00:00Z`);
      const stations = AIRPORTS.map((icao) => `station=${icao}`).join("&");
      // Routine reports and the specials an observer files when the weather turns, as the live feed gives both.
      const url = `${BASE}?${stations}&data=metar&data=wxcodes&${dayQuery(1, start)}&${dayQuery(2, new Date(start.getTime() + days * DAY_MS))}&tz=Etc/UTC&format=onlycomma&latlon=yes&missing=M&trace=T&direct=no&report_type=3&report_type=4`;
      const reports = parseMetarArchive(await fetchPatiently(url, "the METAR archive", TIMEOUT_MS));
      await pause(SPACING_MS);
      return reports;
    },
  };
}
