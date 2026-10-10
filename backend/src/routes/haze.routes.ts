import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import { config } from "../config";
import type { Accuracy, GuidelineList, PlaceList } from "../contracts";
import { GUIDELINES } from "../haze/guidelines";
import { scores } from "../repositories";
import { hazeDay, hazeDays } from "../services/history";
import { cityAir } from "../services/city";
import { hazeMap } from "../services/map";
import { stationOutlook } from "../services/outlook";
import { findPlaces } from "../services/places";
import { simulation } from "../services/simulation";
import type { Geocoder } from "../sources";
import type { ModelClient } from "../sources/model";

/** The haze map and everything behind it, read-only. The jobs process is what writes. */

export interface HazeRouteDeps {
  pool: Pool;
  geocoder: Geocoder;
  /** The model service, for the backtest figure beside a forecast. Null while MODEL_MODE is off. */
  model: ModelClient | null;
}

const StationId = z.string().regex(/^[A-Za-z0-9]{2,40}$/);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PlaceQuery = z.string().trim().min(2).max(80);
const CityKey = z.string().regex(/^[a-z]{2,20}$/);

export function hazeRouter(deps: HazeRouteDeps): Router {
  const router = Router();

  router.get("/map", async (_req, res) => {
    res.json(await hazeMap(deps.pool, config.MODEL_MODE, deps.model));
  });

  router.get("/days", async (_req, res) => {
    res.json(await hazeDays(deps.pool, new Date(), config.HISTORY_FROM));
  });

  router.get("/days/:day", async (req, res) => {
    const day = Day.safeParse(req.params.day);
    if (!day.success || Number.isNaN(Date.parse(`${day.data}T00:00:00Z`))) {
      res.status(400).json({ error: "a day is YYYY-MM-DD" });
      return;
    }
    res.json(await hazeDay(deps.pool, day.data));
  });

  router.get("/stations/:id", async (req, res) => {
    const id = StationId.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "bad station id" });
      return;
    }
    const outlook = await stationOutlook(deps.pool, id.data, deps.model);
    if (!outlook) {
      res.status(404).json({ error: "no such station" });
      return;
    }
    res.json(outlook);
  });

  router.get("/cities/:key", async (req, res) => {
    const key = CityKey.safeParse(req.params.key);
    const air = key.success ? await cityAir(deps.pool, key.data) : null;
    if (!air) {
      res.status(404).json({ error: "no such city" });
      return;
    }
    res.json(air);
  });

  router.get("/accuracy", async (_req, res) => {
    const { since, leads } = await scores.byLead(deps.pool);
    const body: Accuracy = { since: since ? since.toISOString() : null, leads };
    res.json(body);
  });

  router.get("/simulation", async (_req, res) => {
    res.json(await simulation(deps.pool, config.MODEL_MODE));
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
    const body: PlaceList = { places: await findPlaces(deps.pool, deps.geocoder, query.data, { remote: req.query.remote === "1" }) };
    res.json(body);
  });

  return router;
}
