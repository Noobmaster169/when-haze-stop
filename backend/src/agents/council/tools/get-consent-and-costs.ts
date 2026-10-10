import { z } from "zod";

import { PACKAGE } from "../../../suppression/package";
import type { CouncilTool, ToolResult } from "./types";

const Input = z.object({});
type Input = z.infer<typeof Input>;

export const getConsentAndCosts: CouncilTool<Input> = {
  name: "get_consent_and_costs",
  description: "What Indonesia has accepted and what a new request would need, the package line by line with whether each line is fact or assumption, and its costs.",
  schema: Input,
  run(): ToolResult {
    const lines = [
      "Accepted on 18 September 2026, for Kalimantan only: the aircraft and the 52 personnel. On 7 October the two foreign ministries were still aligning procedures.",
      "Sumatra: a new request; if asked on day 1 and granted, aircraft from day 4. The comparable 2019 offer was declined.",
      "A Bomba ground task force anywhere in Indonesia: a new request; earliest day 7. Since 2015 Indonesia has accepted only aircraft.",
      "Malaysian soil: Bomba needs no one's consent.",
      ...PACKAGE.assets.map((line) => `- ${line.label}: up to ${line.maxUnits}, ${line.maxDays} days. ${line.basis}. ${line.source}.`),
      `Budget about RM ${PACKAGE.budgetRm.low / 1e6} to ${PACKAGE.budgetRm.high / 1e6} million (assumption: CL-415 about EUR 15,000 a flight hour, helicopters Rp 200 to 300 million an hour in 2019, personnel RM 800 to 1,200 a day). A ground task force about RM 4 million more. Haze cost Malaysia about RM 1.5 billion in 2013.`,
    ];
    return { ok: true, text: lines.join("\n"), preview: "consent and costs" };
  },
};
