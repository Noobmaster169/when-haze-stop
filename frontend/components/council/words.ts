import type { AgentKind, MessageAct, StageId } from "@/lib/api/council-schemas";

/**
 * The council's vocabulary for people and its colours, in one place. Colours
 * are token references, so SVG fills follow the light and dark schemes without
 * reading a computed style.
 */

export const ACT_COLOUR: Record<MessageAct, string> = {
  brief: "var(--ink-tertiary)",
  propose: "var(--signal)",
  challenge: "var(--verdict-fault)",
  support: "var(--verdict-match)",
  concede: "var(--verdict-differ)",
  revise: "var(--verdict-review)",
  question: "var(--signal)",
  answer: "var(--ink-tertiary)",
  dissent: "var(--verdict-fault)",
  decide: "var(--accent)",
};

export const ACT_WORD: Record<MessageAct, string> = {
  brief: "Brief",
  propose: "Proposal",
  challenge: "Challenge",
  support: "Support",
  concede: "Concession",
  revise: "Revision",
  question: "Question",
  answer: "Answer",
  dissent: "Dissent",
  decide: "Decision",
};

/** The acts a person reads to follow the argument in a minute. */
export const ARGUMENT_ACTS: ReadonlySet<MessageAct> = new Set(["challenge", "concede", "dissent"]);

export const KIND_COLOUR: Record<AgentKind, string> = {
  chair: "var(--accent)",
  seat: "var(--ink-tertiary)",
  red: "var(--verdict-fault)",
  engine: "var(--verdict-review)",
  analyst: "var(--signal)",
};

export const KIND_TINT: Record<AgentKind, string> = {
  chair: "var(--accent-tint)",
  seat: "var(--surface)",
  red: "var(--verdict-fault-tint)",
  engine: "var(--verdict-review-tint)",
  analyst: "var(--signal-tint)",
};

const TOOL_WORDS: Record<string, string> = {
  get_complexes: "looks up the fire complexes",
  get_complex: "looks up one fire complex",
  get_influence: "checks which fires reach KL",
  check_feasibility: "checks a plan is feasible",
  simulate_plan: "asks the engine to score a plan",
  stress_plan: "stress-tests a plan on the engine",
  get_target_air: "reads the air over the target",
  get_wind_outlook: "reads the wind outlook",
  get_logistics: "checks the logistics",
  get_consent_and_costs: "checks consent and costs",
  load_skill: "reads a skill",
};

export function toolWords(tool: string): string {
  return TOOL_WORDS[tool] ?? `uses ${tool.replaceAll("_", " ")}`;
}

/** Tools that run the smoke model, which light the engine at the centre of the table. */
export const ENGINE_TOOLS: ReadonlySet<string> = new Set(["simulate_plan", "stress_plan"]);

/** Two letters inside a node, from its title: "Air Quality" is AQ, "Meteorology" is ME. */
export function initials(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return title.slice(0, 2).toUpperCase();
}

/** "41.3%" for a share of the ceiling; finer below one percent, where the accepted package often lands. */
export function percent(share: number): string {
  const value = 100 * share;
  if (value !== 0 && Math.abs(value) < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

/** "A, B and C" for up to three; past that "the council" for most of the table, or a count. */
export function listNames(names: string[], tableSize: number): string {
  if (names.length === 0) return "the table";
  if (names.length >= 4) return names.length >= tableSize - 3 ? "the council" : `${names.length} seats`;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The nine stages in order, short enough for the player's stage row. */
export const STAGE_LABEL: Record<StageId, string> = {
  situation: "Situation",
  mission: "Mission",
  drafts: "Drafts",
  screening: "Screening",
  wargame: "Wargame",
  cross_examination: "Cross-examination",
  revision: "Revision",
  comparison: "Comparison",
  decision: "Decision",
};

export const STAGE_ORDER = Object.keys(STAGE_LABEL) as StageId[];

/** "2:05" for playback seconds. */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
