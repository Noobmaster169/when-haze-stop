import { Router } from "express";
import type { Pool } from "pg";

import { sourceReport } from "../services/sources";

/** Where the data comes from and when the jobs process last fetched it. Read-only. */
export function sourcesRouter(deps: { pool: Pool }): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await sourceReport(deps.pool));
  });

  return router;
}
