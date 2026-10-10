import { summarise } from "../context";
import type { CouncilContext } from "../context";
import { planCost, ringgit } from "../../../suppression/costs";
import { asPlan, PlanInput } from "./plan-input";
import { type CouncilTool, pct, type ToolResult, ug } from "./types";

export const simulatePlan: CouncilTool<PlanInput> = {
  name: "simulate_plan",
  description:
    "Runs a plan through the engine: the share of the ceiling it removes (central over wind members, the worst member, pessimistic, optimistic), ug/m3 removed on average and at the peak, hours above API 100 avoided, when the benefit arrives, and any feasibility problems. Use it instead of arguing about what a plan would do.",
  schema: PlanInput,
  run(input, ctx: CouncilContext): ToolResult {
    const { violations, score } = ctx.tryPlan(asPlan(input));
    const summary = summarise(score);
    const central = score.measures.filter((item) => item.scenario === "central");
    const lines = [
      `"${input.title}": expected ${pct(summary.expected)} of the ceiling (central, mean of wind members); worst member ${pct(summary.worstWind)}; pessimistic ${pct(summary.pessimistic)}; optimistic ${pct(summary.optimistic)}.`,
      `Central by member: ${central.map((item) => `${item.windMember} ${ug(item.meanRemoved)} mean, ${ug(item.peakRemoved)} peak, ${item.hoursOver100Avoided} h above API 100 avoided`).join("; ")}.`,
      summary.arrivalHours === null ? "No benefit reaches KL within the horizon." : `The benefit first reaches KL ${summary.arrivalHours} h after the data's hour.`,
      `Cost: ${ringgit(planCost(input).total)} of the ${ringgit(ctx.budgetRm)} set aside.`,
      violations.length ? `Not feasible as written: ${violations.map((item) => item.message).join("; ")}.` : "Feasible as written.",
    ];
    return { ok: true, text: lines.join("\n"), preview: `expected ${pct(summary.expected)}, worst wind ${pct(summary.worstWind)}` };
  },
};
