import { z } from "zod";

/**
 * Where the data comes from and when it was last fetched.
 *
 * Re-exported from contracts.ts and mirrored by hand as zod schemas in
 * frontend/lib/api/source-schemas.ts. Change one, change the other in the same
 * commit.
 */

/** What a fetch brought back: counts, and a few ISO times or days. */
export const FetchDetail = z.record(z.string(), z.union([z.number(), z.string()]));
export type FetchDetail = z.infer<typeof FetchDetail>;

export const SourceFetch = z.object({
  id: z.number().int(),
  source: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  ok: z.boolean(),
  detail: FetchDetail,
  /** Why it failed, or null when it worked. */
  error: z.string().nullable(),
});
export type SourceFetch = z.infer<typeof SourceFetch>;

export const SourceStatus = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  /** What the app takes from it, in a sentence. */
  what: z.string(),
  endpoint: z.string(),
  /** The provider's own page, for a person. */
  link: z.string(),
  cadence: z.string(),
  /** How often the jobs process asks, or null for a source it does not fetch on a schedule. */
  everyHours: z.number().int().nullable(),
  /** False for a source that is not fetched by the jobs and so has no history here. */
  tracked: z.boolean(),
  lastSuccess: SourceFetch.nullable(),
  lastFailure: SourceFetch.nullable(),
  /** Fetches in the last 24 hours. */
  day: z.object({ ok: z.number().int(), failed: z.number().int() }),
  /** Each fetch started in the last 24 hours, oldest first: when, and whether it worked. */
  marks: z.array(z.object({ at: z.string(), ok: z.boolean() })),
});
export type SourceStatus = z.infer<typeof SourceStatus>;

export const SourceReport = z.object({ sources: z.array(SourceStatus) });
export type SourceReport = z.infer<typeof SourceReport>;

/** One page of a source's fetches, newest first. */
export const SourceFetchPage = z.object({
  fetches: z.array(SourceFetch),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type SourceFetchPage = z.infer<typeof SourceFetchPage>;
