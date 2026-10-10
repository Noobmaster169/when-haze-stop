import { biggestFirst, GREEDY_TITLE, greedy, nearestFirst } from "../../../suppression/baselines";
import { type BoardPlan, summarise } from "../context";
import { join } from "./join";
import { say } from "./say";
import { councilPlans, type Session } from "./session";

/**
 * Stages 3 and 4, done by code: table the baselines the council must beat,
 * score everything, and keep a shortlist of feasible, distinguishable plans.
 * Two plans that send the same assets to mostly the same complexes are one
 * plan; the better scored stays.
 */

const SHORTLIST = 4;
const SAME = 0.75;

function lines(plan: BoardPlan): Set<string> {
  return new Set(plan.plan.assignments.map((line) => `${line.complexId}|${line.asset}`));
}

function overlap(a: BoardPlan, b: BoardPlan): number {
  const x = lines(a);
  const y = lines(b);
  const shared = [...x].filter((item) => y.has(item)).length;
  return shared / Math.max(1, new Set([...x, ...y]).size);
}


export async function tableBaselines(session: Session): Promise<void> {
  const { ctx } = session.deps;
  const made = [
    biggestFirst(ctx.attribution.complexes, ctx.budgetRm),
    nearestFirst(ctx.attribution.complexes, ctx.target.centre, ctx.budgetRm),
    greedy(ctx.attribution, ctx.budgetRm),
  ];
  for (const draft of made) {
    if (!draft) continue;
    const entry = ctx.table({ by: "engine", premise: null, baseline: true, plan: { ...draft, requests: [], share: null, rationale: "", assumptions: [], confidence: 0, dependsOn: "" } });
    await session.deps.emit.emit("candidate", "engine", {
      planId: entry.id,
      by: "engine",
      premise: null,
      title: entry.plan.title,
      headline: entry.plan.title,
      assignments: entry.plan.assignments,
      requests: [],
      share: null,
      rationale: "Made by code, without the council: a plan to beat.",
      violations: entry.violations,
      baseline: true,
    });
  }
}

export async function wargame(session: Session, plans: BoardPlan[]): Promise<void> {
  await join(session, ["engine"]);
  for (const plan of plans) await session.deps.emit.emit("simulation", "engine", { planId: plan.id, score: summarise(plan.score) });
}

export async function screen(session: Session): Promise<void> {
  const feasible = councilPlans(session)
    .filter((plan) => plan.violations.length === 0)
    .sort((a, b) => b.score.expected - a.score.expected);
  const kept: BoardPlan[] = [];
  for (const plan of feasible) if (!kept.some((other) => overlap(plan, other) >= SAME)) kept.push(plan);
  const top = kept.slice(0, SHORTLIST);
  // The greedy plans contend too: the council must beat them on the record, or adopt them with its own judgement on what the engine cannot see.
  const greedy = session.deps.ctx.plans().filter((plan) => plan.baseline && plan.plan.title === GREEDY_TITLE && plan.violations.length === 0);
  session.shortlist = [...top, ...greedy].map((plan) => plan.id);
  const dropped = councilPlans(session).filter((plan) => !session.shortlist.includes(plan.id));
  await say(session.deps, {
    from: "engine",
    to: ["chair"],
    act: "brief",
    headline: `${session.shortlist.length} plans go forward to be questioned, ${greedy.length} of them worked out by computer. ${dropped.length} set aside.`,
    detail: [
      ...[...top, ...greedy].map((plan) => `${plan.plan.title} (${plan.id}): would remove about ${(100 * plan.score.expected).toFixed(0)}% of the smoke any plan could remove.`),
      ...dropped.map((plan) => `${plan.plan.title} (${plan.id}) set aside: ${plan.violations.length ? plan.violations[0].message : "it sends the same help to mostly the same fires as a better plan"}.`),
    ].join("\n"),
    seen: [],
  });
}
