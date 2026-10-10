import { z } from "zod";

/**
 * The sources contract, mirrored by hand from backend/src/contracts.sources.ts.
 * Change one, change the other in the same commit: every response is parsed
 * against these, so a drift fails at the boundary naming the field.
 */

export const FetchDetail = z.record(z.string(), z.union([z.number(), z.string()]));
export type FetchDetail = z.infer<typeof FetchDetail>;

export const SourceFetch = z.object({
  id: z.number().int(),
  source: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  ok: z.boolean(),
  detail: FetchDetail,
  error: z.string().nullable(),
});
export type SourceFetch = z.infer<typeof SourceFetch>;

export const SourceStatus = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  what: z.string(),
  endpoint: z.string(),
  link: z.string(),
  cadence: z.string(),
  everyHours: z.number().int().nullable(),
  tracked: z.boolean(),
  lastSuccess: SourceFetch.nullable(),
  lastFailure: SourceFetch.nullable(),
  day: z.object({ ok: z.number().int(), failed: z.number().int() }),
});
export type SourceStatus = z.infer<typeof SourceStatus>;

export const SourceReport = z.object({ sources: z.array(SourceStatus), recent: z.array(SourceFetch) });
export type SourceReport = z.infer<typeof SourceReport>;
