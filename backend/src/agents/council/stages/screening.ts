import { biggestFirst, greedy, nearestFirst } from "../../../suppression/baselines";
import { type BoardPlan, summarise } from "../context";
import { join } from "./join";
import { say } from "./say";
import { councilPlans, type Session } from "./session";

/**
 * Stages 3 and 4, done by code: table the baselines the council must beat,
 * score everything, and keep a shortlist of feasible, distinguishable plans.
 * Two plans that send the same assets to mostly the same complexes are one
 * plan; the better scored stays. The best plan within accepted consent and the
 * best that needs a request both stay, so the verdict can show what asking is
 * worth.
 */

const SHORTLIST = 5;
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

const asks = (plan: BoardPlan) => plan.plan.assignments.some((line) => line.needsConsent !== null);

export async function tableBaselines(session: Session): Promise<void> {
  const { ctx } = session.deps;
  const made = [biggestFirst(ctx.attribution.complexes), nearestFirst(ctx.attribution.complexes, ctx.target.centre), greedy(ctx.attribution, false), greedy(ctx.attribution, true)];
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
  const must = [kept.find((plan) => !asks(plan)), kept.find(asks)].filter((plan): plan is BoardPlan => plan !== undefined);
  const top = [...must, ...kept.filter((plan) => !must.includes(plan))].slice(0, SHORTLIST).sort((a, b) => b.score.expected - a.score.expected);
  // The greedy plans contend too: the council must beat them on the record, or adopt them with its own judgement on what the engine cannot see.
  const greedy = session.deps.ctx.plans().filter((plan) => plan.baseline && plan.plan.title.startsWith("Greedy") && plan.violations.length === 0);
  session.shortlist = [...top, ...greedy].map((plan) => plan.id);
  const dropped = councilPlans(session).filter((plan) => !session.shortlist.includes(plan.id));
  await say(session.deps, {
    from: "engine",
    to: ["chair"],
    act: "brief",
    headline: `Shortlist: ${session.shortlist.join(", ")} go forward; ${dropped.length} set aside as infeasible or near-duplicates.`,
    detail: [
      ...top.map((plan) => `${plan.id} ${plan.plan.title}: expected ${(100 * plan.score.expected).toFixed(2)}% of the ceiling.`),
      ...dropped.map((plan) => `${plan.id} set aside: ${plan.violations.length ? "not feasible" : "same assets on mostly the same complexes as a better plan"}.`),
    ].join("\n"),
    seen: [],
  });
}
