import type { CouncilContext } from "../context";
import { planCost, ringgit } from "../../../suppression/costs";
import { asPlan, PlanInput } from "./plan-input";
import type { CouncilTool, ToolResult } from "./types";

export const checkFeasibility: CouncilTool<PlanInput> = {
  name: "check_feasibility",
  description: "Checks a plan against the package and the money: assets per day, days worked, where each asset may work (Bomba at home, the team in Indonesia), and the cost against the budget. Returns every problem, or that it can be done.",
  schema: PlanInput,
  run(input, ctx: CouncilContext): ToolResult {
    const { plan, violations } = ctx.tryPlan(asPlan(input));
    const lines = violations.length === 0 ? ["It can be done as written."] : violations.map((item) => `- ${item.rule}: ${item.message}`);
    const cost = planCost(plan);
    lines.push(`Cost: ${ringgit(cost.total)} of the ${ringgit(ctx.budgetRm)} set aside (${cost.lines.map((line) => `${line.label} ${ringgit(line.rm)}`).join("; ")}).`);
    return { ok: violations.length === 0, text: lines.join("\n"), preview: violations.length === 0 ? "feasible" : `${violations.length} problems` };
  },
};
