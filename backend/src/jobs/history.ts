import type { Pool } from "pg";

import type { FetchDetail } from "../contracts";
import { burningCells, SCREEN_VERSION } from "../haze/burning";
import type { Detection } from "../haze/fires";
import { FIXED_MIN_DAYS, fixedMask } from "../haze/fixed-sources";
import { addHours, hoursBetween, WEATHER_POINTS } from "../haze/grid";
import { TerminalError } from "../lib/errors";
import { childLogger } from "../lib/logger";
import { fires, fixedSources, sourceFetches, weather } from "../repositories";
import type { FireArchiveClient, WeatherClient } from "../sources";
import { ARCHIVE_MAX_DAYS } from "../sources/firms-archive";
import { addDays, dayOf, daysBetween, spansOf } from "./days";
import { recordFetch } from "./record-fetch";

/**
 * What the hourly cycle cannot reach: the fixed heat sources NASA has
 * labelled, and the fires and wind of the months before the app first ran.
 *
 * Run by hand, once. It is safe to run again and to stop half way: each span
 * that came back is recorded, and a second run asks only for what is missing.
 */

const log = childLogger({ module: "jobs.history" });

export interface HistoryDeps {
  pool: Pool;
  archive: FireArchiveClient;
  weather: WeatherClient;
}

/** Two years: long enough to see a flare through both monsoons, short enough that a plant closed years ago does not mask a field burning today. */
const LABELLED_DAYS = 730;
/** One recorded fetch covers this many days, so the Sources page shows months and not hundreds of requests. */
const RECORD_DAYS = 30;
/** Open-Meteo counts a request by its days. Two weeks at a time stays inside the free tier. */
const WEATHER_DAYS = 14;
/** The newest days are still filling in as satellites pass, so they are asked for again on every run. */
const SETTLED_AFTER_DAYS = 2;

function alreadyFetched(details: FetchDetail[], feed: string): Set<string> {
  return new Set(details.filter((detail) => detail.feed === feed).map((detail) => `${detail.satellite ?? detail.screen}|${detail.from}|${detail.days}`));
}

/** Stores every fixed source the labelled archive marked in its newest two years. Returns how many sites that makes. */
export async function ingestFixedSources(deps: HistoryDeps): Promise<number> {
  const labelled = (await deps.archive.spans()).filter((span) => span.labelled);
  if (labelled.length === 0) throw new TerminalError("FIRMS lists no labelled archive, so there is nothing to tell a flare from a fire");
  const fetched = alreadyFetched(await sourceFetches.succeeded(deps.pool, "firms-archive"), "labelled");

  for (const span of labelled) {
    const first = addDays(span.to, -(LABELLED_DAYS - 1));
    for (const record of spansOf(first > span.from ? first : span.from, span.to, RECORD_DAYS)) {
      if (fetched.has(`${span.satellite}|${record.from}|${record.days}`)) continue;
      const detail = await recordFetch(deps.pool, "firms-archive", async () => {
        let seen = 0;
        let added = 0;
        for (const window of spansOf(record.from, addDays(record.from, record.days - 1), ARCHIVE_MAX_DAYS)) {
          const sources = await deps.archive.fixedSources(span.satellite, window.from, window.days);
          seen += sources.length;
          added += await fixedSources.insertMany(
            deps.pool,
            sources.map((source) => ({ day: source.day, lat100: Math.floor(source.lat * 100), lon100: Math.floor(source.lon * 100), kind: source.kind })),
          );
        }
        return { feed: "labelled", satellite: span.satellite, from: record.from, days: record.days, fixedSeen: seen, fixedAdded: added };
      });
      log.info(detail, "fixed sources stored");
    }
  }
  return (await fixedSources.sites(deps.pool, FIXED_MIN_DAYS)).length;
}

/**
 * Stores the live feed's fires from its first day to today, screened like the
 * hourly fetch. Days already stored get their burning part worked out again,
 * which is how a week fetched before any fixed source was known is put right.
 */
export async function ingestFireHistory(deps: HistoryDeps, now: Date): Promise<void> {
  const live = (await deps.archive.spans()).filter((span) => !span.labelled);
  if (live.length === 0) throw new TerminalError("FIRMS lists no live archive");
  // From the day every satellite has, so a cell-day is the largest of the same three everywhere.
  const from = live.map((span) => span.from).sort().at(-1) as string;
  const today = dayOf(now);
  const sites = await fixedSources.sites(deps.pool, FIXED_MIN_DAYS);
  const mask = fixedMask(sites);
  // A span screened by other rules or against a different list of sites has to be screened again.
  const screen = `v${SCREEN_VERSION}, ${sites.length} sites`;
  const fetched = alreadyFetched(await sourceFetches.succeeded(deps.pool, "firms-archive"), "live");

  for (const record of spansOf(from, today, RECORD_DAYS)) {
    const settled = addDays(record.from, record.days - 1) < addDays(today, -SETTLED_AFTER_DAYS);
    if (settled && fetched.has(`${screen}|${record.from}|${record.days}`)) continue;
    const detail = await recordFetch(deps.pool, "firms-archive", async () => {
      const tally = { detections: 0, glintDropped: 0, offshoreDropped: 0, fixedDropped: 0, unconfirmedDropped: 0, cellDays: 0 };
      for (const window of spansOf(record.from, addDays(record.from, record.days - 1), ARCHIVE_MAX_DAYS)) {
        const detections: Detection[] = [];
        for (const span of live) {
          const days = Math.min(window.days, daysBetween(window.from, span.to) + 1);
          if (days > 0) detections.push(...(await deps.archive.detections(span.satellite, window.from, days)));
        }
        const screened = burningCells(detections, mask);
        await fires.upsertMany(deps.pool, screened.cells, { rescreen: true });
        tally.detections += detections.length;
        tally.glintDropped += screened.glint;
        tally.offshoreDropped += screened.offshore;
        tally.fixedDropped += screened.fixed;
        tally.unconfirmedDropped += screened.unconfirmed;
        tally.cellDays += screened.cells.length;
      }
      return { feed: "live", screen, sites: sites.length, from: record.from, days: record.days, ...tally };
    });
    log.info(detail, "fire history stored");
  }
}

/**
 * Stores wind and rain from `fromDay` up to the first hour already stored,
 * newest span first, so the stored hours stay one unbroken run however early
 * this is stopped. Hours the hourly fetch stored are never asked for again.
 */
export async function ingestWeatherHistory(deps: Pick<HistoryDeps, "pool" | "weather">, fromDay: string, now: Date): Promise<number> {
  let stored = 0;
  for (;;) {
    const until = (await weather.earliestAt(deps.pool)) ?? new Date(`${dayOf(now)}T00:00:00Z`);
    const lastDay = dayOf(addHours(until, -1));
    if (lastDay < fromDay) return stored;
    const firstDay = addDays(lastDay, -(WEATHER_DAYS - 1)) > fromDay ? addDays(lastDay, -(WEATHER_DAYS - 1)) : fromDay;
    const detail = await recordFetch(deps.pool, "open-meteo-history", async () => {
      const grid = await deps.weather.history(firstDay, lastDay);
      const wanted = hoursBetween(grid.start, until);
      // A span that stops short would leave a hole the model cannot step over, and every later run would start behind it.
      if (grid.hours < wanted) throw new TerminalError(`Open-Meteo history for ${firstDay} to ${lastDay} stops ${wanted - grid.hours} hours short`);
      await weather.upsertGrid(deps.pool, { ...grid, hours: wanted });
      return { points: WEATHER_POINTS, hours: wanted, from: grid.start.toISOString(), to: addHours(grid.start, wanted - 1).toISOString() };
    });
    log.info(detail, "weather history stored");
    stored += detail.hours;
  }
}

/**
 * Without a key the fires and fixed sources of the past are whatever the seed
 * loaded, and only the wind for those days is fetched: it needs no key, and it
 * is too large to keep in the repository.
 */
export async function runHistory(deps: Omit<HistoryDeps, "archive"> & { archive: FireArchiveClient | null }, now: Date): Promise<void> {
  if (deps.archive) {
    const withArchive = { ...deps, archive: deps.archive };
    log.info({ sites: await ingestFixedSources(withArchive) }, "fixed sources known");
    await ingestFireHistory(withArchive, now);
  } else {
    log.info("no FIRMS_MAP_KEY, so the fire archive is left to the seed");
  }
  const oldest = await fires.oldestDay(deps.pool);
  if (oldest) await ingestWeatherHistory(deps, oldest, now);
}
