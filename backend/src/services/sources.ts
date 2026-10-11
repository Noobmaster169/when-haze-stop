import type { Pool } from "pg";

import type { SourceFetchPage, SourceReport } from "../contracts";
import { sourceFetches } from "../repositories";
import { SOURCE_CATALOG } from "../sources/catalog";

const DAY_MS = 86_400_000;
/** Five rows keep the history readable at a glance; older ones are a page away. */
export const FETCH_PAGE_SIZE = 5;

/** Each source as the catalog describes it, with its newest success and failure and its last day of fetches. */
export async function sourceReport(pool: Pool, now: Date = new Date()): Promise<SourceReport> {
  const since = new Date(now.getTime() - DAY_MS);
  const [latest, counts, marks] = await Promise.all([sourceFetches.latest(pool), sourceFetches.countsSince(pool, since), sourceFetches.marksSince(pool, since)]);
  const sources = SOURCE_CATALOG.map((entry) => ({
    ...entry,
    lastSuccess: latest.find((fetch) => fetch.source === entry.id && fetch.ok) ?? null,
    lastFailure: latest.find((fetch) => fetch.source === entry.id && !fetch.ok) ?? null,
    day: counts.get(entry.id) ?? { ok: 0, failed: 0 },
    marks: marks.filter((mark) => mark.source === entry.id).map((mark) => ({ at: mark.at.toISOString(), ok: mark.ok })),
  }));
  return { sources };
}

export async function sourceFetchPage(pool: Pool, source: string, page: number): Promise<SourceFetchPage> {
  const [fetches, total] = await Promise.all([
    sourceFetches.page(pool, source, FETCH_PAGE_SIZE, (page - 1) * FETCH_PAGE_SIZE),
    sourceFetches.count(pool, source),
  ]);
  return { fetches, page, pageSize: FETCH_PAGE_SIZE, total };
}
