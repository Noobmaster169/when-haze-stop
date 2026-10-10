import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { TerminalError } from "../../../lib/errors";

/**
 * How to do one kind of task, written once.
 *
 * A skill is a prompt file: `skills/<name>/SKILL.md`, with a version in its
 * frontmatter. Its card (when to reach for it) is always in front of the
 * agent; its body is asked for with `load_skill`, and from then on stays with
 * the conversation. Adding a skill is adding a folder: nothing registers it.
 */

const SKILLS_DIR = dirname(fileURLToPath(import.meta.url));

const Frontmatter = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  version: z.coerce.number().int().positive(),
  when: z.string().min(10).max(240),
});

export interface Skill {
  name: string;
  version: number;
  /** One sentence: the situation in which this skill is the right one. */
  when: string;
  body: string;
}

export function parseSkill(raw: string, folder: string, path: string): Skill {
  const text = raw.replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new TerminalError(`${path} has no frontmatter`);
  const fields = Object.fromEntries(
    match[1]
      .split("\n")
      .filter((line) => line.includes(":"))
      .map((line) => [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1).trim()]),
  );
  const parsed = Frontmatter.safeParse(fields);
  if (!parsed.success) throw new TerminalError(`${path} has bad frontmatter`, { cause: parsed.error });
  if (parsed.data.name !== folder) throw new TerminalError(`${path} says it is "${parsed.data.name}"`);
  return { ...parsed.data, body: match[2].trim() };
}

export function loadSkills(dir = SKILLS_DIR): Map<string, Skill> {
  const skills = new Map<string, Skill>();
  for (const entry of readdirSync(dir, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const path = join(dir, entry.name, "SKILL.md");
    if (!existsSync(path)) continue;
    skills.set(entry.name, parseSkill(readFileSync(path, "utf8"), entry.name, path));
  }
  return skills;
}

let cached: Map<string, Skill> | undefined;

export function skills(): Map<string, Skill> {
  cached ??= loadSkills();
  return cached;
}

/** One line a skill: when it applies. Always in the prompt. */
export function skillCards(all = skills()): string {
  if (all.size === 0) return "(no skills are installed)";
  return [...all.values()].map((skill) => `- ${skill.name}: ${skill.when}`).join("\n");
}

/** A skill as the agent reads it. */
export function skillText(skill: Skill): string {
  return `## Skill: ${skill.name} (v${skill.version})\n\n${skill.body}`;
}
