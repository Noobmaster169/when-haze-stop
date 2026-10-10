import { z } from "zod";

/**
 * The Suppression Council: the plan a seat writes, what the engine says about
 * it, and the run the page replays. See docs/council/.
 *
 * A plan comes out of a model, so it is parsed here before anything reads it.
 * Re-exported from contracts.ts and mirrored by hand as zod schemas in
 * frontend/lib/api/council-schemas.ts. Change one, change the other in the
 * same commit.
 */

export const AssetKind = z.enum(["cl415", "helicopters", "ground_teams", "bomba_domestic", "ground_task_force"]);
export type AssetKind = z.infer<typeof AssetKind>;

/** What a line of a plan waits on: a new Indonesian agreement, or nothing. */
export const Consent = z.enum(["sumatra", "ground_crews"]);
export type Consent = z.infer<typeof Consent>;

export const Assignment = z.object({
  complexId: z.string().min(1).max(16),
  asset: AssetKind,
  /** Aircraft count for `cl415` and `helicopters`, teams for `ground_teams`, people for the two Bomba kinds. */
  units: z.number().int().positive().max(1000),
  /** Plan day 1 is the first day the package can work (`PACKAGE.dayOne`). */
  fromDay: z.number().int().min(1).max(30),
  toDay: z.number().int().min(1).max(30),
  needsConsent: Consent.nullable().default(null),
});
export type Assignment = z.infer<typeof Assignment>;

export const Plan = z.object({
  title: z.string().min(1).max(120),
  assignments: z.array(Assignment).max(24),
  /** Requests to Indonesia this plan depends on or recommends, in words. */
  requests: z.array(z.string().max(300)).max(6).default([]),
  /** What the plan hands Indonesia's agency, in words; null for nothing. */
  share: z.string().max(400).nullable().default(null),
  rationale: z.string().max(1500),
  assumptions: z.array(z.string().max(300)).max(8).default([]),
  confidence: z.number().min(0).max(1),
  /** The one assumption the plan's value rests on. */
  dependsOn: z.string().max(300),
});
export type Plan = z.infer<typeof Plan>;

export const ScenarioName = z.enum(["optimistic", "central", "pessimistic"]);
export type ScenarioName = z.infer<typeof ScenarioName>;

/** What the engine says a plan does to the target, in one scenario and one wind member. */
export const PlanMeasures = z.object({
  scenario: ScenarioName,
  windMember: z.string(),
  /** Mean over the horizon of the 24-hour PM2.5 removed at the target, ug/m3. */
  meanRemoved: z.number(),
  peakRemoved: z.number(),
  /** `meanRemoved` as a share of the ceiling (every fire out from day 1), 0 to 1. */
  shareOfCeiling: z.number(),
  /** Hours over the horizon the target spends above API 100 and 200 without the plan, minus with it. */
  hoursOver100Avoided: z.number().int(),
  hoursOver200Avoided: z.number().int(),
  /** Hours from the run until the benefit first reaches a tenth of its peak; null for no benefit. */
  arrivalHours: z.number().int().nullable(),
});
export type PlanMeasures = z.infer<typeof PlanMeasures>;

export const Violation = z.object({
  assignment: z.number().int().nullable(),
  rule: z.enum(["capacity", "mandate", "consent", "reach", "days", "unknown_complex", "asset_place"]),
  message: z.string(),
});
export type Violation = z.infer<typeof Violation>;
