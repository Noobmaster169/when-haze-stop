import type { Assignment, StrikeLine, Verdict } from "../../../contracts";
import { mean, sharesByArea } from "../../../suppression/attribution";
import { planCost } from "../../../suppression/costs";
import { removedSeries, scorePlan } from "../../../suppression/score";
import { type BoardPlan, summarise } from "../context";
import type { DecisionAnswer } from "./answers";
import type { Session } from "./session";

/**
 * The verdict the page shows: the Chair's words, and around them only what
 * the engine and the board say: the strike list, the before and after series,
 * the baselines beside the chosen plan, and the ceiling every number is
 * measured against.
 */

const ASSET_WORDS: Record<Assignment["asset"], string> = {
  cl415: "CL-415",
  helicopters: "helicopters",
  ground_teams: "lance teams",
  bomba_domestic: "Bomba firefighters",
  ground_task_force: "Bomba ground task force",
};

function strikeList(session: Session, plan: BoardPlan): StrikeLine[] {
  const { ctx } = session.deps;
  const byComplex = new Map<string, Assignment[]>();
  for (const line of plan.plan.assignments) byComplex.set(line.complexId, [...(byComplex.get(line.complexId) ?? []), line]);
  return [...byComplex]
    .map(([id, lines]) => {
      const complex = ctx.complex(id)!;
      return {
        order: 0,
        complexId: id,
        place: complex.place.name,
        province: complex.place.province,
        country: complex.place.country,
        lat: complex.lat,
        lon: complex.lon,
        peatShare: complex.peatShare,
        assets: lines.map((line) => `${line.units} ${ASSET_WORDS[line.asset]}, days ${line.fromDay} to ${line.toDay}`).join("; "),
        fromDay: Math.min(...lines.map((line) => line.fromDay)),
        toDay: Math.max(...lines.map((line) => line.toDay)),
        waitsOn: lines.find((line) => line.needsConsent)?.needsConsent ?? null,
        share: scorePlan({ assignments: lines }, ctx.attribution).expected,
      };
    })
    // The order of attack: what starts first comes first, and among those the work that removes most smoke.
    .sort((a, b) => a.fromDay - b.fromDay || b.share - a.share)
    .map((line, index) => ({ ...line, order: index + 1 }));
}

function series(session: Session, plan: BoardPlan): Verdict["series"] {
  const { attribution } = session.deps.ctx;
  const members = attribution.members.length;
  const baseline = new Array<number>(attribution.hours).fill(0);
  const withPlan = new Array<number>(attribution.hours).fill(0);
  attribution.members.forEach((_, member) => {
    const removed = removedSeries(plan.plan, attribution, "central", member);
    for (let hour = 0; hour < attribution.hours; hour++) {
      baseline[hour] += attribution.baseline[member][hour] / members;
      withPlan[hour] += (attribution.baseline[member][hour] - removed[hour]) / members;
    }
  });
  const round = (values: number[]) => values.map((value) => Math.round(value * 100) / 100);
  return { baseline: round(baseline), withPlan: round(withPlan) };
}

export function buildVerdict(session: Session, plan: BoardPlan, words: DecisionAnswer): Verdict {
  const { ctx } = session.deps;
  return {
    planId: plan.id,
    title: plan.plan.title,
    headline: words.headline,
    actNow: words.actNow,
    ask: words.ask,
    share: words.share,
    reasoning: words.reasoning,
    minorityReport: words.minorityReport,
    replanTrigger: words.replanTrigger,
    strikeList: strikeList(session, plan),
    score: summarise(plan.score),
    ceiling: ctx.attribution.ceiling.reduce((sum, member) => sum + mean(member), 0) / ctx.attribution.ceiling.length,
    baselines: ctx.plans().filter((entry) => entry.baseline).map((entry) => ({ planId: entry.id, title: entry.plan.title, score: summarise(entry.score) })),
    series: series(session, plan),
    sources: sharesByArea(ctx.attribution),
    // Filled by the run from the engine once the plan is chosen: it costs two full engine runs per wind member.
    maps: null,
    cost: { ...planCost(plan.plan), budget: ctx.budgetRm },
  };
}
