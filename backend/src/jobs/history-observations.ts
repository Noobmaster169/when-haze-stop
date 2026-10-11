import type { Pool } from "pg";

import type { FetchDetail } from "../contracts";
import { childLogger } from "../lib/logger";
import { metar, nea, sourceFetches } from "../repositories";
import type { NeaClient } from "../sources";
import type { SourceId } from "../sources/catalog";
import type { MetarArchiveClient } from "../sources/metar-archive";
import { addDays, dayOf, spansOf } from "./days";
import { RECORD_DAYS, SETTLED_AFTER_DAYS } from "./history-fires";
import { recordFetch } from "./record-fetch";

/**
 * What was measured before the app first ran: airport visibility from the
 * METAR archive, and Singapore's hourly PM2.5 from NEA, which serves any past
 * day. Both only add rows, and both pick up where a stopped run left off.
 */

const log = childLogger({ module: "jobs.history-observations" });

/** One request to the METAR archive: ten days of every airport is a file of a few megabytes. */
const METAR_DAYS = 10;
const SINGAPORE_OFFSET_MS = 8 * 3_600_000;

/**
 * The 30 day spans from `fromDay` to `today` that still have to be asked for:
 * the ones no good fetch has recorded, and the newest, which is still filling.
 */
async function spansToFetch(pool: Pool, source: SourceId, fromDay: string, today: string): Promise<{ from: string; days: number }[]> {
  const fetched = new Set((await sourceFetches.succeeded(pool, source)).map((detail: FetchDetail) => `${detail.from}|${detail.days}`));
  return spansOf(fromDay, today, RECORD_DAYS).filter((span) => {
    const settled = addDays(span.from, span.days - 1) < addDays(today, -SETTLED_AFTER_DAYS);
    return !settled || !fetched.has(`${span.from}|${span.days}`);
  });
}

/** Stores every listed airport's reports from `fromDay` to today. Returns how many were new. */
export async function ingestMetarHistory(deps: { pool: Pool; metarArchive: MetarArchiveClient }, fromDay: string, now: Date): Promise<number> {
  let stored = 0;
  for (const span of await spansToFetch(deps.pool, "metar-archive", fromDay, dayOf(now))) {
    const detail = await recordFetch(deps.pool, "metar-archive", async () => {
      const airports = new Set<string>();
      let reports = 0;
      let added = 0;
      for (const window of spansOf(span.from, addDays(span.from, span.days - 1), METAR_DAYS)) {
        const found = await deps.metarArchive.reports(window.from, window.days);
        await metar.addAirports(deps.pool, found);
        added += await metar.insertMany(deps.pool, found);
        reports += found.length;
        for (const report of found) airports.add(report.icao);
      }
      return { from: span.from, days: span.days, airports: airports.size, reports, added };
    });
    log.info(detail, "METAR history stored");
    stored += detail.added;
  }
  return stored;
}

/**
 * Stores Singapore's hours from `fromDay` to today, a Singapore day at a
 * time. The past PSI is kept with the PM2.5 in `nea_hours` and not copied to
 * `readings`: a reading is what the forecast is run and scored from, and five
 * stations alone are not a day it can be run on.
 */
export async function ingestNeaHistory(deps: { pool: Pool; nea: NeaClient }, fromDay: string, now: Date): Promise<number> {
  let stored = 0;
  const first = new Date(`${fromDay}T00:00:00Z`);
  const today = dayOf(new Date(now.getTime() + SINGAPORE_OFFSET_MS));
  for (const span of await spansToFetch(deps.pool, "nea-history", fromDay, today)) {
    const detail = await recordFetch(deps.pool, "nea-history", async () => {
      let hours = 0;
      let added = 0;
      for (let offset = 0; offset < span.days; offset++) {
        // A Singapore day starts at 16:00 UTC the day before, and the history starts on a UTC day like the other three kinds of data.
        const found = (await deps.nea.hours(addDays(span.from, offset))).filter((hour) => hour.observedAt > first);
        hours += found.length;
        added += await nea.insertMany(deps.pool, found);
      }
      return { from: span.from, days: span.days, hours, added };
    });
    log.info(detail, "Singapore history stored");
    stored += detail.added;
  }
  return stored;
}
