import type { Pool } from "pg";

import { addHours, hoursBetween } from "../haze/grid";
import { LINES } from "../haze/guidelines";
import { runModel } from "../haze/run";
import { type IssuedForecast, type LeadRow, scoreByLead } from "../haze/score";
import { childLogger } from "../lib/logger";
import { readings } from "../repositories";
import { loadRunInput } from "./forecast";

/**
 * The backtest: replay the model at past hours over the stored readings and
 * score it against "no change" on exactly the same cases. Nothing is written.
 *
 * Each run loads through `loadRunInput`, the same door the live run uses, so it
 * sees only the readings and fire days known at its hour. The one thing it
 * cannot hold back is the weather: `weather_hours` keeps the newest fetch of an
 * hour, so a past run's future wind is the analysis, not the forecast it would
 * have had. `docs/FORECAST.md` measures what that is worth.
 */

const log = childLogger({ module: "jobs.evaluate" });

const LEADS = [1, 3, 6, 12, 24, 48, 72];
/** The model needs this long behind a run before its smoke is all in the air and it can calibrate. */
const SPIN_UP_HOURS = 72;

export interface EvaluateOptions {
  everyHours: number;
  /** Score only runs from this instant on, for a period the settings were not chosen on. */
  from?: Date;
}

export async function evaluate(pool: Pool, options: EvaluateOptions): Promise<LeadRow[]> {
  const oldest = await readings.oldestAt(pool);
  const newest = await readings.newestAt(pool);
  if (!oldest || !newest) return [];

  const issued: IssuedForecast[] = [];
  const first = options.from && options.from > addHours(oldest, SPIN_UP_HOURS) ? options.from : addHours(oldest, SPIN_UP_HOURS);
  for (let asOf = first; asOf < newest; asOf = addHours(asOf, options.everyHours)) {
    const input = await loadRunInput(pool, asOf);
    if (!input) continue;
    const output = runModel(input);
    const now = hoursBetween(input.start, asOf);
    for (const forecast of output.forecasts) {
      const station = input.stations.find((item) => item.id === forecast.stationId);
      const carried = station?.readings[now];
      // "No change" needs a reading at the hour itself, so a late station is left out of both columns.
      if (carried === undefined || Number.isNaN(carried)) continue;
      issued.push({ asOf, stationId: forecast.stationId, api: forecast.api, carried });
    }
    log.info({ asOf: asOf.toISOString(), stations: output.forecasts.length, fit: output.calibration.rankCorrelation }, "replayed");
  }

  const truth = new Map<string, number>();
  for (const reading of await readings.between(pool, oldest, newest)) truth.set(`${reading.stationId}|${reading.observedAt.getTime()}`, reading.api);
  return scoreByLead(issued, (stationId, at) => truth.get(`${stationId}|${at.getTime()}`) ?? null, LEADS, LINES);
}

export function formatScores(rows: LeadRow[]): string {
  const lines = ["lead  cases   model  no change  change  bias  same side of 100/150/180/200 (model | no change)"];
  for (const row of rows) {
    if (row.cases === 0) continue;
    const change = row.persistence === 0 ? 0 : (100 * (row.model - row.persistence)) / row.persistence;
    const sides = LINES.map((line) => `${Math.round(100 * row.lineAgreement[line])}`).join("/");
    const sidesCarried = LINES.map((line) => `${Math.round(100 * row.persistenceLineAgreement[line])}`).join("/");
    lines.push(
      `${String(row.lead).padStart(4)}  ${String(row.cases).padStart(5)}  ${row.model.toFixed(2).padStart(6)}  ${row.persistence.toFixed(2).padStart(9)}  ${`${change.toFixed(0)}%`.padStart(6)}  ${row.bias.toFixed(1).padStart(4)}  ${sides} | ${sidesCarried}`,
    );
  }
  return lines.join("\n");
}
