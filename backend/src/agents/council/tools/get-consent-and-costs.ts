import { z } from "zod";

import { DAILY_RM, DEPLOYMENT_RM, ringgit, TASK_FORCE_AIRLIFT_RM } from "../../../suppression/costs";
import { PACKAGE } from "../../../suppression/package";
import type { CouncilTool, ToolResult } from "./types";

const Input = z.object({});
type Input = z.infer<typeof Input>;

export const getConsentAndCosts: CouncilTool<Input> = {
  name: "get_consent_and_costs",
  description: "What Indonesia has accepted and what a new request would need, the package line by line with whether each line is fact or assumption, and its costs.",
  schema: Input,
  run(_input, ctx): ToolResult {
    const lines = [
      "Accepted on 18 September 2026, for Kalimantan only: the aircraft and the 52 personnel. On 7 October the two foreign ministries were still aligning procedures.",
      "Sumatra: a new request; if asked on day 1 and granted, aircraft from day 4. The comparable 2019 offer was declined.",
      "A Bomba ground task force anywhere in Indonesia: a new request; earliest day 7. Since 2015 Indonesia has accepted only aircraft.",
      "Malaysian soil: Bomba needs no one's consent.",
      ...PACKAGE.assets.map((line) => `- ${line.label}: up to ${line.maxUnits}, ${line.maxDays} days. ${line.basis}. ${line.source}.`),
      `Money set aside for this operation: ${ringgit(ctx.budgetRm)}. Daily costs (assumptions from published rates: CL-415 about EUR 15,000 a flight hour, helicopters about USD 6,000 an hour, personnel abroad RM 800 to 1,200 a day): CL-415 ${ringgit(DAILY_RM.cl415)}; each helicopter ${ringgit(DAILY_RM.helicopters)}; Bomba at home ${ringgit(DAILY_RM.bomba_domestic)} a person; the ground task force ${ringgit(DAILY_RM.ground_task_force)} a person plus ${ringgit(TASK_FORCE_AIRLIFT_RM)} airlift; sending anything abroad ${ringgit(DEPLOYMENT_RM)}. Haze cost Malaysia about RM 1.5 billion in 2013.`,
    ];
    return { ok: true, text: lines.join("\n"), preview: "consent and costs" };
  },
};
