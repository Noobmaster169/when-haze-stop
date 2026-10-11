import { z } from "zod";

import { ForecastSource, StationOutlook } from "./contracts.haze";
import { ModelSkill } from "./contracts.simulation";

/**
 * The learned model's live record for the Model page: whose forecast is
 * showing, how it is scoring, the stations to watch today, and every scored
 * forecast as a row. Mirrored by hand in frontend/lib/api/model-schemas.ts.
 */

export const ModelLedgerRow = z.object({
  asOf: z.string(),
  stationId: z.string(),
  stationName: z.string(),
  /** The Malaysian day forecast. */
  day: z.string(),
  leadDays: z.number().int(),
  /** The learned median and band, in API. */
  forecast: z.number().int(),
  low: z.number().int(),
  high: z.number().int(),
  /** The day's peak reading. */
  observed: z.number().int(),
  /** Absolute misses in API points; a baseline is null where it had no value. */
  miss: z.number(),
  /** The miss of the blend shown to a person: the model and the hourly run averaged; null where the run had no value. */
  blendMiss: z.number().nullable(),
  persistenceMiss: z.number().nullable(),
  v2Miss: z.number().nullable(),
});
export type ModelLedgerRow = z.infer<typeof ModelLedgerRow>;

export const ModelLive = z.object({
  source: ForecastSource,
  skill: ModelSkill,
  /** When the earliest stored day not yet scored can be scored: the end of that Malaysian day, 16:00 UTC. */
  nextCheckAt: z.string().nullable(),
  /** The stations the model expects to be worst tomorrow, plus any the browser follows. */
  watch: z.array(StationOutlook),
  ledger: z.array(ModelLedgerRow),
});
export type ModelLive = z.infer<typeof ModelLive>;
