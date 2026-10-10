import { z } from "zod";

import { shareOfCeiling } from "../../../suppression/attribution";
import type { CouncilContext } from "../context";
import { asPlan, PlanInput } from "./plan-input";
import { type CouncilTool, pct, refused, type ToolResult } from "./types";

const Input = z.object({ planId: z.string().max(8).optional().describe("A tabled plan, as P3."), plan: PlanInput.optional().describe("Or a plan's lines.") });
type Input = z.infer<typeof Input>;

export const stressPlan: CouncilTool<Input> = {
  name: "stress_plan",
  description: "Attacks a plan: its result in every wind member and scenario, the worst case named, and the biggest sources it leaves burning in that worst case. Pass a tabled planId or a plan's lines.",
  schema: Input,
  run(input, ctx: CouncilContext): ToolResult {
    const tabled = input.planId ? ctx.plan(input.planId) : undefined;
    if (!tabled && !input.plan) return refused("give a tabled planId or a plan's lines");
    const { plan, score } = tabled ?? ctx.tryPlan(asPlan(input.plan!));
    const worst = [...score.measures].sort((a, b) => a.shareOfCeiling - b.shareOfCeiling)[0];
    const member = ctx.attribution.members.findIndex((item) => item.id === worst.windMember);
    const touched = new Set(plan.assignments.map((line) => line.complexId));
    const untouched = [...ctx.attribution.contributions.keys()]
      .filter((id) => !touched.has(id))
      .map((id) => ({ id, share: shareOfCeiling(ctx.attribution, id, member) }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 5);
    const grid = (["optimistic", "central", "pessimistic"] as const).map(
      (scenario) => `${scenario}: ${score.measures.filter((item) => item.scenario === scenario).map((item) => `${item.windMember} ${pct(item.shareOfCeiling)}`).join(" ")}`,
    );
    const lines = [
      ...grid,
      `Worst case: ${worst.scenario} in ${worst.windMember}, ${pct(worst.shareOfCeiling)} of the ceiling.`,
      `Left burning in ${worst.windMember}: ${untouched.map((item) => `${item.id} ${pct(item.share)}`).join(", ")}.`,
    ];
    return { ok: true, text: lines.join("\n"), preview: `worst ${worst.windMember} ${worst.scenario} ${pct(worst.shareOfCeiling)}` };
  },
};
