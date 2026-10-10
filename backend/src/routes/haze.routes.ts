import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import type { Accuracy, GuidelineList, PlaceList } from "../contracts";
import { GUIDELINES } from "../haze/guidelines";
import { scores } from "../repositories";
import { hazeMap } from "../services/map";
import { stationOutlook } from "../services/outlook";
import { findPlaces } from "../services/places";
import type { Geocoder } from "../sources";

/** The haze map and everything behind it, read-only. The jobs process is what writes. */

export interface HazeRouteDeps {
  pool: Pool;
  geocoder: Geocoder;
}

const StationId = z.string().regex(/^[A-Za-z0-9]{2,40}$/);
const PlaceQuery = z.string().trim().min(2).max(80);

export function hazeRouter(deps: HazeRouteDeps): Router {
  const router = Router();

  router.get("/map", async (_req, res) => {
    res.json(await hazeMap(deps.pool));
  });

  router.get("/stations/:id", async (req, res) => {
    const id = StationId.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "bad station id" });
      return;
    }
    const outlook = await stationOutlook(deps.pool, id.data);
    if (!outlook) {
      res.status(404).json({ error: "no such station" });
      return;
    }
    res.json(outlook);
  });

  router.get("/accuracy", async (_req, res) => {
    const { since, leads } = await scores.byLead(deps.pool);
    const body: Accuracy = { since: since ? since.toISOString() : null, leads };
    res.json(body);
  });

  router.get("/guidelines", (_req, res) => {
    const body: GuidelineList = { guidelines: GUIDELINES };
    res.json(body);
  });

  router.get("/places", async (req, res) => {
    const query = PlaceQuery.safeParse(req.query.q);
    if (!query.success) {
      res.status(400).json({ error: "a place search needs at least two characters in q" });
      return;
    }
    const body: PlaceList = { places: await findPlaces(deps.pool, deps.geocoder, query.data) };
    res.json(body);
  });

  return router;
}
