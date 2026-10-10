import { z } from "zod";

import { Assignment, type Plan } from "../../../contracts";

/** A plan as a tool takes it: the lines are what matter; the rest is filled in. */
export const PlanInput = z.object({
  title: z.string().max(120).default("variant"),
  assignments: z.array(Assignment).min(1).max(24),
});
export type PlanInput = z.infer<typeof PlanInput>;

export function asPlan(input: PlanInput): Plan {
  return { title: input.title, assignments: input.assignments, requests: [], share: null, rationale: "", assumptions: [], confidence: 0.5, dependsOn: "" };
}
