import type { Pool } from "pg";

import type { SourceReport } from "../contracts";
import { sourceFetches } from "../repositories";
import { SOURCE_CATALOG } from "../sources/catalog";

/** Enough rows to cover the last few hourly cycles of every source. */
const RECENT_LIMIT = 60;
const DAY_MS = 86_400_000;

/** Each source as the catalog describes it, with its newest success, newest failure and the last day's tally. */
export async function sourceReport(pool: Pool, now: Date = new Date()): Promise<SourceReport> {
  const [latest, counts, recent] = await Promise.all([
    sourceFetches.latest(pool),
    sourceFetches.countsSince(pool, new Date(now.getTime() - DAY_MS)),
    sourceFetches.recent(pool, RECENT_LIMIT),
  ]);
  const sources = SOURCE_CATALOG.map((entry) => ({
    ...entry,
    lastSuccess: latest.find((fetch) => fetch.source === entry.id && fetch.ok) ?? null,
    lastFailure: latest.find((fetch) => fetch.source === entry.id && !fetch.ok) ?? null,
    day: counts.get(entry.id) ?? { ok: 0, failed: 0 },
  }));
  return { sources, recent };
}
