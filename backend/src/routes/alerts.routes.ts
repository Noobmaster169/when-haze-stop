import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import type { AlertFeed, SubscriptionList } from "../contracts";
import { NewSubscription } from "../contracts";
import { alerts, stations } from "../repositories";

/**
 * Following a station and reading what was said about it.
 *
 * There is no login. A browser makes up a session id, keeps it, and sends it
 * with every call; knowing the id is all it takes to read or change what that
 * browser follows, which is the right amount of protection for a list of towns.
 */

const SessionId = z.string().min(8).max(80);
const AfterId = z.coerce.number().int().min(0).default(0);

export function alertsRouter(deps: { pool: Pool }): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const session = req.query.session === undefined ? undefined : SessionId.safeParse(req.query.session);
    const after = AfterId.safeParse(req.query.after ?? 0);
    if ((session && !session.success) || !after.success) {
      res.status(400).json({ error: "bad session or after" });
      return;
    }
    const body: AlertFeed = { events: await alerts.feed(deps.pool, { sessionId: session?.data, afterId: after.data }) };
    res.json(body);
  });

  router.get("/subscriptions", async (req, res) => {
    const session = SessionId.safeParse(req.query.session);
    if (!session.success) {
      res.status(400).json({ error: "bad session" });
      return;
    }
    const body: SubscriptionList = { subscriptions: await alerts.subscriptions(deps.pool, session.data) };
    res.json(body);
  });

  router.post("/subscriptions", async (req, res) => {
    const body = NewSubscription.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid subscription", issues: body.error.issues });
      return;
    }
    if (!(await stations.find(deps.pool, body.data.stationId))) {
      res.status(404).json({ error: "no such station" });
      return;
    }
    res.status(201).json(await alerts.subscribe(deps.pool, body.data.sessionId, body.data.stationId, body.data.push));
  });

  router.delete("/subscriptions/:stationId", async (req, res) => {
    const session = SessionId.safeParse(req.query.session);
    if (!session.success) {
      res.status(400).json({ error: "bad session" });
      return;
    }
    if (await alerts.unsubscribe(deps.pool, session.data, req.params.stationId)) {
      res.status(204).end();
      return;
    }
    res.status(404).json({ error: "not following that station" });
  });

  return router;
}
