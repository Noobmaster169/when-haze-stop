import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";

import { childLogger } from "../lib/logger";

/**
 * One line per request, carrying an id the response echoes back.
 *
 * Deliberately quiet on success, so a page that polls does not bury the
 * agent's actual decisions. A request that worked is a `debug` line, there for
 * a session started with `LOG_LEVEL=debug`; a refusal is a `warn`, a failure
 * an `error`, and both are visible at the default level.
 *
 * Bodies are never logged. A request body here carries what a person typed,
 * and a log is the one place that is hardest to take something back out of.
 */

/** Echoed on the response, so a person reading a failure can quote the id that produced it. */
const HEADER = "x-request-id";

export function requestLog(): RequestHandler {
  return pinoHttp({
    logger: childLogger({ module: "http" }),
    genReqId(req, res) {
      const existing = req.headers[HEADER];
      const id = typeof existing === "string" && existing ? existing : randomId();
      res.setHeader(HEADER, id);
      return id;
    },
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "debug";
    },
    // The defaults serialise the whole request and response, headers included,
    // and a cookie or authorization header is a secret in a log file.
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}

function randomId(): string {
  return crypto.randomUUID();
}
