import { proxyLlmClient } from "../agents";
import { config } from "../config";
import { closePool, getPool } from "../db";
import { childLogger } from "../lib/logger";
import {
  doeClient,
  doeStatementsClient,
  firmsArchiveClient,
  firmsClient,
  metarArchiveClient,
  metarClient,
  modelClient,
  moeStatementsClient,
  neaClient,
  newsStatementsClient,
  openAqClient,
  openMeteoClient,
  type PushSender,
  webPushSender,
} from "../sources";
import { coverage } from "./coverage";
import { backfill, runCycle } from "./cycle";
import { evaluate, formatScores } from "./evaluate";
import { type HistoryPart, HISTORY_PARTS, isHistoryPart, runHistory } from "./history";
import { formatHindcast, runHindcast } from "./hindcast";
import type { IngestDeps } from "./ingest";

/**
 * The data side of the app, run as its own process so a model run never holds
 * up a chat answer.
 *
 *   pnpm haze:once       fetch everything, run the model, raise alerts
 *   pnpm haze:backfill   replay the model over the stored week, for the accuracy page
 *   pnpm haze:loop       once now, then the backfill, then again every hour
 *   pnpm haze:history    everything back to HISTORY_FROM: fires (needs FIRMS_MAP_KEY), airport visibility,
 *                        measured PM2.5 (OpenAQ needs OPENAQ_API_KEY) and wind. Name parts to run only those:
 *                        pnpm haze:history fires visibility air wind
 *   pnpm haze:coverage   what is stored of those four, month by month; writes nothing
 *   pnpm haze:evaluate   replay the stored week and score it against no change; writes nothing
 *                        (optional: hours between runs, default 6; an ISO instant to score from)
 *   pnpm haze:hindcast   replay the smoke model at 00:00 UTC of every stored day, for the learned model's
 *                        training set; writes smoke_hindcasts and skips days that already have every instrument
 *                        (optional: first day, last day, as YYYY-MM-DD; default HISTORY_FROM to yesterday)
 */

const log = childLogger({ module: "jobs" });

/** DOE posts an hour's reading a few minutes into the next, so twenty past is the first minute worth asking at. */
const MINUTE_OF_HOUR = 20;
const FIRES_EVERY_HOURS = 3;

function msToNextRun(now: Date): number {
  const next = new Date(now);
  next.setMinutes(MINUTE_OF_HOUR, 0, 0);
  if (next <= now) next.setHours(next.getHours() + 1);
  return next.getTime() - now.getTime();
}

async function loop(deps: IngestDeps): Promise<void> {
  let stopping = false;
  let wake: (() => void) | undefined;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      stopping = true;
      wake?.();
    });
  }
  for (let turn = 0; !stopping; turn++) {
    await runCycle(deps, new Date(), { fires: turn % FIRES_EVERY_HOURS === 0, model: config.MODEL_MODE !== "off" });
    // After a start the stored week may have hours no run covers. Backfill skips the ones that have a run, so this is cheap after the first time.
    if (turn === 0 && !stopping) await backfill(deps);
    if (stopping) break;
    const wait = msToNextRun(new Date());
    log.info({ minutes: Math.round(wait / 60_000) }, "sleeping until the next cycle");
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, wait);
    });
  }
}

function pushSender(): PushSender | null {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = config;
  if (publicKey && privateKey) return webPushSender({ publicKey, privateKey, subject });
  log.warn("no VAPID keys are set, so alerts show in the app and no device is notified");
  return null;
}

function historyParts(names: string[]): HistoryPart[] {
  const unknown = names.find((name) => !isHistoryPart(name));
  if (unknown) throw new Error(`unknown part "${unknown}" of the history. Use any of ${HISTORY_PARTS.join(", ")}.`);
  return names.filter(isHistoryPart);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "once";
  const deps: IngestDeps = {
    pool: getPool(),
    doe: doeClient(),
    fires: firmsClient(),
    weather: openMeteoClient(),
    metar: metarClient(),
    nea: neaClient(),
    openaq: config.OPENAQ_API_KEY ? openAqClient(config.OPENAQ_API_KEY) : null,
    statements: { channels: [moeStatementsClient(), doeStatementsClient(), newsStatementsClient()], llm: proxyLlmClient({ maxConcurrency: config.LLM_MAX_CONCURRENCY }) },
    push: pushSender(),
    model: config.MODEL_MODE === "off" ? null : modelClient(config.MODEL_URL),
  };
  try {
    if (command === "once") await runCycle(deps, new Date(), { fires: true, model: config.MODEL_MODE !== "off" });
    else if (command === "backfill") await backfill(deps);
    else if (command === "loop") await loop(deps);
    else if (command === "history") {
      await runHistory(
        { pool: deps.pool, archive: config.FIRMS_MAP_KEY ? firmsArchiveClient(config.FIRMS_MAP_KEY) : null, metarArchive: metarArchiveClient(), nea: deps.nea, openaq: deps.openaq ?? null, weather: deps.weather },
        { from: config.HISTORY_FROM, parts: historyParts(process.argv.slice(3)) },
        new Date(),
      );
    } else if (command === "coverage") {
      process.stdout.write(`${await coverage(deps.pool, new Date())}\n`);
    } else if (command === "evaluate") {
      const from = process.argv[4] ? new Date(process.argv[4]) : undefined;
      const rows = await evaluate(deps.pool, { everyHours: Number(process.argv[3] ?? 6), from });
      process.stdout.write(`${formatScores(rows)}\n`);
    } else if (command === "hindcast") {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 3_600_000).toISOString().slice(0, 10);
      const summary = await runHindcast(deps.pool, { from: process.argv[3] ?? config.HISTORY_FROM, to: process.argv[4] ?? yesterday, now });
      process.stdout.write(`${formatHindcast(summary)}\n`);
    } else throw new Error(`unknown command "${command}". Use once, backfill, loop, history, coverage, evaluate or hindcast.`);
  } finally {
    await closePool();
  }
}

try {
  await main();
} catch (error) {
  log.error({ err: error instanceof Error ? error.message : String(error) }, "the jobs process failed");
  process.exitCode = 1;
}
