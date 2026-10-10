import { proxyLlmClient } from "../agents";
import { emitter } from "../agents/council/events";
import { runCouncil } from "../agents/council/run";
import { config } from "../config";
import { closePool, getPool } from "../db";
import { childLogger } from "../lib/logger";
import { council } from "../repositories";
import type { StoredRun } from "../repositories/council.repo";
import { engineSuppression } from "../services/suppression-engine";
import { firmsClient } from "../sources";
import { target } from "../suppression/targets";

/**
 * The council worker: takes queued council runs and executes them, one at a
 * time, writing every event to `council_events` as it happens.
 *
 *   pnpm council:worker          poll for queued runs, forever
 *   pnpm council:run             queue a run for KL now and execute it, then exit
 */

const log = childLogger({ module: "jobs.council-worker" });
const POLL_MS = 10_000;

async function execute(run: StoredRun): Promise<void> {
  const pool = getPool();
  const area = target(run.target);
  if (!area) {
    await council.fail(pool, run.id, `unknown target ${run.target}`);
    return;
  }
  const emit = emitter((event) => council.appendEvent(pool, run.id, event));
  log.info({ run: run.id, target: run.target }, "council run started");
  try {
    const verdict = await runCouncil(
      {
        llm: proxyLlmClient({ maxConcurrency: config.COUNCIL_MAX_CONCURRENCY }),
        pool,
        engine: engineSuppression({ pool, fires: firmsClient() }),
        emit,
        onAsOf: (asOf) => council.setAsOf(pool, run.id, asOf),
      },
      area,
    );
    await council.finish(pool, run.id, verdict);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ run: run.id, err: message }, "council run failed");
    // The failure is on the record twice: as the run's error, and as the last event of its replay.
    await emit.emit("run_failed", "system", { error: message });
    await council.fail(pool, run.id, message);
  }
}

async function loop(): Promise<void> {
  const pool = getPool();
  for (;;) {
    const run = await council.claimNext(pool);
    if (run) await execute(run);
    else await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

async function once(): Promise<void> {
  const pool = getPool();
  const queued = await council.queue(pool, "klang-valley");
  if (!queued) log.info("a run was already queued or running; executing the queued one if any");
  const run = await council.claimNext(pool);
  if (run) await execute(run);
  else log.warn("nothing to execute: a run is already running elsewhere");
}

const mode = process.argv[2] ?? "loop";
try {
  await (mode === "once" ? once() : loop());
} finally {
  await closePool();
}
