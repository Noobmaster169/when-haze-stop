import net from "node:net";

import { proxyLlmClient } from "./agents";
import { createApp } from "./app";
import { config } from "./config";
import { closePool, getPool } from "./db";
import { checkHealth, realProbes } from "./health";
import { childLogger } from "./lib/logger";

const log = childLogger({ module: "api" });

// Happy Eyeballs gives each candidate address 250ms to connect, which cold
// connections from some networks blow through and fail as ETIMEDOUT.
// This is a connect-attempt budget, not a request timeout.
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

const pool = getPool();
const probes = realProbes(pool);
const app = createApp({
  pool,
  llm: proxyLlmClient({ maxConcurrency: config.LLM_MAX_CONCURRENCY }),
  health: () => checkHealth(probes),
});

const server = app.listen(config.PORT, config.HOST, () => log.info({ host: config.HOST, port: config.PORT }, "api listening"));
// A cold model plus a long generation can outlast the default 5-minute
// request timeout; the llm client has its own 600s ceiling, the binding one.
server.requestTimeout = 660_000;
server.headersTimeout = 665_000;

/** Never rejects: a signal handler cannot await it, so a failure is logged here or nowhere. */
async function shutdown(): Promise<void> {
  try {
    await closePool();
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "shutdown failed");
    process.exit(1);
  }
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => void shutdown());
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
