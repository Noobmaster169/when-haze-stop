import { z } from "zod";

import { ForecastSource, StationOutlook } from "./haze-schemas";
import { ModelSkill } from "./simulation-schemas";

/** Mirror of backend/src/contracts.model.ts. Change one, change the other in the same commit. */

export const ModelLedgerRow = z.object({
  asOf: z.string(),
  stationId: z.string(),
  stationName: z.string(),
  day: z.string(),
  leadDays: z.number().int(),
  forecast: z.number().int(),
  low: z.number().int(),
  high: z.number().int(),
  observed: z.number().int(),
  miss: z.number(),
  persistenceMiss: z.number().nullable(),
  v2Miss: z.number().nullable(),
});
export type ModelLedgerRow = z.infer<typeof ModelLedgerRow>;

export const ModelLive = z.object({
  source: ForecastSource,
  skill: ModelSkill,
  nextCheckAt: z.string().nullable(),
  watch: z.array(StationOutlook),
  ledger: z.array(ModelLedgerRow),
});
export type ModelLive = z.infer<typeof ModelLive>;
