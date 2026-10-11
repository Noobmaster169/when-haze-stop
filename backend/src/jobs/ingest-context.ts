import { childLogger } from "../lib/logger";
import { metar, nea, readings, stations } from "../repositories";
import { NEA_STATIONS } from "../sources/nea";
import type { IngestDeps } from "./ingest";
import { recordFetch } from "./record-fetch";

/**
 * Airport visibility and Singapore's readings. One function a source, so one
 * being down does not stop the other.
 */

const log = childLogger({ module: "jobs.ingest-context" });

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const SINGAPORE_OFFSET_MS = 8 * HOUR_MS;
/** METARs come every half hour; three hours covers a cycle that was missed. */
const METAR_HOURS = 3;
/** On the first run, as far back as a day of reports, which is what a visibility question looks at. */
const METAR_FIRST_HOURS = 24;
/** NEA serves a day at a time; on the first run, a week, to match the readings DOE serves. */
const NEA_FIRST_DAYS = 7;

function singaporeDay(at: Date): string {
  return new Date(at.getTime() + SINGAPORE_OFFSET_MS).toISOString().slice(0, 10);
}

export async function ingestMetars(deps: IngestDeps): Promise<number> {
  const detail = await recordFetch(deps.pool, "metar", async () => {
    const hours = (await metar.newestAt(deps.pool)) ? METAR_HOURS : METAR_FIRST_HOURS;
    const reports = await deps.metar.recent(hours);
    await metar.upsertAirports(deps.pool, reports);
    const added = await metar.insertMany(deps.pool, reports);
    const newest = Math.max(0, ...reports.map((report) => report.observedAt.getTime()));
    return {
      hoursAsked: hours,
      airports: new Set(reports.map((report) => report.icao)).size,
      reports: reports.length,
      added,
      ...(newest ? { newestReport: new Date(newest).toISOString() } : {}),
    };
  });
  log.info(detail, "METARs stored");
  return detail.added;
}

/**
 * Today and yesterday in Singapore time, so an hour posted late is still
 * picked up; a week on the first run. Each region is a station, and its
 * 24 hour PSI is stored as that station's reading beside DOE's.
 */
export async function ingestSingapore(deps: IngestDeps, now: Date): Promise<number> {
  const detail = await recordFetch(deps.pool, "nea", async () => {
    await stations.upsertMany(deps.pool, NEA_STATIONS.map((station) => ({ ...station, state: "Singapore", stateId: 0, network: "nea" as const })));
    const byRegion = new Map(NEA_STATIONS.map((station) => [station.region, station.id]));
    const days = (await nea.newestAt(deps.pool)) ? 2 : NEA_FIRST_DAYS;
    let hours = 0;
    let added = 0;
    let readingsAdded = 0;
    let newest = 0;
    for (let back = days - 1; back >= 0; back--) {
      const found = await deps.nea.hours(singaporeDay(new Date(now.getTime() - back * DAY_MS)));
      hours += found.length;
      added += await nea.insertMany(deps.pool, found);
      readingsAdded += await readings.insertMany(
        deps.pool,
        found.flatMap((hour) => (hour.psi24h === null ? [] : [{ stationId: byRegion.get(hour.region) ?? "", observedAt: hour.observedAt, api: hour.psi24h }])),
      );
      for (const hour of found) newest = Math.max(newest, hour.observedAt.getTime());
    }
    return { stations: NEA_STATIONS.length, daysAsked: days, hours, added, readingsAdded, ...(newest ? { newestReading: new Date(newest).toISOString() } : {}) };
  });
  log.info(detail, "Singapore hours stored");
  return detail.added;
}
