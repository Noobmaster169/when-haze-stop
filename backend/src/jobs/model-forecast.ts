import type { Pool } from "pg";

import { childLogger } from "../lib/logger";
import { modelForecasts } from "../repositories";
import { listInstruments } from "../services/instruments";
import type { ModelClient } from "../sources";
import { recordFetch } from "./record-fetch";

/**
 * Ask the model service for its forecast at the day's issue time and keep it.
 * In shadow mode this is all that happens to it: the Simulation page scores
 * the rows as their days come in. In live mode the outlook reads them too.
 */

const log = childLogger({ module: "jobs.model-forecast" });

/**
 * The newest 00:00 UTC at or before the run's hour. The model is trained and
 * backtested at that issue time alone, so any other hour would be off its
 * distribution and without the physics features built for it.
 */
export function issueTime(asOf: Date): Date {
  return new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
}

/** Every id a forecast may name, under the one id scheme the instrument list defines. */
async function knownInstruments(pool: Pool): Promise<Set<string>> {
  return new Set((await listInstruments(pool)).map((instrument) => instrument.id));
}

/**
 * Returns how many rows were new. The cycle calls this every hour; the service
 * is asked only while the issue has no rows from its current version, so a
 * failed ask is retried the next hour and a stored one is never asked again.
 * A forecast for an instrument nothing stored is dropped and counted, not an error.
 */
export async function runModelForecast(pool: Pool, model: ModelClient, asOf: Date): Promise<number> {
  const issue = issueTime(asOf);
  const { modelVersion } = await model.health();
  if (modelVersion && (await modelForecasts.hasIssue(pool, issue, modelVersion))) {
    log.info({ issue: issue.toISOString(), modelVersion }, "model forecast for this issue already stored");
    return 0;
  }
  const detail = await recordFetch(pool, "model", async () => {
    const forecasts = await model.predict(issue);
    const known = await knownInstruments(pool);
    const rows = forecasts.filter((forecast) => known.has(forecast.instrumentId)).map((forecast) => ({ asOf: issue, ...forecast }));
    const added = await modelForecasts.insertMany(pool, rows);
    return {
      asOf: issue.toISOString(),
      modelVersion: forecasts[0]?.modelVersion ?? "none",
      received: forecasts.length,
      unknownInstruments: forecasts.length - rows.length,
      added,
    };
  });
  log.info(detail, "model forecasts stored");
  return detail.added;
}
