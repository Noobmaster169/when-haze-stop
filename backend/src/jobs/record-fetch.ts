import type { Pool } from "pg";

import type { FetchDetail } from "../contracts";
import { sourceFetches } from "../repositories";
import type { SourceId } from "../sources/catalog";

/**
 * Runs one fetch of a source and keeps a row saying when, how long, and what
 * came back or why it did not. A failure is recorded and then thrown on, so
 * the cycle still logs it and steps past.
 */
export async function recordFetch<T extends FetchDetail>(pool: Pool, source: SourceId, work: () => Promise<T>): Promise<T> {
  const startedAt = new Date();
  try {
    const detail = await work();
    await sourceFetches.insert(pool, { source, startedAt, finishedAt: new Date(), ok: true, detail, error: null });
    return detail;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sourceFetches.insert(pool, { source, startedAt, finishedAt: new Date(), ok: false, detail: {}, error: message });
    throw error;
  }
}
