import { argsSignature } from "../../chat/tools/args-signature";
import type { CouncilContext } from "../context";
import { checkFeasibility } from "./check-feasibility";
import { getComplex } from "./get-complex";
import { getComplexes } from "./get-complexes";
import { getCosts } from "./get-costs";
import { getInfluence } from "./get-influence";
import { getLogistics } from "./get-logistics";
import { getTargetAir } from "./get-target-air";
import { getWindOutlook } from "./get-wind-outlook";
import { loadSkill } from "./load-skill";
import { simulatePlan } from "./simulate-plan";
import { stressPlan } from "./stress-plan";
import { type CouncilTool, refused, type ToolResult } from "./types";

export type { ToolResult } from "./types";

/** The council's tools, and the one place they are named. A seat sees only those its seat lists, plus `load_skill`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each tool has its own input type; the registry is keyed by name and parses through the tool's own schema.
const ALL: CouncilTool<any>[] = [getComplexes, getComplex, getInfluence, getWindOutlook, getTargetAir, getLogistics, getCosts, checkFeasibility, simulatePlan, stressPlan, loadSkill];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above.
const TOOLS: ReadonlyMap<string, CouncilTool<any>> = new Map(ALL.map((tool) => [tool.name, tool]));

/** The tools a seat may call, as its prompt shows them. */
export function councilToolDescriptions(names: string[]): string {
  const allowed = ALL.filter((tool) => names.includes(tool.name) || tool.name === "load_skill");
  return allowed.map((tool) => `- ${tool.name}: ${tool.description}\n  args: ${argsSignature(tool.schema)}`).join("\n");
}

export function callCouncilTool(name: string, args: unknown, allowed: string[], ctx: CouncilContext): ToolResult {
  const tool = TOOLS.get(name);
  if (!tool || (!allowed.includes(name) && name !== "load_skill")) {
    return refused(`"${name}" is not one of your tools. Yours are: ${[...allowed, "load_skill"].join(", ")}`);
  }
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return { ok: false, text: `Those arguments do not fit ${name}: ${problems.join("; ")}. It takes exactly: ${argsSignature(tool.schema)}`, preview: `bad arguments: ${problems[0]}` };
  }
  return tool.run(parsed.data, ctx);
}
