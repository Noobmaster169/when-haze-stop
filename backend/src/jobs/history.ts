import type { Pool } from "pg";

import { TerminalError } from "../lib/errors";
import { childLogger } from "../lib/logger";
import type { FireArchiveClient, NeaClient, WeatherClient } from "../sources";
import type { MetarArchiveClient } from "../sources/metar-archive";
import type { OpenAqClient } from "../sources/openaq";
import { ingestFireHistory, ingestFixedSources } from "./history-fires";
import { ingestMetarHistory, ingestNeaHistory } from "./history-observations";
import { ingestWeatherHistory } from "./history-weather";
import { ingestOpenAqHistory } from "./ingest-openaq";

/**
 * What the hourly cycle cannot reach: the four kinds of data a forecast is
 * trained and checked on, for the months before the app first ran.
 *
 *   fires        the fixed heat sources NASA has labelled, then every day's fires
 *   visibility   airport reports
 *   air          measured PM2.5: Singapore's regions and OpenAQ's sensors
 *   wind         the wind and rain that carried the smoke
 *
 * Run by hand, or by the jobs container on every start. It is safe to run
 * again and to stop half way: every part records what came back and asks only
 * for what is missing. A part that fails is logged and stepped past, so one
 * source being down does not hold up the other three.
 */

const log = childLogger({ module: "jobs.history" });

export const HISTORY_PARTS = ["fires", "visibility", "air", "wind"] as const;
export type HistoryPart = (typeof HISTORY_PARTS)[number];

export interface HistoryDeps {
  pool: Pool;
  /** Null without a FIRMS key: the fires of the past are then whatever the seed loaded. */
  archive: FireArchiveClient | null;
  metarArchive: MetarArchiveClient;
  nea: NeaClient;
  /** Null without an OpenAQ key: Singapore is then the only past PM2.5. */
  openaq: OpenAqClient | null;
  weather: WeatherClient;
}

export interface HistoryOptions {
  /** The first UTC day to fill back to. */
  from: string;
  /** The parts to run, or all four when empty. */
  parts: HistoryPart[];
}

export function isHistoryPart(name: string): name is HistoryPart {
  return (HISTORY_PARTS as readonly string[]).includes(name);
}

export async function runHistory(deps: HistoryDeps, options: HistoryOptions, now: Date): Promise<void> {
  const { from } = options;
  const { archive, openaq } = deps;
  const work: Record<HistoryPart, (() => Promise<unknown>)[]> = {
    fires: archive
      ? [
          async () => log.info({ sites: await ingestFixedSources({ pool: deps.pool, archive }) }, "fixed sources known"),
          () => ingestFireHistory({ pool: deps.pool, archive }, from, now),
        ]
      : [async () => log.warn("no FIRMS_MAP_KEY, so the fire archive is left to the seed")],
    visibility: [() => ingestMetarHistory(deps, from, now)],
    air: [() => ingestNeaHistory(deps, from, now), openaq ? () => ingestOpenAqHistory({ pool: deps.pool, openaq }, from, now) : async () => log.warn("no OPENAQ_API_KEY, so OpenAQ's sensors are left out")],
    wind: [() => ingestWeatherHistory(deps, from, now)],
  };

  const failed: string[] = [];
  for (const part of options.parts.length > 0 ? options.parts : HISTORY_PARTS) {
    for (const step of work[part]) {
      try {
        await step();
      } catch (error) {
        log.error({ part, err: error instanceof Error ? error.message : String(error) }, "a part of the history failed");
        if (!failed.includes(part)) failed.push(part);
      }
    }
  }
  if (failed.length > 0) throw new TerminalError(`the history is incomplete: ${failed.join(", ")} failed and can be run again`);
}
