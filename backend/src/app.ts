import express, { type NextFunction, type Request, type Response } from "express";
import type { Pool } from "pg";

import type { LlmClient } from "./agents/llm-client";
import type { HealthReport } from "./contracts";
import { RetryableError, UpstreamError } from "./lib/errors";
import { childLogger } from "./lib/logger";
import { aiRouter } from "./routes/ai.routes";
import { alertsRouter } from "./routes/alerts.routes";
import { chatRouter } from "./routes/chat.routes";
import { hazeRouter } from "./routes/haze.routes";
import { requestLog } from "./routes/request-log";
import { sourcesRouter } from "./routes/sources.routes";
import { statementsRouter } from "./routes/statements.routes";
import type { Geocoder } from "./sources";
import type { ModelClient } from "./sources/model";

const log = childLogger({ module: "api" });

/** Everything the app reaches outside itself, so tests can hand in fakes. */
export interface AppDeps {
  pool: Pool;
  /** How the chat reaches a model. */
  llm: LlmClient;
  /** Place names to coordinates, for the search box and the assistant. */
  geocoder: Geocoder;
  /** The model service, asked only for its published report. Null while MODEL_MODE is off. */
  model: ModelClient | null;
  health: () => Promise<HealthReport>;
}

/**
 * The api authenticates nobody. It binds to loopback (config.HOST) and its
 * only caller is the Next server beside it. Before it is reachable from
 * anywhere else, put a check here, above the routers.
 */
export function createApp(deps: AppDeps): express.Express {
  const app = express();
  // Before the body parser, so a request that fails to parse is still logged.
  app.use(requestLog());
  app.use(express.json({ limit: "1mb" }));

  // Degraded is still 200: a proxy that is away takes the chat with it and
  // nothing else. Only postgres, which the api cannot serve without, is a 503.
  app.get("/health", async (_req, res) => {
    const report = await deps.health();
    res.status(report.status === "down" ? 503 : 200).json(report);
  });

  app.use("/ai", aiRouter());
  app.use("/chat", chatRouter({ pool: deps.pool, llm: deps.llm, geocoder: deps.geocoder }));
  app.use("/haze", hazeRouter({ pool: deps.pool, geocoder: deps.geocoder, model: deps.model }));
  app.use("/alerts", alertsRouter({ pool: deps.pool }));
  app.use("/sources", sourcesRouter({ pool: deps.pool }));
  app.use("/statements", statementsRouter({ pool: deps.pool }));

  app.use(
    // Four parameters are what make Express treat this as an error handler.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof UpstreamError) {
        // `retryable` travels with the body so a caller relays the dependency's
        // verdict instead of flattening it to a status.
        res.status(error.status).json({ error: error.message, retryable: error.retryable });
        return;
      }
      if (error instanceof RetryableError) {
        log.warn({ err: error.message }, "dependency unavailable");
        res.status(503).json({ error: error.message });
        return;
      }
      log.error({ err: error }, "unhandled");
      res.status(500).json({ error: "Internal error" });
    },
  );

  return app;
}
