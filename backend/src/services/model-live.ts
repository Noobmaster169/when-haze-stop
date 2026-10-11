import type { ModelMode } from "../config";
import type { ModelLedgerRow, ModelLive, Station, StationOutlook } from "../contracts";
import type { Queryable } from "../db";
import { apiToPm25, pm25ToApi } from "../haze/api-index";
import { blendDay } from "../haze/blend";
import { addHours, GRID_KEY } from "../haze/grid";
import { localDay } from "../haze/outlook";
import { MODEL_VERSION } from "../haze/run";
import { modelForecasts, modelScores, stations } from "../repositories";
import type { ScoreRow } from "../repositories/model-scores.repo";
import type { ModelClient } from "../sources/model";
import { hourlySource, LEARNED_STALE_HOURS } from "./forecast-source";
import { modelSkill } from "./model-skill";
import { outlookContext, outlookFor, type OutlookContext } from "./outlook";

/**
 * The learned model's live record for the Model page: whose forecast is
 * showing, how it scores, the stations it expects to be worst tomorrow, and
 * every scored forecast as a row. Everything is read fresh on each visit; the
 * backtest figure inside `source` is the one memoised read.
 */

const WATCHED = 6;
/** The end of a Malaysian day in UTC: the hour a reading on the next day can first come in and score it. */
const DAY_END_UTC = "T16:00:00.000Z";

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * DOE stations alone, like the shadow rule: Singapore's readings are PSI,
 * whose bands differ from DOE's index, so a row of theirs would compare units.
 */
function ledgerRow(row: ScoreRow, observed: number, byId: Map<string, Station>): ModelLedgerRow {
  return {
    asOf: row.asOf.toISOString(),
    stationId: row.instrumentId,
    stationName: byId.get(row.instrumentId)?.name ?? row.instrumentId,
    day: row.day,
    leadDays: row.leadDays,
    forecast: Math.round(pm25ToApi(row.p50)),
    low: Math.round(pm25ToApi(row.p10)),
    high: Math.round(pm25ToApi(row.p90)),
    observed,
    miss: round2(Math.abs(pm25ToApi(row.p50) - observed)),
    // The blend shown to a person: the model's median averaged with the hourly run's peak for the day, scored like the rest.
    blendMiss: row.v2 === null ? null : round2(Math.abs(pm25ToApi(blendDay(row, apiToPm25(row.v2)).p50) - observed)),
    persistenceMiss: row.persistence === null ? null : round2(Math.abs(row.persistence - observed)),
    v2Miss: row.v2 === null ? null : round2(Math.abs(row.v2 - observed)),
  };
}

/** Newest issue first, then by station name so one issue reads as a block, then by day. */
async function ledger(db: Queryable, version: string | null, byId: Map<string, Station>): Promise<ModelLedgerRow[]> {
  if (!version) return [];
  const rows = await modelScores.scorable(db, version, MODEL_VERSION, GRID_KEY);
  return rows
    .flatMap((row) => (row.network === "doe" && row.observed !== null ? [ledgerRow(row, row.observed, byId)] : []))
    .sort((a, b) => b.asOf.localeCompare(a.asOf) || a.stationName.localeCompare(b.stationName) || a.day.localeCompare(b.day));
}

/**
 * The six DOE stations the newest fresh issue puts highest tomorrow, then the
 * followed ones, each once and only if it exists. Tomorrow is the Malaysian
 * day after the run's hour, which is the issue's first forecast day.
 */
async function watched(db: Queryable, context: OutlookContext, follow: string[], byId: Map<string, Station>): Promise<Station[]> {
  const issue = await modelForecasts.latestIssue(db, addHours(context.asOf, -LEARNED_STALE_HOURS));
  const tomorrow = localDay(addHours(context.asOf, 24));
  const worst = issue
    ? [...issue.byInstrument.entries()]
        .flatMap(([id, days]) => {
          const station = byId.get(id);
          const day = days.get(tomorrow);
          return station?.network === "doe" && day ? [{ id, p50: day.p50 }] : [];
        })
        .sort((a, b) => b.p50 - a.p50)
        .slice(0, WATCHED)
        .map((entry) => entry.id)
    : [];
  const ids = [...new Set([...worst, ...follow])];
  return ids.flatMap((id) => {
    const station = byId.get(id);
    return station ? [station] : [];
  });
}

async function nextCheckAt(db: Queryable, version: string | null): Promise<string | null> {
  if (!version) return null;
  const day = await modelScores.pendingDay(db, version);
  return day ? `${day}${DAY_END_UTC}` : null;
}

/** `follow` is the stations the browser follows; an id that is no station is dropped, not an error. */
export async function modelLive(db: Queryable, mode: ModelMode, model: ModelClient | null, follow: string[]): Promise<ModelLive> {
  const [context, skill, newest, all] = await Promise.all([outlookContext(db, mode, model), modelSkill(db, mode), modelForecasts.newestVersion(db), stations.list(db)]);
  const byId = new Map(all.map((station) => [station.id, station]));
  const version = newest?.modelVersion ?? null;
  const watch: StationOutlook[] = context ? await Promise.all((await watched(db, context, follow, byId)).map((station) => outlookFor(db, station, context))) : [];
  return {
    source: context?.source ?? hourlySource(),
    skill,
    nextCheckAt: await nextCheckAt(db, version),
    watch,
    ledger: await ledger(db, version, byId),
  };
}
