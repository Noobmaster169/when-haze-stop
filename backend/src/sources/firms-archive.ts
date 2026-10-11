import { z } from "zod";

import type { Detection } from "../haze/fires";
import { DOMAIN } from "../haze/grid";
import { TerminalError } from "../lib/errors";
import { parseFirmsCsv } from "./firms";
import { fetchPatiently, fetchText, pause } from "./http";

/**
 * NASA FIRMS, further back than the rolling seven-day files: any days of the
 * last months from the live feed, and years of the standard product.
 *
 * The standard product runs months behind and is the one that says what each
 * hotspot is: vegetation fire, volcano, other static land source or offshore.
 * The live feed never carries that label. Before the live feed's first day the
 * standard product is also the only record of the fires themselves, in the
 * same columns. Needs a free map key.
 */

export type Satellite = "snpp" | "noaa20" | "noaa21";

/** The days one feed of one satellite can be asked for, both ends included. */
export interface ArchiveSpan {
  satellite: Satellite;
  labelled: boolean;
  from: string;
  to: string;
}

/** A hotspot the standard product marks as something other than vegetation burning. */
export interface LabelledSource {
  day: string;
  lat: number;
  lon: number;
  kind: "volcano" | "static" | "offshore";
}

export interface FireArchiveClient {
  spans(): Promise<ArchiveSpan[]>;
  /** One feed's detections for `days` days from `from`, low confidence dropped. `labelled` asks the standard product. */
  detections(satellite: Satellite, from: string, days: number, labelled: boolean): Promise<Detection[]>;
  /** The standard product's fixed sources for `days` days from `from`. */
  fixedSources(satellite: Satellite, from: string, days: number): Promise<LabelledSource[]>;
}

/** The most days the area endpoint serves in one answer. */
export const ARCHIVE_MAX_DAYS = 5;

const BASE = "https://firms.modaps.eosdis.nasa.gov/api";
/** West, south, east, north: the model's region. Part of what a stored span is keyed by, so a wider region is fetched again. */
export const ARCHIVE_AREA = `${DOMAIN.lon0},${DOMAIN.lat0},${DOMAIN.lon1},${DOMAIN.lat1}`;
const TIMEOUT_MS = 120_000;
/** A request for this area costs about 7 of the key's 5,000 transactions per ten minutes. This spacing uses a little over half. */
const SPACING_MS = 1500;
const PRODUCTS: Record<string, { satellite: Satellite; labelled: boolean }> = {
  VIIRS_SNPP_NRT: { satellite: "snpp", labelled: false },
  VIIRS_NOAA20_NRT: { satellite: "noaa20", labelled: false },
  VIIRS_NOAA21_NRT: { satellite: "noaa21", labelled: false },
  VIIRS_SNPP_SP: { satellite: "snpp", labelled: true },
  VIIRS_NOAA20_SP: { satellite: "noaa20", labelled: true },
};
/** NASA's `type` column. 0 is a presumed vegetation fire and is not a fixed source. */
const KINDS: Record<string, LabelledSource["kind"]> = { "1": "volcano", "2": "static", "3": "offshore" };
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function productOf(satellite: Satellite, labelled: boolean): string {
  const found = Object.entries(PRODUCTS).find(([, product]) => product.satellite === satellite && product.labelled === labelled);
  if (!found) throw new TerminalError(`FIRMS has no ${labelled ? "labelled" : "live"} archive for ${satellite}`);
  return found[0];
}

/** FIRMS answers a bad key or a bad range with 200 and a sentence, so the header is the only proof of a real answer. */
function csvOrThrow(body: string, what: string): string {
  if (!body.startsWith("latitude")) throw new TerminalError(`${what} answered "${body.trim().slice(0, 80)}"`);
  return body;
}

export function parseSpans(csv: string): ArchiveSpan[] {
  const spans: ArchiveSpan[] = [];
  for (const line of csv.split("\n").slice(1)) {
    const [id, from, to] = line.trim().split(",");
    const product = PRODUCTS[id];
    if (!product || !Day.safeParse(from).success || !Day.safeParse(to).success) continue;
    spans.push({ ...product, from, to });
  }
  return spans;
}

export function parseFixedSources(csv: string): LabelledSource[] {
  const lines = csv.split("\n");
  const header = lines[0].trim().split(",");
  const [lat, lon, day, type, confidence] = ["latitude", "longitude", "acq_date", "type", "confidence"].map((name) => header.indexOf(name));
  if (Math.min(lat, lon, day, type, confidence) < 0) throw new TerminalError("the FIRMS standard product is missing a column this client reads");
  const sources: LabelledSource[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.trim().split(",");
    const kind = KINDS[cells[type]];
    if (cells.length < header.length || !kind || cells[confidence].toLowerCase().startsWith("l")) continue;
    sources.push({ day: cells[day], lat: Number(cells[lat]), lon: Number(cells[lon]), kind });
  }
  return sources;
}

export function firmsArchiveClient(mapKey: string): FireArchiveClient {
  let lastAsked = 0;
  const area = async (satellite: Satellite, labelled: boolean, from: string, days: number): Promise<string> => {
    const what = `FIRMS archive ${satellite}`;
    const wait = lastAsked + SPACING_MS - Date.now();
    if (wait > 0) await pause(wait);
    lastAsked = Date.now();
    return csvOrThrow(await fetchPatiently(`${BASE}/area/csv/${mapKey}/${productOf(satellite, labelled)}/${ARCHIVE_AREA}/${days}/${from}`, what, TIMEOUT_MS), what);
  };
  return {
    async spans() {
      return parseSpans(await fetchText(`${BASE}/data_availability/csv/${mapKey}/ALL`, "FIRMS availability", TIMEOUT_MS));
    },
    async detections(satellite, from, days, labelled) {
      return parseFirmsCsv(await area(satellite, labelled, from, days), satellite);
    },
    async fixedSources(satellite, from, days) {
      return parseFixedSources(await area(satellite, true, from, days));
    },
  };
}
