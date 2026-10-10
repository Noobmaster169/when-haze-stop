import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { TerminalError } from "../../lib/errors";

/**
 * Prompts are files: `prompts/<step>/v<N>.md`, frontmatter then the system
 * text. A change to a prompt is a new version file, never an edit, so the
 * `prompt_version` on every `llm_calls` row says exactly what the model read.
 */

const PROMPTS_DIR = dirname(fileURLToPath(import.meta.url));

const Frontmatter = z.object({
  step: z.string().min(1),
  version: z.string().regex(/^v\d+$/),
  /** A proxy alias from proxy/proxy.yaml. The env may name another for an experiment. */
  model: z.string().min(1),
  /** Only for a step with a reason to cap its answer. Without it the client's generous default applies. */
  max_tokens: z.coerce.number().int().positive().optional(),
});

export interface Prompt {
  step: string;
  version: string;
  model: string;
  maxTokens?: number;
  /** The system text, with its `{{placeholders}}` still in place. */
  text: string;
}

/** The file is `---`, `key: value` lines, `---`, then the prompt. Nothing here needs more YAML than that. */
function parsePromptFile(path: string): Prompt {
  const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new TerminalError(`${path} has no frontmatter`);

  const fields = Object.fromEntries(
    match[1]
      .split("\n")
      .filter((line) => line.includes(":"))
      .map((line) => [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1).trim()]),
  );
  const parsed = Frontmatter.safeParse(fields);
  if (!parsed.success) throw new TerminalError(`${path} has bad frontmatter`, { cause: parsed.error });
  const { step, version, model, max_tokens: maxTokens } = parsed.data;
  return { step, version, model, maxTokens, text: match[2].trim() };
}

function versionNumber(version: string): number {
  return Number(version.slice(1));
}

/** Every version of a step's prompt on disk, newest first. */
export function listVersions(step: string, dir = PROMPTS_DIR): string[] {
  let files: string[];
  try {
    files = readdirSync(join(dir, step)).filter((name) => /^v\d+\.md$/.test(name));
  } catch (error) {
    throw new TerminalError(`no prompts for step "${step}"`, { cause: error });
  }
  if (files.length === 0) throw new TerminalError(`no prompts for step "${step}"`);
  return files.map((name) => name.slice(0, -3)).sort((a, b) => versionNumber(b) - versionNumber(a));
}

/** One exact version of a step's prompt. `model` replaces the one the file names. */
export function loadPrompt(step: string, version: string, model?: string, dir = PROMPTS_DIR): Prompt {
  if (!/^v\d+$/.test(version)) throw new TerminalError(`"${version}" is not a prompt version`);
  const path = join(dir, step, `${version}.md`);
  if (!existsSync(path)) throw new TerminalError(`no prompt ${step}/${version}`);
  const prompt = parsePromptFile(path);
  if (prompt.step !== step) throw new TerminalError(`${step}/${version} says it is for step "${prompt.step}"`);
  if (prompt.version !== version) throw new TerminalError(`${step}/${version}.md says it is version "${prompt.version}"`);
  return model ? { ...prompt, model } : prompt;
}
