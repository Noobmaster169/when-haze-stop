import type { Pool } from "pg";

import type { FetchDetail } from "../contracts";
import { burningCells, SCREEN_VERSION } from "../haze/burning";
import type { Detection } from "../haze/fires";
import { FIXED_MIN_DAYS, fixedMask } from "../haze/fixed-sources";
import { TerminalError } from "../lib/errors";
import { childLogger } from "../lib/logger";
import { fires, fixedSources, sourceFetches } from "../repositories";
import type { ArchiveSpan, FireArchiveClient } from "../sources";
import { ARCHIVE_AREA, ARCHIVE_MAX_DAYS } from "../sources/firms-archive";
import { addDays, dayOf, daysBetween, spansOf } from "./days";
import { recordFetch } from "./record-fetch";

/**
 * The fires of the past: the fixed heat sources NASA has labelled, and every
 * day's detections from the first day asked for, screened like the hourly
 * fetch.
 *
 * Safe to run again and to stop half way: each span that came back is
 * recorded, and a second run asks only for what is missing.
 */

const log = childLogger({ module: "jobs.history-fires" });

export interface FireHistoryDeps {
  pool: Pool;
  archive: FireArchiveClient;
}

/** Two years: long enough to see a flare through both monsoons, short enough that a plant closed years ago does not mask a field burning today. */
const LABELLED_DAYS = 730;
/** One recorded fetch covers this many days, so the Sources page shows months and not hundreds of requests. */
export const RECORD_DAYS = 30;
/** The newest days are still filling in as satellites pass, so they are asked for again on every run. */
export const SETTLED_AFTER_DAYS = 2;

export function alreadyFetched(details: FetchDetail[], feed: string): Set<string> {
  return new Set(details.filter((detail) => detail.feed === feed).map((detail) => `${detail.satellite ?? detail.screen ?? ""}|${detail.area ?? ""}|${detail.from}|${detail.days}`));
}

/** Stores every fixed source the labelled archive marked in its newest two years. Returns how many sites that makes. */
export async function ingestFixedSources(deps: FireHistoryDeps): Promise<number> {
  const labelled = (await deps.archive.spans()).filter((span) => span.labelled);
  if (labelled.length === 0) throw new TerminalError("FIRMS lists no labelled archive, so there is nothing to tell a flare from a fire");
  const fetched = alreadyFetched(await sourceFetches.succeeded(deps.pool, "firms-archive"), "labelled");

  for (const span of labelled) {
    const first = addDays(span.to, -(LABELLED_DAYS - 1));
    for (const record of spansOf(first > span.from ? first : span.from, span.to, RECORD_DAYS)) {
      if (fetched.has(`${span.satellite}|${ARCHIVE_AREA}|${record.from}|${record.days}`)) continue;
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
        return { feed: "labelled", satellite: span.satellite, area: ARCHIVE_AREA, from: record.from, days: record.days, fixedSeen: seen, fixedAdded: added };
      });
      log.info(detail, "fixed sources stored");
    }
  }
  return (await fixedSources.sites(deps.pool, FIXED_MIN_DAYS)).length;
}

/**
 * The requests that cover `days` days from `from` for every satellite. A day
 * comes from the live feed where that has it and from the standard product
 * before, which is the same instrument's record a few months on. A satellite
 * with neither for a day is left out of it.
 */
export function feedsFor(spans: ArchiveSpan[], from: string, days: number): { satellite: ArchiveSpan["satellite"]; labelled: boolean; from: string; days: number }[] {
  const to = addDays(from, days - 1);
  const asks: { satellite: ArchiveSpan["satellite"]; labelled: boolean; from: string; days: number }[] = [];
  for (const satellite of new Set(spans.map((span) => span.satellite))) {
    const live = spans.find((span) => span.satellite === satellite && !span.labelled);
    const standard = spans.find((span) => span.satellite === satellite && span.labelled);
    const cut = (span: ArchiveSpan, last: string): void => {
      const first = from > span.from ? from : span.from;
      const end = [to, span.to, last].sort()[0];
      if (first <= end) asks.push({ satellite, labelled: span.labelled, from: first, days: daysBetween(first, end) + 1 });
    };
    if (standard) cut(standard, live ? addDays(live.from, -1) : to);
    if (live) cut(live, to);
  }
  return asks;
}

/**
 * Stores the fires from `fromDay` to today. Days already stored get their
 * burning part worked out again, which is how a week fetched before any fixed
 * source was known is put right.
 */
export async function ingestFireHistory(deps: FireHistoryDeps, fromDay: string, now: Date): Promise<void> {
  const spans = await deps.archive.spans();
  if (!spans.some((span) => !span.labelled)) throw new TerminalError("FIRMS lists no live archive");
  const today = dayOf(now);
  const sites = await fixedSources.sites(deps.pool, FIXED_MIN_DAYS);
  const mask = fixedMask(sites);
  // A span screened by other rules or against a different list of sites has to be screened again.
  const screen = `v${SCREEN_VERSION}, ${sites.length} sites`;
  const fetched = alreadyFetched(await sourceFetches.succeeded(deps.pool, "firms-archive"), "fires");

  for (const record of spansOf(fromDay, today, RECORD_DAYS)) {
    const settled = addDays(record.from, record.days - 1) < addDays(today, -SETTLED_AFTER_DAYS);
    if (settled && fetched.has(`${screen}|${ARCHIVE_AREA}|${record.from}|${record.days}`)) continue;
    const windows = spansOf(record.from, addDays(record.from, record.days - 1), ARCHIVE_MAX_DAYS).map((window) => feedsFor(spans, window.from, window.days));
    if (windows.every((asks) => asks.length === 0)) continue;
    const detail = await recordFetch(deps.pool, "firms-archive", async () => {
      const tally = { detections: 0, glintDropped: 0, offshoreDropped: 0, fixedDropped: 0, unconfirmedDropped: 0, cellDays: 0 };
      for (const asks of windows) {
        const detections: Detection[] = [];
        for (const ask of asks) detections.push(...(await deps.archive.detections(ask.satellite, ask.from, ask.days, ask.labelled)));
        const screened = burningCells(detections, mask);
        await fires.upsertMany(deps.pool, screened.cells, { rescreen: true });
        tally.detections += detections.length;
        tally.glintDropped += screened.glint;
        tally.offshoreDropped += screened.offshore;
        tally.fixedDropped += screened.fixed;
        tally.unconfirmedDropped += screened.unconfirmed;
        tally.cellDays += screened.cells.length;
      }
      return { feed: "fires", screen, area: ARCHIVE_AREA, sites: sites.length, from: record.from, days: record.days, ...tally };
    });
    log.info(detail, "fire history stored");
  }
}
