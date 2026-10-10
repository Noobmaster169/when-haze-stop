import type { CouncilContext } from "../context";
import { planCost, ringgit } from "../../../suppression/costs";
import { asPlan, PlanInput } from "./plan-input";
import type { CouncilTool, ToolResult } from "./types";

export const checkFeasibility: CouncilTool<PlanInput> = {
  name: "check_feasibility",
  description: "Checks a plan against the package and the mandate: assets per day, days worked, where each asset may work, and which lines wait on a new Indonesian request. Returns every problem, or that it can be done.",
  schema: PlanInput,
  run(input, ctx: CouncilContext): ToolResult {
    const { plan, violations } = ctx.tryPlan(asPlan(input));
    const waits = plan.assignments.filter((line) => line.needsConsent).map((line) => `${line.complexId} ${line.asset} waits on ${line.needsConsent === "sumatra" ? "a Sumatra request" : "a ground crew request"}`);
    const lines = violations.length === 0 ? ["It can be done as written."] : violations.map((item) => `- ${item.rule}: ${item.message}`);
    const cost = planCost(plan);
    lines.push(`Cost: ${ringgit(cost.total)} of the ${ringgit(ctx.budgetRm)} set aside (${cost.lines.map((line) => `${line.label} ${ringgit(line.rm)}`).join("; ")}).`);
    if (waits.length) lines.push(`Lines that wait on Indonesia: ${waits.join("; ")}.`);
    return { ok: violations.length === 0, text: lines.join("\n"), preview: violations.length === 0 ? "feasible" : `${violations.length} problems` };
  },
};
