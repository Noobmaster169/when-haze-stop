import { z } from "zod";

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
});
export type Simulation = z.infer<typeof Simulation>;
