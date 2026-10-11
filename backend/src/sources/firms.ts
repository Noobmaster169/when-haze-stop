import { TerminalError } from "../lib/errors";
import type { Detection } from "../haze/fires";
import { fetchText } from "./http";

/**
 * NASA FIRMS: where satellites saw fire in the last seven days.
 *
 * The three VIIRS instruments (on Suomi NPP, NOAA-20 and NOAA-21) each publish
 * a rolling seven-day file for South East Asia. They are a few megabytes each
 * and change only when a satellite passes, a few times a day.
 */

export interface FiresClient {
  recent(): Promise<Detection[]>;
}

const BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire";
const FILES = [
  { satellite: "snpp", path: "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_7d.csv" },
  { satellite: "noaa20", path: "noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_7d.csv" },
  { satellite: "noaa21", path: "noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_7d.csv" },
] as const;
const TIMEOUT_MS = 180_000;
/** Where VIIRS I4 saturates. A pixel reported at this value measured "at least this hot". */
const SATURATED_K = 367;

/** Rows FIRMS itself marks low confidence are mostly sun glint and hot roofs. */
export function parseFirmsCsv(csv: string, satellite: string): Detection[] {
  const lines = csv.split("\n");
  const header = lines[0].trim().split(",");
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index < 0) throw new TerminalError(`FIRMS ${satellite} file has no "${name}" column`);
    return index;
  };
  const lat = column("latitude");
  const lon = column("longitude");
  const day = column("acq_date");
  const time = column("acq_time");
  const brightness = column("bright_ti4");
  const daynight = column("daynight");
  const frp = column("frp");
  const confidence = column("confidence");

  const detections: Detection[] = [];
  for (let n = 1; n < lines.length; n++) {
    const cells = lines[n].split(",");
    if (cells.length < header.length) continue;
    if (cells[confidence].trim().toLowerCase().startsWith("l")) continue;
    detections.push({
      satellite,
      lat: Number(cells[lat]),
      lon: Number(cells[lon]),
      day: cells[day],
      // acq_time is HHMM in UTC, sometimes without its leading zero.
      hour: Math.floor(Number(cells[time]) / 100),
      daytime: cells[daynight].trim() === "D",
      saturated: Number(cells[brightness]) >= SATURATED_K,
      frpMw: Number(cells[frp]),
    });
  }
  return detections;
}

export function firmsClient(): FiresClient {
  return {
    async recent() {
      const detections: Detection[] = [];
      // One at a time: three files of this size in parallel is the kind of load that gets a client blocked.
      for (const file of FILES) {
        detections.push(...parseFirmsCsv(await fetchText(`${BASE}/${file.path}`, `FIRMS ${file.satellite}`, TIMEOUT_MS), file.satellite));
      }
      return detections;
    },
  };
}
