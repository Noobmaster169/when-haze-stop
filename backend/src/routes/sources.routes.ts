import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import { sourceFetchPage, sourceReport } from "../services/sources";
import { TRACKED_SOURCES } from "../sources/catalog";

/** Where the data comes from and when the jobs process last fetched it. Read-only. */

const FetchQuery = z.object({
  source: z.enum(TRACKED_SOURCES),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export function sourcesRouter(deps: { pool: Pool }): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await sourceReport(deps.pool));
  });

  router.get("/fetches", async (req, res) => {
    const query = FetchQuery.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: `source must be one of ${TRACKED_SOURCES.join(", ")}, and page a whole number from 1` });
      return;
    }
    res.json(await sourceFetchPage(deps.pool, query.data.source, query.data.page));
  });

  return router;
}
