import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import { statementPage } from "../services/statements";

/** What the government has said about the haze, once each, five to a page. Read-only. */

const PageQuery = z.object({
  status: z.enum(["current", "all"]).default("current"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export function statementsRouter(deps: { pool: Pool }): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const query = PageQuery.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "status must be current or all, and page a whole number from 1" });
      return;
    }
    res.json(await statementPage(deps.pool, { current: query.data.status === "current", page: query.data.page, now: new Date() }));
  });

  return router;
}
