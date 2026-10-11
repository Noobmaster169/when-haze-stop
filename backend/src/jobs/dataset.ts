import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import type { Pool } from "pg";

import { dailyWindAt } from "../haze/wind-at";
import { air, fires, metar, openaq, stations, weather } from "../repositories";
import { NEA_STATIONS } from "../sources/nea";
import { addDays, dayOf } from "./days";

/**
 * The history as five flat tables, for training a forecast outside this
 * codebase: who measures, what each measured a day, and the fires and the
 * wind those days. Everything is read from the database as stored; nothing is
 * filled in, so a day an instrument was silent has no row.
 *
 *   instruments.csv.gz       one row an instrument: a DOE station, a Singapore region, an OpenAQ sensor or an airport
 *   pm25_daily.csv.gz        ground truth: an instrument's PM2.5 over one UTC day
 *   visibility_daily.csv.gz  ground truth: an airport's visibility over one UTC day
 *   fires_daily.csv.gz       input: fire power in one 0.1 degree cell on one UTC day
 *   wind_daily.csv.gz        input: the transport wind and rain at each instrument over one UTC day
 */

interface Instrument {
  id: string;
  kind: "doe" | "nea" | "openaq" | "airport";
  name: string;
  provider: string;
  reference: boolean;
  /** What a PM2.5 value is a mean over, or empty for an airport, which reports no PM2.5. */
  averaging: "1h" | "24h" | "";
  lat: number;
  lon: number;
}

type Cell = string | number | boolean | null;

function csv(header: string[], rows: Cell[][]): Buffer {
  const cell = (value: Cell): string => {
    if (value === null) return "";
    const text = typeof value === "number" ? String(Math.round(value * 1000) / 1000) : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  // No timestamp in the gzip header, so the same rows always make the same file.
  return gzipSync(`${[header, ...rows].map((row) => row.map(cell).join(",")).join("\n")}\n`, { level: 9 });
}

async function instruments(pool: Pool): Promise<Instrument[]> {
  const [known, sensors, airports] = await Promise.all([stations.list(pool), openaq.withHours(pool), metar.airports(pool)]);
  return [
    ...known.filter((station) => station.network === "doe").map((station): Instrument => ({ id: `doe:${station.id}`, kind: "doe", name: station.name, provider: "Department of Environment Malaysia", reference: true, averaging: "24h", lat: station.lat, lon: station.lon })),
    ...NEA_STATIONS.map((place): Instrument => ({ id: `nea:${place.region}`, kind: "nea", name: place.name, provider: "National Environment Agency Singapore", reference: true, averaging: "1h", lat: place.lat, lon: place.lon })),
    ...sensors.map((sensor): Instrument => ({ id: `openaq:${sensor.sensorId}`, kind: "openaq", name: sensor.name, provider: sensor.provider, reference: sensor.reference, averaging: "1h", lat: sensor.lat, lon: sensor.lon })),
    ...airports.map((airport): Instrument => ({ id: `airport:${airport.icao}`, kind: "airport", name: airport.name, provider: "METAR", reference: true, averaging: "", lat: airport.lat, lon: airport.lon })),
  ];
}

/**
 * A day at a time: the stored wind is read as one unbroken run from its first
 * hour, so a longer span would be lost whole where its first day is missing.
 */
async function windRows(pool: Pool, places: Instrument[], fromDay: string, toDay: string): Promise<Cell[][]> {
  const rows: Cell[][] = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const grid = await weather.load(pool, new Date(`${day}T00:00:00Z`), new Date(`${day}T23:00:00Z`));
    if (!grid) continue;
    for (const place of places) {
      for (const wind of dailyWindAt(grid, place.lat, place.lon)) rows.push([place.id, wind.day, wind.u, wind.v, wind.rainMm, wind.hours]);
    }
  }
  return rows;
}

/** Writes the five tables into `dir` and returns how many rows each holds. */
export async function writeDataset(pool: Pool, dir: string, fromDay: string, now: Date): Promise<Record<string, number>> {
  const places = await instruments(pool);
  const [pm25, visibility, cells] = await Promise.all([air.dailyByInstrument(pool, fromDay), metar.dailyVisibility(pool, fromDay), fires.since(pool, fromDay)]);
  const tables: Record<string, { header: string[]; rows: Cell[][] }> = {
    instruments: { header: ["instrument_id", "kind", "name", "provider", "reference", "averaging", "lat", "lon"], rows: places.map((place) => [place.id, place.kind, place.name, place.provider, place.reference, place.averaging, place.lat, place.lon]) },
    pm25_daily: { header: ["instrument_id", "day", "pm25_mean", "pm25_max", "hours"], rows: pm25.map((row) => [row.instrumentId, row.day, row.mean, row.max, row.hours]) },
    visibility_daily: { header: ["instrument_id", "day", "reports", "dry_reports", "min_m", "median_m", "haze_reports"], rows: visibility.map((row) => [`airport:${row.icao}`, row.day, row.reports, row.dryReports, row.minM, row.medianM, row.hazeReports]) },
    // The cell's centre, which is where its fires are counted from.
    fires_daily: { header: ["day", "lat", "lon", "frp_mw"], rows: cells.map((cell) => [cell.day, cell.lat10 / 10 + 0.05, cell.lon10 / 10 + 0.05, cell.frpMw]) },
    wind_daily: { header: ["instrument_id", "day", "u_ms", "v_ms", "rain_mm", "hours"], rows: await windRows(pool, places, fromDay, dayOf(now)) },
  };
  await mkdir(dir, { recursive: true });
  const counts: Record<string, number> = {};
  for (const [name, table] of Object.entries(tables)) {
    await writeFile(join(dir, `${name}.csv.gz`), csv(table.header, table.rows));
    counts[name] = table.rows.length;
  }
  return counts;
}
