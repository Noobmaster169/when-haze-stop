import { addHours, hoursBetween } from "../haze/grid";
import { childLogger } from "../lib/logger";
import { forecasts, readings } from "../repositories";
import { evaluateAlerts } from "./alerts";
import { runForecast } from "./forecast";
import { type IngestDeps, ingestFires, ingestReadings, ingestWeather } from "./ingest";
import { ingestMetars, ingestSingapore } from "./ingest-context";

/**
 * One turn of the crank: fetch, run the model on the newest reading, raise
 * alerts. A source that fails is logged and stepped past, because a model run
 * on an hour-old wind is worth more than no run at all.
 */

const log = childLogger({ module: "jobs.cycle" });

async function attempt(what: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    log.error({ what, err: error instanceof Error ? error.message : String(error) }, "a step of the cycle failed");
  }
}

export interface CycleOptions {
  /** The fire files are large and change a few times a day, so the loop skips them on most hours. */
  fires: boolean;
}

export async function runCycle(deps: IngestDeps, now: Date, options: CycleOptions): Promise<void> {
  await attempt("readings", () => ingestReadings(deps, now));
  if (options.fires) await attempt("fires", () => ingestFires(deps));
  await attempt("weather", () => ingestWeather(deps));
  await attempt("metar", () => ingestMetars(deps));
  await attempt("nea", () => ingestSingapore(deps, now));

  // The run starts from DOE's newest hour: its 68 stations are the forecast's subject, and NEA can post a few minutes ahead.
  const asOf = await readings.newestAt(deps.pool, "doe");
  if (!asOf) {
    log.warn("no readings stored, so there is no hour to forecast from");
    return;
  }
  await attempt("forecast", () => runForecast(deps.pool, asOf, "live"));
  await attempt("alerts", () => evaluateAlerts(deps.pool));
}

const BACKFILL_EVERY_HOURS = 6;
/**
 * A run draws the map from 24 hours before its own hour and pulls each frame
 * to the readings of that hour. One day after the first reading is therefore
 * the earliest run whose every frame has readings under it, and it has a day
 * of them to fit smoke against. The smoke's own spin-up comes from the fires
 * and wind stored for the months before, not from waiting here.
 */
const BACKFILL_MARGIN_HOURS = 24;

/**
 * Replays the model at earlier hours, each run seeing only what was known
 * then, so the accuracy page has checked forecasts on its first day instead of
 * its fourth. The wind for those hours is the analysis, not what was forecast
 * at the time, so these runs flatter the model a little.
 */
export async function backfill(deps: IngestDeps): Promise<number> {
  const oldest = await readings.oldestAt(deps.pool);
  const newest = await readings.newestAt(deps.pool, "doe");
  if (!oldest || !newest) return 0;

  let made = 0;
  const span = hoursBetween(oldest, newest);
  for (let hour = BACKFILL_MARGIN_HOURS; hour < span; hour += BACKFILL_EVERY_HOURS) {
    const asOf = addHours(oldest, hour);
    if (await forecasts.exists(deps.pool, asOf, "live")) continue;
    if ((await runForecast(deps.pool, asOf, "backfill")) !== null) made += 1;
  }
  log.info({ made }, "backfill finished");
  return made;
}
