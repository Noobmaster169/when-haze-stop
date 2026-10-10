import type { ModelLeadSkill, ModelMode, ModelSkill, Network } from "../contracts";
import type { Queryable } from "../db";
import { pm25ToApi } from "../haze/api-index";
import { GRID_KEY } from "../haze/grid";
import { MODEL_VERSION } from "../haze/run";
import { modelForecasts } from "../repositories";
import type { ScoreRow } from "../repositories/model-forecasts.repo";

/**
 * The learned model scored on what came in, beside "no change" and the hourly
 * forecast, and the shadow rule: it may become the outlook only after enough
 * days of forecasts for DOE stations with a day-ahead error clearly below the
 * hourly forecast's. The rule is here, not in a person's head.
 */

export const SHADOW_DAYS = 14;
export const SHADOW_GAIN = 0.1;
const NETWORKS: Network[] = ["doe", "nea"];
const LEADS = [1, 2];

function mean(values: number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
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

/** Only current-grid, current-model hourly runs enter the comparison. `version` is the newest stored unless a test names one. */
export async function modelSkill(db: Queryable, mode: ModelMode, version?: string): Promise<ModelSkill> {
  const newest = await modelForecasts.newestVersion(db);
  const modelVersion = version ?? newest?.modelVersion ?? null;
  const rows = modelVersion ? (await modelForecasts.scorable(db, MODEL_VERSION, GRID_KEY)).filter((row) => row.modelVersion === modelVersion) : [];
  const leads = NETWORKS.flatMap((network) => LEADS.map((leadDays) => leadSkill(rows, network, leadDays)));

  const dayAhead = leads[0];
  const shadowDays = new Set(rows.filter((row) => row.network === "doe" && row.leadDays === 1 && row.observed !== null).map((row) => row.asOf.toISOString().slice(0, 10))).size;
  const gain = dayAhead.model !== null && dayAhead.v2 !== null && dayAhead.v2 > 0 ? Math.round((1 - dayAhead.model / dayAhead.v2) * 100) / 100 : null;
  const since = modelVersion && newest?.modelVersion === modelVersion ? newest.since.toISOString() : null;
  return {
    mode,
    modelVersion,
    since,
    shadowDays,
    shadowDaysRequired: SHADOW_DAYS,
    gain,
    gainRequired: SHADOW_GAIN,
    passed: shadowDays >= SHADOW_DAYS && gain !== null && gain >= SHADOW_GAIN,
    leads,
  };
}
