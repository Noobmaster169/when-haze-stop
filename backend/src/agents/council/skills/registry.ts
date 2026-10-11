import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkills, type Skill, skillText } from "../../chat/skills/registry";

/**
 * The council's skills: the research distilled into what a seat acts on, one
 * folder per skill, in the chat's format and read by the chat's loader.
 */

const DIR = dirname(fileURLToPath(import.meta.url));
let cached: Map<string, Skill> | undefined;

export function councilSkills(): Map<string, Skill> {
  cached ??= loadSkills(DIR);
  return cached;
}

export { skillText };
