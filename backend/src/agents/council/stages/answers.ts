import { z } from "zod";

import { Plan } from "../../../contracts";
import { PlanInput } from "../tools/plan-input";

/**
 * What each stage asks a seat to write. Every answer opens with a headline of
 * at most 25 words, which is what the replay shows; the rest is opened on
 * click. The prototype's Chair wrote 1,500 words for one decision
 * (docs/council/11-prototype-council.md), so every field is capped.
 */

const Headline = z.string().min(1).max(240).describe("One sentence of at most 25 words: what you conclude.");

export const MissionAnswer = z.object({
  headline: Headline,
  objective: z.string().max(600),
  weights: z.object({
    klBenefit: z.number().min(0).max(1),
    robustness: z.number().min(0).max(1),
    feasibility: z.number().min(0).max(1),
    cost: z.number().min(0).max(1),
  }),
  weightReasons: z.string().max(600),
  premises: z.array(z.object({ seat: z.string(), premise: z.string().max(200) })).max(10).default([]),
  openingBrief: z.string().max(900),
});
export type MissionAnswer = z.infer<typeof MissionAnswer>;
export type Weights = MissionAnswer["weights"];

export const DraftAnswer = Plan.extend({ headline: Headline });
export type DraftAnswer = z.infer<typeof DraftAnswer>;

export const CritiqueAnswer = z.object({
  headline: Headline,
  verdict: z.enum(["support", "support_with_changes", "oppose"]),
  challenges: z
    .array(z.object({ claim: z.string().max(400), evidence: z.string().max(240).describe("A complex id, R-rule, wind member or score; or the word judgement."), kind: z.enum(["fact", "judgement"]) }))
    .max(4),
  variant: PlanInput.nullable().default(null).describe("A concrete changed plan for the engine to score instead of arguing, or null."),
  strongestObjection: z.string().max(400),
});
export type CritiqueAnswer = z.infer<typeof CritiqueAnswer>;

export const PremortemAnswer = z.object({
  headline: Headline,
  premortems: z
    .array(z.object({ planId: z.string(), headline: z.string().max(240).describe("One full sentence naming how this plan failed."), failure: z.string().max(500), evidence: z.string().max(300) }))
    .max(8),
  mostFragile: z.string().max(8),
  mostRobust: z.string().max(8),
});
export type PremortemAnswer = z.infer<typeof PremortemAnswer>;

export const RevisionAnswer = z.object({
  headline: Headline,
  plan: Plan,
  changes: z.string().max(600).describe("What you changed, and the evidence that moved you; or that you changed nothing and why."),
});
export type RevisionAnswer = z.infer<typeof RevisionAnswer>;

export const RatingAnswer = z.object({
  headline: Headline,
  ratings: z.array(z.object({ planId: z.string(), score: z.number().min(0).max(10), note: z.string().max(240) })).max(10),
});
export type RatingAnswer = z.infer<typeof RatingAnswer>;

export const DecisionAnswer = z.object({
  headline: Headline,
  actNow: z.string().max(400).describe("At most 50 plain words: the plan, what goes where and when, with the places named."),
  reasoning: z.string().max(800).describe("At most 100 plain words."),
  minorityReport: z.string().max(400),
  replanTrigger: z.string().max(400),
});
export type DecisionAnswer = z.infer<typeof DecisionAnswer>;
