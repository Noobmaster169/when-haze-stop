import type { ModelLeadSkill, ModelMode, ModelSkill, Network } from "../contracts";
import type { Queryable } from "../db";
import { pm25ToApi } from "../haze/api-index";
import { GRID_KEY } from "../haze/grid";
import { MODEL_VERSION } from "../haze/run";
import { modelForecasts, modelScores } from "../repositories";
import type { ScoreRow } from "../repositories/model-scores.repo";

/**
 * The learned model scored on what came in, beside "no change" and the hourly
 * forecast, and the shadow rule: it may become the outlook only after enough
 * days of forecasts for DOE stations with a day-ahead error clearly below the
 * hourly forecast's. The rule is here, not in a person's head.
 */

export const SHADOW_DAYS = 14;
export const SHADOW_GAIN = 0.1;
/**
 * DOE alone. Singapore's rows in `readings` are PSI, whose PM2.5 bands differ
 * from DOE's (55 ug/m3 is PSI 100 but about API 150), so scoring them against
 * the model's PM2.5 turned into DOE's index would mix units.
 */
const NETWORKS: Network[] = ["doe"];
const LEADS = [1, 2];

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Unrounded, so the shadow gate never compares a figure that was rounded in its favour. */
function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mean(values: number[]): number | null {
  const value = average(values);
  return value === null ? null : round2(value);
}

/** The model is scored on every case; each baseline on the cases where it had a value, which live is nearly all of them. */
function leadSkill(rows: ScoreRow[], network: Network, leadDays: number): ModelLeadSkill {
  const cases = rows.filter((row) => row.network === network && row.leadDays === leadDays && row.observed !== null);
  const observed = (row: ScoreRow): number => row.observed ?? 0;
  const withReading = cases.filter((row) => row.persistence !== null);
  const withRun = cases.filter((row) => row.v2 !== null);
  return {
    network,
    leadDays,
    cases: cases.length,
    model: mean(cases.map((row) => Math.abs(pm25ToApi(row.p50) - observed(row)))),
    persistence: mean(withReading.map((row) => Math.abs((row.persistence ?? 0) - observed(row)))),
    persistenceCases: withReading.length,
    v2: mean(withRun.map((row) => Math.abs((row.v2 ?? 0) - observed(row)))),
    v2Cases: withRun.length,
  };
}

/** With the model off, rows from an earlier shadow period are not shown: the page says nothing comes from a learned model. */
function offSkill(): ModelSkill {
  return { mode: "off", modelVersion: null, since: null, shadowDays: 0, shadowDaysRequired: SHADOW_DAYS, cases: 0, comparedCases: 0, gain: null, gainRequired: SHADOW_GAIN, passed: false, leads: [] };
}

/** Only current-grid, current-model hourly runs enter the comparison. `version` is the newest stored unless a test names one. */
export async function modelSkill(db: Queryable, mode: ModelMode, version?: string): Promise<ModelSkill> {
  if (mode === "off") return offSkill();
  const newest = await modelForecasts.newestVersion(db);
  const modelVersion = version ?? newest?.modelVersion ?? null;
  const rows = modelVersion ? await modelScores.scorable(db, modelVersion, MODEL_VERSION, GRID_KEY) : [];
  const leads = NETWORKS.flatMap((network) => LEADS.map((leadDays) => leadSkill(rows, network, leadDays)));

  const dayAhead = leads[0];
  const doeDayAhead = rows.filter((row) => row.network === "doe" && row.leadDays === 1 && row.observed !== null);
  const shadowDays = new Set(doeDayAhead.map((row) => row.asOf.toISOString().slice(0, 10))).size;
  // The rule is "better on identical cases", so the gate scores only cases where the hourly run also had a value.
  const compared = doeDayAhead.filter((row) => row.v2 !== null);
  const modelError = average(compared.map((row) => Math.abs(pm25ToApi(row.p50) - (row.observed ?? 0))));
  const v2Error = average(compared.map((row) => Math.abs((row.v2 ?? 0) - (row.observed ?? 0))));
  const rawGain = modelError !== null && v2Error !== null && v2Error > 0 ? 1 - modelError / v2Error : null;
  const since = modelVersion && newest?.modelVersion === modelVersion ? newest.since.toISOString() : null;
  return {
    mode,
    modelVersion,
    since,
    shadowDays,
    shadowDaysRequired: SHADOW_DAYS,
    cases: dayAhead.cases,
    comparedCases: compared.length,
    gain: rawGain === null ? null : round2(rawGain),
    gainRequired: SHADOW_GAIN,
    passed: shadowDays >= SHADOW_DAYS && rawGain !== null && rawGain >= SHADOW_GAIN,
    leads,
  };
}
