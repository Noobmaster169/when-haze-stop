import { z } from "zod";

import { Network } from "./contracts.haze";

/**
 * The Simulation page: how a run is made, from what, and the proof that it
 * predicts. Everything is worked out from the database on each request.
 *
 * Re-exported from contracts.ts and mirrored by hand as zod schemas in
 * frontend/lib/api/simulation-schemas.ts. Change one, change the other in the
 * same commit.
 */

const At = z.object({ at: z.string(), api: z.number() });

export const SimulationRun = z.object({
  asOf: z.string(),
  rankCorrelation: z.number().nullable(),
  pairs: z.number().int(),
  members: z.number().int(),
  /** The newest UTC day of fires the run could know, with its burning cells and their total fire power. */
  fireDay: z.string().nullable(),
  fireCells: z.number().int(),
  firePowerMw: z.number(),
  weatherHours: z.number().int(),
  weatherPoints: z.number().int(),
});
export type SimulationRun = z.infer<typeof SimulationRun>;

export const LeadSkill = z.object({
  lead: z.number().int(),
  cases: z.number().int(),
  model: z.number(),
  persistence: z.number(),
  /** 90% interval of model minus persistence, whole days resampled. */
  low: z.number(),
  high: z.number(),
});
export type LeadSkill = z.infer<typeof LeadSkill>;

export const DaySkill = z.object({ day: z.string(), cases: z.number().int(), model: z.number(), persistence: z.number() });
export type DaySkill = z.infer<typeof DaySkill>;

export const ModelMode = z.enum(["off", "shadow", "live"]);
export type ModelMode = z.infer<typeof ModelMode>;

/** The learned model against what happened, for one kind of instrument at one lead. Errors in API points. */
export const ModelLeadSkill = z.object({
  network: Network,
  leadDays: z.number().int(),
  /** Instrument-days scored: a model forecast for a day whose peak reading is in. */
  cases: z.number().int(),
  model: z.number().nullable(),
  /** "No change", the newest reading at the issue time, on the cases that had one. */
  persistence: z.number().nullable(),
  persistenceCases: z.number().int(),
  /** The hourly forecast's peak over the same day, on the cases that had a run at the same hour. */
  v2: z.number().nullable(),
  v2Cases: z.number().int(),
});
export type ModelLeadSkill = z.infer<typeof ModelLeadSkill>;

/**
 * The learned model's live record and the rule that lets it speak: after
 * `shadowDaysRequired` days of forecasts for DOE stations, a day-ahead error
 * at least `gainRequired` below the hourly forecast's.
 */
export const ModelSkill = z.object({
  mode: ModelMode,
  modelVersion: z.string().nullable(),
  since: z.string().nullable(),
  shadowDays: z.number().int(),
  shadowDaysRequired: z.number().int(),
  /** 1 minus model over v2 at one day ahead for DOE stations, null before both exist. */
  gain: z.number().nullable(),
  gainRequired: z.number(),
  passed: z.boolean(),
  leads: z.array(ModelLeadSkill),
});
export type ModelSkill = z.infer<typeof ModelSkill>;

export const Simulation = z.object({
  period: z.object({ from: z.string().nullable(), to: z.string().nullable(), stations: z.number().int(), readings: z.number().int() }),
  run: SimulationRun.nullable(),
  /** DOE's band edges as [ug/m3, API], lowest first. */
  bands: z.array(z.tuple([z.number(), z.number()])),
  /** Readings in the period, counted in bins of `binWidth` API points from `api`. */
  histogram: z.array(z.object({ api: z.number(), count: z.number().int() })),
  binWidth: z.number(),
  skill: z.array(LeadSkill),
  /** Skill per UTC day at `dayLead` hours. */
  dayLead: z.number().int(),
  days: z.array(DaySkill),
  /** Haze arriving at stations, each replayed from the hour it crossed 100. */
  arrivals: z.array(
    z.object({ stationId: z.string(), stationName: z.string(), madeAt: z.string(), readings: z.array(At), forecast: z.array(At), model: z.number(), persistence: z.number() }),
  ),
  /** The learned model scored as its days come in, and whether the shadow rule has passed. */
  model: ModelSkill,
});
export type Simulation = z.infer<typeof Simulation>;
