import { z } from "zod";

import { councilSkills, skillText } from "../skills/registry";
import { type CouncilTool, refused, type ToolResult } from "./types";

const Input = z.object({ name: z.string().min(1).max(60) });
type Input = z.infer<typeof Input>;

export const loadSkill: CouncilTool<Input> = {
  name: "load_skill",
  description: "Returns the full text of one skill: the research behind a kind of judgement, with its sources.",
  schema: Input,
  run(input): ToolResult {
    const skill = councilSkills().get(input.name);
    if (!skill) return refused(`there is no skill named "${input.name}". The skills are: ${[...councilSkills().keys()].join(", ")}`);
    return { ok: true, text: skillText(skill), preview: `${skill.name} v${skill.version}`, skill: skill.name };
  },
};
