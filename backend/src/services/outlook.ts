import { config, type ModelMode } from "../config";
import type { Station, StationOutlook } from "../contracts";
import type { Queryable } from "../db";
import { firstHindcast, leadBucket } from "../haze/chance";
import { addHours } from "../haze/grid";
import { dayOutlooks, type ErrorsFor, type Hourly, type ModelDay } from "../haze/outlook";
import { forecasts, modelForecasts, nea, readings, scores, stations } from "../repositories";
import { neaRegionOf } from "../sources/nea";

/**
 * A station's readings, forecast and next few days, read from what the last
 * run stored. The map, the alerts and the assistant all ask here, so they can
 * never disagree about a station.
 */

const HISTORY_DAYS = 7;
/** Below this many checked forecasts a lead's own error spread is too thin to trust over the first hindcast's. */
const ENOUGH_CASES = 300;

/** The error spread to use for a lead: this project's own once it has enough checked forecasts, the first hindcast's until then. */
export async function loadErrors(db: Queryable): Promise<ErrorsFor> {
  const buckets = await scores.errorQuantiles(db);
  return (leadHours, hazy) => {
    const own = buckets.find((bucket) => bucket.lead === leadBucket(leadHours) && bucket.hazy === hazy);
    return own && own.cases >= ENOUGH_CASES ? own.quantiles : firstHindcast(leadHours, hazy);
  };
}

/**
 * A learned forecast older than this against the run is stale, and the hourly
 * forecast speaks instead. The model issues once a day at 00:00 UTC, so its
 * newest forecast is up to 23 hours old by design. When the day's ask fails,
 * yesterday's issue keeps the outlook until 06:00 UTC while the job retries
 * each hour, so one missed hour does not drop the model's days.
 */
export const LEARNED_STALE_HOURS = 30;

export interface OutlookContext {
  asOf: Date;
  runId: number;
  errorsFor: ErrorsFor;
  /** Whether the learned model's forecast is the outlook's for the days ahead: MODEL_MODE is live. */
  learned: boolean;
}

/** Null before the model has run once. `mode` is the config's unless a test says otherwise. */
export async function outlookContext(db: Queryable, mode: ModelMode = config.MODEL_MODE): Promise<OutlookContext | null> {
  const run = await forecasts.latest(db);
  if (!run) return null;
  return { asOf: new Date(run.asOf), runId: run.id, errorsFor: await loadErrors(db), learned: mode === "live" };
}

/** The newest learned forecast for a station, empty where there is none or it is stale. */
async function learnedDays(db: Queryable, stationId: string, asOf: Date): Promise<Map<string, ModelDay>> {
  const stored = await modelForecasts.latestFor(db, stationId);
  if (!stored || stored.asOf < addHours(asOf, -LEARNED_STALE_HOURS)) return new Map();
  return stored.days;
}

export async function outlookFor(db: Queryable, station: Station, context: OutlookContext, forecastApi?: number[] | null): Promise<StationOutlook> {
  const { asOf, runId, errorsFor } = context;
  const stored = await readings.forStation(db, station.id, addHours(asOf, -24 * HISTORY_DAYS), asOf);
  const api = forecastApi === undefined ? await forecasts.stationForecast(db, runId, station.id) : forecastApi;
  const observed: Hourly[] = stored.map((reading) => ({ at: reading.observedAt, api: reading.api }));
  const ahead: Hourly[] = (api ?? []).map((value, index) => ({ at: addHours(asOf, index + 1), api: value }));
  const modelDays = context.learned ? await learnedDays(db, station.id, asOf) : new Map<string, ModelDay>();
  return {
    station,
    readings: observed.map((reading) => ({ at: reading.at.toISOString(), api: reading.api })),
    forecast: ahead.map((value) => ({ at: value.at.toISOString(), api: Math.round(value.api) })),
    days: dayOutlooks(asOf, observed, ahead, errorsFor, modelDays),
    pm25: await measuredPm25(db, station),
  };
}

/** NEA measures PM2.5 hour by hour in each region; nothing of the kind exists for a DOE station. */
async function measuredPm25(db: Queryable, station: Station): Promise<StationOutlook["pm25"]> {
  const region = station.network === "nea" ? neaRegionOf(station.id) : null;
  if (!region) return null;
  const latest = await nea.latestPm25(db, region);
  return latest ? { at: latest.at.toISOString(), value: latest.value } : null;
}

/** Null for a station that does not exist. A station with no forecast still answers, with its readings alone. */
export async function stationOutlook(db: Queryable, stationId: string): Promise<StationOutlook | null> {
  const station = await stations.find(db, stationId);
  if (!station) return null;
  const context = await outlookContext(db);
  if (!context) return { station, readings: [], forecast: [], days: [], pm25: await measuredPm25(db, station) };
  return outlookFor(db, station, context);
}
