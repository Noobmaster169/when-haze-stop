import type { StageId, Verdict } from "../../contracts";
import { childLogger } from "../../lib/logger";
import type { SuppressionEngine } from "../../services/suppression-engine";
import { mean, sharesByArea } from "../../suppression/attribution";
import { DEFAULT_BUDGET_RM, ringgit } from "../../suppression/costs";
import { keepTable } from "../../suppression/score";
import type { TargetArea } from "../../suppression/targets";
import type { LlmClient } from "../llm-client";
import type { StructuredDeps } from "../structured";
import { councilContext } from "./context";
import type { Emitter } from "./events";
import { factSheet } from "./situation";
import { comparison } from "./stages/comparison";
import { crossExamine } from "./stages/cross-examination";
import { decision } from "./stages/decision";
import { drafts } from "./stages/drafts";
import { join } from "./stages/join";
import { mission } from "./stages/mission";
import { revision } from "./stages/revision";
import { say } from "./stages/say";
import { screen, tableBaselines, wargame } from "./stages/screening";
import type { Session } from "./stages/session";
import { meanOf } from "./tools/format";

/**
 * One council run, start to verdict (docs/council/05-protocol.md): the engine
 * posts the situation, the Chair freezes the mission, the seats draft blind,
 * code screens and scores, critics and the Red Cell attack, authors revise,
 * owners rate, the rule decides and the Chair explains. Everything that
 * happens is an event, so the page can replay it.
 */

const log = childLogger({ module: "council.run" });
/** Rounds of critique and revision: more run only while the leading plan keeps changing. */
const MAX_ROUNDS = 3;

const TITLES: Record<StageId, string> = {
  situation: "The situation",
  mission: "The mission",
  drafts: "Independent drafts",
  screening: "Screening",
  wargame: "The engine scores every plan",
  cross_examination: "Cross-examination",
  revision: "Revision",
  comparison: "Comparison",
  decision: "Decision",
};
const ORDER = Object.keys(TITLES) as StageId[];

export interface CouncilDeps extends StructuredDeps {
  engine: SuppressionEngine;
  emit: Emitter;
  /** Told the hour of data the council reasons over, once it is known. */
  onAsOf?(asOf: Date): Promise<void>;
}

const topByEngine = (session: Session) =>
  [...session.shortlist].sort((a, b) => session.deps.ctx.plan(b)!.score.expected - session.deps.ctx.plan(a)!.score.expected)[0];

/** The region without and with the chosen plan, at the hour the plan helps most. */
async function verdictMaps(engine: SuppressionEngine, session: Session, verdict: Verdict): Promise<Verdict["maps"]> {
  const chosen = session.deps.ctx.plan(verdict.planId);
  if (!chosen) return null;
  const gains = verdict.series.baseline.map((value, hour) => value - verdict.series.withPlan[hour]);
  const hour = gains.indexOf(Math.max(...gains));
  return engine.simulate({ keep: keepTable(chosen.plan, session.deps.ctx.attribution, "central"), hour: Math.max(0, hour) });
}

export async function runCouncil(deps: CouncilDeps, target: TargetArea, budgetRm: number = DEFAULT_BUDGET_RM): Promise<Verdict> {
  const started = Date.now();
  const attribution = await deps.engine.attribute({ target });
  await deps.onAsOf?.(new Date(attribution.asOf));
  const ctx = councilContext(attribution, target, budgetRm);
  let calls = 0;
  const llm: LlmClient = {
    complete(request, signal) {
      calls += 1;
      return deps.llm.complete(request, signal);
    },
  };
  const session: Session = {
    deps: { llm, pool: deps.pool, signal: deps.signal, emit: deps.emit, ctx },
    facts: factSheet(ctx),
    mission: null,
    premises: new Map(),
    shortlist: [],
    critiques: [],
    premortem: null,
    ratings: [],
    turns: 0,
    joined: new Set(),
  };
  const stage = (id: StageId) => deps.emit.emit("stage", "system", { stage: id, title: TITLES[id], index: ORDER.indexOf(id) + 1, of: ORDER.length });

  await deps.emit.emit("run_started", "system", { target: target.id, targetName: target.name, asOf: attribution.asOf, dayOne: attribution.dayOne, daysInTheatre: attribution.days, budgetRm });
  await stage("situation");
  await join(session, ["engine"]);
  const ranked = [...attribution.contributions.keys()].map((id) => meanOf(ctx.shares(id) ?? [0])).sort((a, b) => b - a);
  const ceiling = attribution.ceiling.reduce((sum, member) => sum + mean(member), 0) / attribution.ceiling.length;
  await say(session.deps, {
    from: "engine",
    to: ["chair"],
    act: "brief",
    headline: `${attribution.complexes.length} groups of fires are burning. Just ten of them make ${(100 * ranked.slice(0, 10).reduce((sum, value) => sum + value, 0)).toFixed(0)}% of the smoke heading for KL.`,
    detail: `Where the smoke heading for KL comes from: ${sharesByArea(attribution).map((item) => `${item.area} ${(100 * item.share).toFixed(0)}%`).join(", ")}.\n\nIf every fire went out from day 1, KL's air would be about ${ceiling.toFixed(1)} ug/m3 of PM2.5 cleaner on average over the next ${attribution.days} days. That is the most any plan could do. The money available is ${ringgit(budgetRm)}.\n\n${session.facts}`,
    seen: [session.facts],
  });

  await stage("mission");
  await mission(session);
  await stage("drafts");
  await drafts(session);
  await stage("screening");
  await tableBaselines(session);
  await screen(session);
  await stage("wargame");
  await wargame(session, ctx.plans().filter((plan) => plan.baseline || session.shortlist.includes(plan.id)));

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const before = topByEngine(session);
    await stage("cross_examination");
    await crossExamine(session);
    await stage("revision");
    await revision(session);
    const stable = topByEngine(session) === before;
    if (stable) break;
    // A further round looks only at the contenders.
    session.shortlist = [...session.shortlist].sort((a, b) => ctx.plan(b)!.score.expected - ctx.plan(a)!.score.expected).slice(0, 3);
  }

  await stage("comparison");
  await comparison(session);
  await stage("decision");
  const verdict = await decision(session);
  verdict.maps = await verdictMaps(deps.engine, session, verdict);
  const seconds = Math.round((Date.now() - started) / 1000);
  await deps.emit.emit("run_finished", "system", { seconds, calls });
  log.info({ seconds, calls, turns: session.turns, plan: verdict.planId }, "council run finished");
  return verdict;
}
