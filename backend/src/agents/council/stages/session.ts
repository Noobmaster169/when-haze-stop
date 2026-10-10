import type { BoardPlan } from "../context";
import type { TurnDeps } from "../turn";
import type { CritiqueAnswer, MissionAnswer, PremortemAnswer, RatingAnswer } from "./answers";

/** What a council run has established so far, handed from stage to stage. */
export interface Session {
  deps: TurnDeps;
  facts: string;
  mission: MissionAnswer | null;
  /** Seat id to the premise it drafts under. */
  premises: Map<string, string>;
  /** Plan ids still in contention, best first. */
  shortlist: string[];
  critiques: { planId: string; by: string; answer: CritiqueAnswer }[];
  premortem: PremortemAnswer | null;
  ratings: { by: string; answer: RatingAnswer }[];
  /** Model turns taken, against the budget. */
  turns: number;
  /** Agents already on the page. */
  joined: Set<string>;
}

export const councilPlans = (session: Session): BoardPlan[] => session.deps.ctx.plans().filter((plan) => !plan.baseline);

export function describePlan(plan: BoardPlan): string {
  const lines = plan.plan.assignments.map((line) => `${line.complexId} ${line.asset} x${line.units} days ${line.fromDay}-${line.toDay}${line.needsConsent ? ` (waits on ${line.needsConsent} request)` : ""}`);
  const score = plan.score;
  return [
    `${plan.id}${plan.baseline ? " (baseline, made by code)" : ""}: ${plan.plan.title}`,
    `  lines: ${lines.join("; ") || "none"}`,
    `  engine: expected ${(100 * score.expected).toFixed(2)}% of the ceiling, worst wind ${(100 * score.worstWind).toFixed(2)}%, pessimistic ${(100 * score.pessimistic).toFixed(2)}%, optimistic ${(100 * score.optimistic).toFixed(2)}%`,
    plan.plan.requests.length ? `  requests: ${plan.plan.requests.join(" | ")}` : "",
    plan.plan.share ? `  share: ${plan.plan.share}` : "",
    plan.plan.rationale ? `  rationale: ${plan.plan.rationale}` : "",
    plan.violations.length ? `  NOT FEASIBLE: ${plan.violations.map((item) => item.message).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
