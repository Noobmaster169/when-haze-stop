import type { ModelMode } from "../config";
import type { ForecastSource } from "../contracts";
import type { Queryable } from "../db";
import { addHours } from "../haze/grid";
import { childLogger } from "../lib/logger";
import { modelForecasts } from "../repositories";
import type { ModelClient, ModelReport } from "../sources/model";
import { modelSkill } from "./model-skill";

/**
 * Whose forecast a person is looking at, with the model's record beside it.
 * The map, every station panel and every assistant tool ask for this, so the
 * backtest figure, which comes from the model service, is remembered for a
 * few minutes; the live record is read from the database each time.
 */

const log = childLogger({ module: "forecast-source" });

/**
 * A learned forecast older than this against the run is stale, and the hourly
 * forecast speaks instead. The model issues once a day at 00:00 UTC, so its
 * newest forecast is up to 23 hours old by design. When the day's ask fails,
 * yesterday's issue keeps the outlook until 06:00 UTC while the job retries
 * each hour, so one missed hour does not drop the model's days.
 */
export const LEARNED_STALE_HOURS = 30;

const REPORT_TTL_MS = 5 * 60_000;

let remembered: { report: ModelReport | null; until: number } | null = null;

/** Null when the service cannot answer: a forecast without its backtest figure is still a forecast. */
async function publishedReport(model: ModelClient | null): Promise<ModelReport | null> {
  if (!model) return null;
  if (remembered && remembered.until > Date.now()) return remembered.report;
  let report: ModelReport | null = null;
  try {
    report = await model.report();
  } catch (error) {
    log.warn({ err: error instanceof Error ? error.message : String(error) }, "the model service could not give its report");
  }
  remembered = { report, until: Date.now() + REPORT_TTL_MS };
  return report;
}

/** Tests that change the fake's report between asks call this; nothing else should. */
export function forgetReport(): void {
  remembered = null;
}

/** The hourly forecast's source line: the one every mode other than live, and a live mode without a fresh issue, falls back to. */
export function hourlySource(): ForecastSource {
  return { kind: "hourly", modelVersion: null, issuedAt: null, trial: false, record: { checkedDays: 0, gain: null, backtest: null } };
}

/**
 * `runAsOf` is the hour of the run the forecast hangs on; an issue older than
 * LEARNED_STALE_HOURS before it is not the forecast shown. Null before any run.
 */
export async function forecastSource(db: Queryable, mode: ModelMode, model: ModelClient | null, runAsOf: Date | null): Promise<ForecastSource> {
  if (mode !== "live" || !runAsOf) return hourlySource();
  const issue = await modelForecasts.latestIssue(db, addHours(runAsOf, -LEARNED_STALE_HOURS));
  if (!issue) return hourlySource();
  const [skill, report] = await Promise.all([modelSkill(db, mode, issue.modelVersion), publishedReport(model)]);
  const backtest = report?.version === issue.modelVersion ? report.hazyMae.d1 : null;
  return {
    kind: "learned",
    modelVersion: issue.modelVersion,
    issuedAt: issue.asOf.toISOString(),
    trial: !skill.passed,
    record: { checkedDays: skill.shadowDays, gain: skill.gain, backtest },
  };
}
