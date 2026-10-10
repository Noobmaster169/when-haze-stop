import { z } from "zod";

import { Network } from "./haze-schemas";

/** Mirror of backend/src/contracts.simulation.ts. Change one, change the other in the same commit. */

const At = z.object({ at: z.string(), api: z.number() });

export const SimulationRun = z.object({
  asOf: z.string(),
  rankCorrelation: z.number().nullable(),
  pairs: z.number().int(),
  members: z.number().int(),
  fireDay: z.string().nullable(),
  fireCells: z.number().int(),
  firePowerMw: z.number(),
  weatherHours: z.number().int(),
  weatherPoints: z.number().int(),
});
export type SimulationRun = z.infer<typeof SimulationRun>;

export const LeadSkill = z.object({ lead: z.number().int(), cases: z.number().int(), model: z.number(), persistence: z.number(), low: z.number(), high: z.number() });
export type LeadSkill = z.infer<typeof LeadSkill>;

export const DaySkill = z.object({ day: z.string(), cases: z.number().int(), model: z.number(), persistence: z.number() });
export type DaySkill = z.infer<typeof DaySkill>;

export const Arrival = z.object({
  stationId: z.string(),
  stationName: z.string(),
  madeAt: z.string(),
  readings: z.array(At),
  forecast: z.array(At),
  model: z.number(),
  persistence: z.number(),
});
export type Arrival = z.infer<typeof Arrival>;

export const ModelMode = z.enum(["off", "shadow", "live"]);
export type ModelMode = z.infer<typeof ModelMode>;

export const ModelLeadSkill = z.object({
  network: Network,
  leadDays: z.number().int(),
  cases: z.number().int(),
  model: z.number().nullable(),
  persistence: z.number().nullable(),
  persistenceCases: z.number().int(),
  v2: z.number().nullable(),
  v2Cases: z.number().int(),
});
export type ModelLeadSkill = z.infer<typeof ModelLeadSkill>;

export const ModelSkill = z.object({
  mode: ModelMode,
  modelVersion: z.string().nullable(),
  since: z.string().nullable(),
  shadowDays: z.number().int(),
  shadowDaysRequired: z.number().int(),
  cases: z.number().int(),
  comparedCases: z.number().int(),
  gain: z.number().nullable(),
  gainRequired: z.number(),
  passed: z.boolean(),
  leads: z.array(ModelLeadSkill),
});
export type ModelSkill = z.infer<typeof ModelSkill>;

export const Simulation = z.object({
  period: z.object({ from: z.string().nullable(), to: z.string().nullable(), stations: z.number().int(), readings: z.number().int() }),
  run: SimulationRun.nullable(),
  bands: z.array(z.tuple([z.number(), z.number()])),
  histogram: z.array(z.object({ api: z.number(), count: z.number().int() })),
  binWidth: z.number(),
  skill: z.array(LeadSkill),
  dayLead: z.number().int(),
  days: z.array(DaySkill),
  arrivals: z.array(Arrival),
  model: ModelSkill,
});
export type Simulation = z.infer<typeof Simulation>;
