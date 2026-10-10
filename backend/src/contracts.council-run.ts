import { z } from "zod";

import { Assignment, Consent, Violation } from "./contracts.council";

/**
 * A Suppression Council run as the page replays it: the append-only event log
 * the run writes as it goes, and the verdict it ends with. See
 * docs/council/08-replay-events.md.
 *
 * Re-exported from contracts.ts and mirrored by hand as zod schemas in
 * frontend/lib/api/council-schemas.ts. Change one, change the other in the
 * same commit.
 */

export const StageId = z.enum(["situation", "mission", "drafts", "screening", "wargame", "cross_examination", "revision", "comparison", "decision"]);
export type StageId = z.infer<typeof StageId>;

export const AgentKind = z.enum(["chair", "seat", "red", "engine", "analyst"]);
export type AgentKind = z.infer<typeof AgentKind>;

export const MessageAct = z.enum(["brief", "propose", "challenge", "support", "concede", "revise", "question", "answer", "dissent", "decide"]);
export type MessageAct = z.infer<typeof MessageAct>;

export const ScoreSummary = z.object({
  /** Shares of the ceiling, 0 to 1: central mean over wind members, the worst member, and the two other scenarios. */
  expected: z.number(),
  worstWind: z.number(),
  pessimistic: z.number(),
  optimistic: z.number(),
  /** Central, mean over members: ug/m3 removed on average and at the peak, hours over API 100 avoided. */
  meanRemoved: z.number(),
  peakRemoved: z.number(),
  hoursOver100Avoided: z.number(),
  arrivalHours: z.number().nullable(),
});
export type ScoreSummary = z.infer<typeof ScoreSummary>;

const event = <K extends string, P extends z.ZodTypeAny>(kind: K, payload: P) =>
  z.object({ seq: z.number().int(), at: z.string(), actor: z.string(), kind: z.literal(kind), payload });

export const CouncilEvent = z.discriminatedUnion("kind", [
  event("run_started", z.object({ target: z.string(), targetName: z.string(), asOf: z.string(), dayOne: z.string(), daysInTheatre: z.number().int(), budgetRm: z.number().optional() })),
  event("stage", z.object({ stage: StageId, title: z.string(), index: z.number().int(), of: z.number().int() })),
  event("agent_joined", z.object({ agent: z.string(), kind: AgentKind, title: z.string(), institution: z.string(), parent: z.string().nullable() })),
  event("thinking", z.object({ agent: z.string(), gist: z.string() })),
  event("tool_call", z.object({ callId: z.string(), agent: z.string(), tool: z.string(), args: z.record(z.string(), z.unknown()) })),
  event("tool_result", z.object({ callId: z.string(), agent: z.string(), ok: z.boolean(), preview: z.string() })),
  event(
    "message",
    z.object({
      id: z.string(),
      from: z.string(),
      to: z.array(z.string()),
      act: MessageAct,
      headline: z.string(),
      detail: z.string(),
      planId: z.string().nullable(),
      /** Numbers in the message that appear in nothing the sender was shown. */
      unverified: z.array(z.string()),
    }),
  ),
  event(
    "candidate",
    z.object({
      planId: z.string(),
      by: z.string(),
      premise: z.string().nullable(),
      title: z.string(),
      headline: z.string(),
      assignments: z.array(Assignment),
      requests: z.array(z.string()),
      share: z.string().nullable(),
      rationale: z.string(),
      violations: z.array(Violation),
      /** A plan made by code, not by the council: a baseline to beat. */
      baseline: z.boolean(),
    }),
  ),
  event("simulation", z.object({ planId: z.string(), score: ScoreSummary })),
  event("vote", z.object({ agent: z.string(), ratings: z.array(z.object({ planId: z.string(), score: z.number(), note: z.string() })) })),
  event("verdict", z.object({ planId: z.string() })),
  event("run_finished", z.object({ seconds: z.number(), calls: z.number().int() })),
  event("run_failed", z.object({ error: z.string() })),
]);
export type CouncilEvent = z.infer<typeof CouncilEvent>;
export type CouncilEventKind = CouncilEvent["kind"];

export const StrikeLine = z.object({
  order: z.number().int(),
  complexId: z.string(),
  place: z.string(),
  province: z.string(),
  country: z.string(),
  lat: z.number(),
  lon: z.number(),
  peatShare: z.number(),
  assets: z.string(),
  fromDay: z.number().int(),
  toDay: z.number().int(),
  waitsOn: Consent.nullable(),
  /** Central, mean over wind members: the share of the ceiling this complex's suppression removes. */
  share: z.number(),
});
export type StrikeLine = z.infer<typeof StrikeLine>;

/** The engine's 24-hour PM2.5 over the region at the hour the plan helps most, without and with it. */
export const VerdictMaps = z.object({
  at: z.string(),
  grid: z.object({ lon0: z.number(), lat0: z.number(), step: z.number(), nx: z.number().int(), ny: z.number().int() }),
  /** ug/m3 per field cell, row-major from the south-west corner, one byte each (capped at 255), base64. */
  before: z.string(),
  after: z.string(),
  /** The engine's smoke and calibration, without the map's corrections towards the stations' readings. */
  note: z.string(),
});
export type VerdictMaps = z.infer<typeof VerdictMaps>;

export const Verdict = z.object({
  planId: z.string(),
  title: z.string(),
  headline: z.string(),
  actNow: z.string(),
  ask: z.string(),
  share: z.string(),
  reasoning: z.string(),
  minorityReport: z.string(),
  replanTrigger: z.string(),
  strikeList: z.array(StrikeLine),
  score: ScoreSummary,
  /** Mean over wind members of the most every fire out from day 1 could remove, ug/m3. */
  ceiling: z.number(),
  baselines: z.array(z.object({ planId: z.string(), title: z.string(), score: ScoreSummary })),
  /** The target's 24-hour PM2.5 each hour from the data's hour, central, mean over members: without and with the plan. */
  series: z.object({ baseline: z.array(z.number()), withPlan: z.array(z.number()) }),
  maps: VerdictMaps.nullable().default(null),
  /** Where the target's coming smoke comes from, by area, as parts of the most that could be removed. Null on older runs. */
  sources: z.array(z.object({ area: z.string(), share: z.number() })).nullable().default(null),
  /** What the plan costs Malaysia against the money set aside, ringgit. */
  cost: z.object({ total: z.number(), budget: z.number(), lines: z.array(z.object({ label: z.string(), rm: z.number() })) }).nullable().default(null),
});
export type Verdict = z.infer<typeof Verdict>;

export const RunStatus = z.enum(["queued", "running", "done", "failed"]);
export type RunStatus = z.infer<typeof RunStatus>;

export const CouncilRun = z.object({
  id: z.number().int(),
  target: z.string(),
  /** The money the run was given, ringgit; null on runs made before budgets. */
  budgetRm: z.number().nullable(),
  status: RunStatus,
  asOf: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  verdict: Verdict.nullable(),
  error: z.string().nullable(),
});
export type CouncilRun = z.infer<typeof CouncilRun>;

export const BudgetChoice = z.union([z.literal(4_000_000), z.literal(8_000_000), z.literal(12_000_000)]);
export const StartCouncilRequest = z.object({ target: z.literal("klang-valley"), budgetRm: BudgetChoice.default(8_000_000) });
export type StartCouncilRequest = z.infer<typeof StartCouncilRequest>;

export const CouncilRunList = z.object({ runs: z.array(CouncilRun.omit({ verdict: true })) });
export type CouncilRunList = z.infer<typeof CouncilRunList>;

export const CouncilEventPage = z.object({ events: z.array(CouncilEvent), status: RunStatus });
export type CouncilEventPage = z.infer<typeof CouncilEventPage>;
