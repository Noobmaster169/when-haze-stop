import { childLogger } from "../../../lib/logger";
import { loadPrompt } from "../../prompts/registry";
import type { BoardPlan } from "../context";
import { seat } from "../seats";
import { asPlan } from "../tools/plan-input";
import { runTurn } from "../turn";
import { CritiqueAnswer, PremortemAnswer } from "./answers";
import { join } from "./join";
import { say } from "./say";
import { wargame } from "./screening";
import { describePlan, type Session } from "./session";

/**
 * Stage 5: sparse, assigned critique (docs/council/05-protocol.md). Each plan
 * gets two seats whose mandates pull against it. A critic who thinks a change is better tables it as
 * a variant and the engine scores it on the spot. The Red Cell runs one
 * pre-mortem over the whole shortlist.
 */

export const CRITIQUE_PROMPT = "v3";
export const PREMORTEM_PROMPT = "v3";
const POOL = ["peat_science", "fire_operations", "air_operations", "treasury", "air_quality"];
const MAX_SHORTLIST = 7;
const log = childLogger({ module: "council.cross-examination" });

/** Two critics a plan, never its author, rotating so every seat questions several plans. */
function criticsFor(plan: BoardPlan, index: number): string[] {
  const pool = POOL.filter((id) => id !== plan.by);
  return [0, 1].map((k) => pool[(2 * index + k) % pool.length]);
}

async function critique(session: Session, plan: BoardPlan, critic: string): Promise<void> {
  const { value, seen } = await runTurn(session.deps, {
    seat: seat(critic)!,
    prompt: loadPrompt("council-critique", CRITIQUE_PROMPT),
    input: { "Fact sheet": session.facts, "The plan before you (author hidden)": describePlan(plan) },
    answer: CritiqueAnswer,
    // The plan and its scores are in front of the critic; a variant is scored when it is tabled. One call, for speed.
    toolSteps: 0,
  });
  session.turns += 1;
  session.critiques.push({ planId: plan.id, by: critic, answer: value });
  const act = value.verdict === "support" ? "support" : "challenge";
  const detail = [...value.challenges.map((item) => `${item.claim} [${item.kind === "fact" ? item.evidence : "judgement"}]`), `Strongest objection: ${value.strongestObjection}`].join("\n");
  await say(session.deps, { from: critic, to: [plan.by], act, headline: value.headline, detail, planId: plan.id, seen });
  if (!value.variant) return;

  const tried = session.deps.ctx.tryPlan(asPlan(value.variant));
  if (tried.violations.length > 0 || tried.score.expected <= plan.score.expected) return;
  const entry = session.deps.ctx.table({ by: critic, premise: `variant of ${plan.id}`, plan: { ...asPlan(value.variant), rationale: value.strongestObjection } });
  await session.deps.emit.emit("candidate", critic, {
    planId: entry.id,
    by: critic,
    premise: entry.premise,
    title: entry.plan.title,
    headline: `A variant of ${plan.id} that the engine scores higher.`,
    assignments: entry.plan.assignments,
    requests: [],
    share: null,
    rationale: entry.plan.rationale,
    violations: entry.violations,
    baseline: false,
  });
  await wargame(session, [entry]);
  if (session.shortlist.length < MAX_SHORTLIST) session.shortlist.push(entry.id);
}

async function premortem(session: Session, plans: BoardPlan[]): Promise<void> {
  const { value, seen } = await runTurn(session.deps, {
    seat: seat("red_cell")!,
    prompt: loadPrompt("council-premortem", PREMORTEM_PROMPT),
    input: { "Fact sheet": session.facts, "The shortlist": plans.map(describePlan).join("\n\n") },
    answer: PremortemAnswer,
    toolSteps: 1,
  });
  session.turns += 1;
  session.premortem = value;
  for (const item of value.premortems) {
    const plan = plans.find((entry) => entry.id === item.planId);
    if (!plan) continue;
    await say(session.deps, { from: "red_cell", to: [plan.by], act: "challenge", headline: item.headline, detail: `${item.failure}\nEvidence: ${item.evidence}`, planId: plan.id, seen });
  }
}

export async function crossExamine(session: Session): Promise<void> {
  const plans = session.shortlist.map((id) => session.deps.ctx.plan(id)!);
  const jobs = plans.flatMap((plan, index) => criticsFor(plan, index).map((critic) => ({ plan, critic })));
  await join(session, ["red_cell", ...jobs.map((job) => job.critic)]);
  const settled = await Promise.allSettled([...jobs.map((job) => critique(session, job.plan, job.critic)), premortem(session, plans)]);
  for (const result of settled) if (result.status === "rejected") log.warn({ err: String(result.reason) }, "a critique failed");
}
