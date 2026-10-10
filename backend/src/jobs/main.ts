import { proxyLlmClient } from "../agents";
import { config } from "../config";
import { closePool, getPool } from "../db";
import { childLogger } from "../lib/logger";
import {
  doeClient,
  doeStatementsClient,
  firmsArchiveClient,
  firmsClient,
  metarClient,
  moeStatementsClient,
  neaClient,
  newsStatementsClient,
  openMeteoClient,
  type PushSender,
  webPushSender,
} from "../sources";
import { backfill, runCycle } from "./cycle";
import { evaluate, formatScores } from "./evaluate";
import { runHistory } from "./history";
import { type IngestDeps, rescreenRecentFires } from "./ingest";

/**
 * The data side of the app, run as its own process so a model run never holds
 * up a chat answer.
 *
 *   pnpm haze:once       fetch everything, run the model, raise alerts
 *   pnpm haze:backfill   replay the model over the stored week, for the accuracy page
 *   pnpm haze:loop       once now, then the backfill, then again every hour
 *   pnpm haze:history    the months before the app started: wind always, and with FIRMS_MAP_KEY the fire archive too
 *   pnpm haze:rescreen   screen the days the live fire files hold again, after a change to the fire screen
 *   pnpm haze:evaluate   replay the stored week and score it against no change; writes nothing
 *                        (optional: hours between runs, default 6; an ISO instant to score from)
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
    await runCycle(deps, new Date(), { fires: turn % FIRES_EVERY_HOURS === 0 });
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

async function main(): Promise<void> {
  const command = process.argv[2] ?? "once";
  const deps: IngestDeps = {
    pool: getPool(),
    doe: doeClient(),
    fires: firmsClient(),
    weather: openMeteoClient(),
    metar: metarClient(),
    nea: neaClient(),
    statements: { channels: [moeStatementsClient(), doeStatementsClient(), newsStatementsClient()], llm: proxyLlmClient({ maxConcurrency: config.LLM_MAX_CONCURRENCY }) },
    push: pushSender(),
  };
  try {
    if (command === "once") await runCycle(deps, new Date(), { fires: true });
    else if (command === "backfill") await backfill(deps);
    else if (command === "loop") await loop(deps);
    else if (command === "history") {
      await runHistory({ pool: deps.pool, archive: config.FIRMS_MAP_KEY ? firmsArchiveClient(config.FIRMS_MAP_KEY) : null, weather: deps.weather }, new Date());
    } else if (command === "rescreen") {
      await rescreenRecentFires(deps);
    } else if (command === "evaluate") {
      const from = process.argv[4] ? new Date(process.argv[4]) : undefined;
      const rows = await evaluate(deps.pool, { everyHours: Number(process.argv[3] ?? 6), from });
      process.stdout.write(`${formatScores(rows)}\n`);
    } else throw new Error(`unknown command "${command}". Use once, backfill, loop, history, rescreen or evaluate.`);
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
