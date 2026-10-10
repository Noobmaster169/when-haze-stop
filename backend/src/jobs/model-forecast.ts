import type { Pool } from "pg";

import { childLogger } from "../lib/logger";
import { modelForecasts } from "../repositories";
import { listInstruments } from "../services/instruments";
import type { ModelClient } from "../sources";
import { recordFetch } from "./record-fetch";

/**
 * Ask the model service for its forecast as of the run's hour and keep it.
 * In shadow mode this is all that happens to it: the Simulation page scores
 * the rows as their days come in. In live mode the outlook reads them too.
 */

const log = childLogger({ module: "jobs.model-forecast" });

/** Every id a forecast may name, under the one id scheme the instrument list defines. */
async function knownInstruments(pool: Pool): Promise<Set<string>> {
  return new Set((await listInstruments(pool)).map((instrument) => instrument.id));
}

/** Returns how many rows were new. A forecast for an instrument nothing stored is dropped and counted, not an error. */
export async function runModelForecast(pool: Pool, model: ModelClient, asOf: Date): Promise<number> {
  const detail = await recordFetch(pool, "model", async () => {
    const forecasts = await model.predict(asOf);
    const known = await knownInstruments(pool);
    const rows = forecasts.filter((forecast) => known.has(forecast.instrumentId)).map((forecast) => ({ asOf, ...forecast }));
    const added = await modelForecasts.insertMany(pool, rows);
    return {
      asOf: asOf.toISOString(),
      modelVersion: forecasts[0]?.modelVersion ?? "none",
      received: forecasts.length,
      unknownInstruments: forecasts.length - rows.length,
      added,
    };
  });
  log.info(detail, "model forecasts stored");
  return detail.added;
}
