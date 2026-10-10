import { childLogger } from "../../../lib/logger";
import { loadPrompt } from "../../prompts/registry";
import type { BoardPlan } from "../context";
import { seat } from "../seats";
import { runTurn } from "../turn";
import { RevisionAnswer } from "./answers";
import { say } from "./say";
import { wargame } from "./screening";
import { describePlan, type Session } from "./session";

/**
 * Stage 6: each author reads what was said about its plan and revises it, or
 * holds it with a reason. A seat changes its plan only on evidence; the change
 * and the evidence are on the record. The revised plan replaces the old one on
 * the shortlist and is scored again.
 */

export const REVISE_PROMPT = "v3";
const ARCHIVE = 3;
const log = childLogger({ module: "council.revision" });

async function revise(session: Session, plan: BoardPlan): Promise<void> {
  const author = seat(plan.by)!;
  const critiques = session.critiques.filter((item) => item.planId === plan.id);
  const premortem = session.premortem?.premortems.find((item) => item.planId === plan.id);
  const said = [
    ...critiques.map((item) => `${seat(item.by)?.title} (${item.answer.verdict}): ${item.answer.challenges.map((challenge) => challenge.claim).join(" ")} Strongest objection: ${item.answer.strongestObjection}`),
    premortem ? `Red Cell pre-mortem: ${premortem.failure} Evidence: ${premortem.evidence}` : "",
  ].filter(Boolean);
  const { value, seen } = await runTurn(session.deps, {
    seat: author,
    prompt: loadPrompt("council-revise", REVISE_PROMPT),
    input: {
      "Fact sheet": session.facts,
      "Your plan": describePlan(plan),
      "What the council said about it": said.length ? said : ["(nothing)"],
      "The best plans on the board so far, yours and others, including those made by code": best(session).map(describePlan).join("\n\n"),
      "Your premise": plan.premise ?? "",
    },
    answer: RevisionAnswer,
    toolSteps: 1,
  });
  session.turns += 1;
  const entry = session.deps.ctx.table({ by: author.id, premise: plan.premise, plan: value.plan });
  await session.deps.emit.emit("candidate", author.id, {
    planId: entry.id,
    by: author.id,
    premise: entry.premise,
    title: entry.plan.title,
    headline: value.headline,
    assignments: entry.plan.assignments,
    requests: entry.plan.requests,
    share: entry.plan.share,
    rationale: entry.plan.rationale,
    violations: entry.violations,
    baseline: false,
  });
  await wargame(session, [entry]);
  await say(session.deps, { from: author.id, to: critiques.map((item) => item.by), act: "revise", headline: value.headline, detail: value.changes, planId: entry.id, seen: [...seen, JSON.stringify(value.plan)] });
  // A revision the validator refuses does not replace a feasible plan.
  if (entry.violations.length === 0) session.shortlist = session.shortlist.map((id) => (id === plan.id ? entry.id : id));
}

/** The archive of the best-scored plans: authors edit good plans rather than start over (FunSearch, docs/council/research/04). */
function best(session: Session): BoardPlan[] {
  return session.deps.ctx
    .plans()
    .filter((entry) => entry.violations.length === 0)
    .sort((a, b) => b.score.expected - a.score.expected)
    .slice(0, ARCHIVE);
}

export async function revision(session: Session): Promise<void> {
  const plans = session.shortlist.map((id) => session.deps.ctx.plan(id)!).filter((plan) => seat(plan.by)?.premise);
  const settled = await Promise.allSettled(plans.map((plan) => revise(session, plan)));
  for (const result of settled) if (result.status === "rejected") log.warn({ err: String(result.reason) }, "a revision failed");
}
