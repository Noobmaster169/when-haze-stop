import { z } from "zod";

import { skills, skillText } from "../skills/registry";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** A skill's body, for the turn whose question matches a card. */

const Input = z.object({ name: z.string().min(1).max(60) });
type Input = z.infer<typeof Input>;

export const loadSkill: ChatTool<Input> = {
  name: "load_skill",
  description:
    "Returns the full text of one skill. Ask for it in the same step as your first lookups, not instead of them. " +
    "A skill you have loaded stays with the conversation.",
  schema: Input,

  run(input): Promise<ToolOutcome> {
    const skill = skills().get(input.name);
    if (!skill) {
      return Promise.resolve(refused(`there is no skill named "${input.name}". The skills are: ${[...skills().keys()].join(", ")}`));
    }
    return Promise.resolve({ ok: true, text: skillText(skill), preview: `${skill.name} v${skill.version}`, skill: skill.name });
  },
};
