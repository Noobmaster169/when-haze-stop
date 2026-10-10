import { z } from "zod";

import { DAILY_RM, DEPLOYMENT_RM, ringgit, TASK_FORCE_AIRLIFT_RM } from "../../../suppression/costs";
import { PACKAGE } from "../../../suppression/package";
import type { CouncilTool, ToolResult } from "./types";

const Input = z.object({});
type Input = z.infer<typeof Input>;

export const getCosts: CouncilTool<Input> = {
  name: "get_costs",
  description: "What each part of the package costs a day, the money set aside for this operation, and what the package is (fact or assumption, line by line).",
  schema: Input,
  run(_input, ctx): ToolResult {
    const lines = [
      `Money set aside for this operation: ${ringgit(ctx.budgetRm)}. No plan may cost more.`,
      `Daily costs (assumptions from published rates: CL-415 about EUR 15,000 a flight hour, helicopters about USD 6,000 an hour, personnel abroad RM 800 to 1,200 a day): CL-415 ${ringgit(DAILY_RM.cl415)}; each helicopter ${ringgit(DAILY_RM.helicopters)}; Bomba at home ${ringgit(DAILY_RM.bomba_domestic)} a person; the ground task force ${ringgit(DAILY_RM.ground_task_force)} a person plus ${ringgit(TASK_FORCE_AIRLIFT_RM)} airlift; sending anything abroad ${ringgit(DEPLOYMENT_RM)}.`,
      "Indonesia lets every aircraft and crew work wherever they are needed, in Sumatra or Kalimantan (assumed).",
      ...PACKAGE.assets.map((line) => `- ${line.label}: up to ${line.maxUnits}, ${line.maxDays} days, from day ${line.arrivesDay}. ${line.basis}. ${line.source}.`),
      "Haze cost Malaysia about RM 1.5 billion in 2013.",
    ];
    return { ok: true, text: lines.join("\n"), preview: "costs and package" };
  },
};
