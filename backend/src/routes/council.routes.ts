import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import { CouncilEvent, type CouncilRun, StartCouncilRequest, Verdict } from "../contracts";
import { council } from "../repositories";
import type { StoredRun } from "../repositories/council.repo";

/**
 * The Suppression Council: queue a run, list runs, read one and its event log,
 * delete a finished one.
 * The run itself is executed by the council worker in the jobs image, never
 * here: it takes many minutes and many model calls.
 */

const Id = z.coerce.number().int().positive();
const After = z.coerce.number().int().min(-1).default(-1);

function toContract(run: StoredRun): CouncilRun {
  // A verdict that no longer parses (the contract moved on) is shown as missing rather than failing the page.
  const verdict = run.verdict === null ? null : Verdict.safeParse(run.verdict);
  return { ...run, verdict: verdict?.success ? verdict.data : null };
}

export function councilRouter(deps: { pool: Pool }): Router {
  const router = Router();

  router.post("/runs", async (req, res) => {
    const body = StartCouncilRequest.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "target must be klang-valley, the only area the council can be asked about yet, and budgetRm one of 4000000, 8000000, 12000000" });
      return;
    }
    const run = await council.queue(deps.pool, body.data.target, body.data.budgetRm);
    if (!run) {
      res.status(409).json({ error: "a council run is already queued or running; wait for it to finish" });
      return;
    }
    res.status(202).json(toContract(run));
  });

  router.get("/runs", async (_req, res) => {
    const runs = await council.list(deps.pool);
    res.json({ runs: runs.map(({ verdict: _verdict, ...rest }) => rest) });
  });

  router.get("/runs/:id", async (req, res) => {
    const id = Id.safeParse(req.params.id);
    const run = id.success ? await council.find(deps.pool, id.data) : null;
    if (!run) {
      res.status(404).json({ error: "no such council run" });
      return;
    }
    res.json(toContract(run));
  });

  router.delete("/runs/:id", async (req, res) => {
    const id = Id.safeParse(req.params.id);
    const run = id.success ? await council.find(deps.pool, id.data) : null;
    if (!run) {
      res.status(404).json({ error: "no such council run" });
      return;
    }
    if (run.status === "queued" || run.status === "running") {
      res.status(409).json({ error: "a meeting in session cannot be deleted; wait for it to finish" });
      return;
    }
    await council.deleteRun(deps.pool, run.id);
    res.status(204).end();
  });

  router.get("/runs/:id/events", async (req, res) => {
    const id = Id.safeParse(req.params.id);
    const after = After.safeParse(req.query.after);
    const run = id.success ? await council.find(deps.pool, id.data) : null;
    if (!run || !after.success) {
      res.status(404).json({ error: "no such council run" });
      return;
    }
    const stored = await council.eventsAfter(deps.pool, run.id, after.data);
    // Events are written by this code, but a malformed one must not take the replay down with it.
    const events = stored.map((event) => CouncilEvent.safeParse(event)).filter((parsed) => parsed.success).map((parsed) => parsed.data);
    res.json({ events, status: run.status });
  });

  return router;
}
