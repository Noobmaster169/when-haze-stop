import { z } from "zod";

/**
 * Mirror of backend/src/contracts.council.ts and contracts.council-run.ts: the
 * Suppression Council's runs, the event log the page replays and the verdict
 * it ends with. Change one, change the other in the same commit.
 */

export const AssetKind = z.enum(["cl415", "helicopters", "ground_teams", "bomba_domestic", "ground_task_force"]);
export type AssetKind = z.infer<typeof AssetKind>;

export const Consent = z.enum(["sumatra", "ground_crews"]);
export type Consent = z.infer<typeof Consent>;

export const Assignment = z.object({
  complexId: z.string(),
  asset: AssetKind,
  units: z.number().int(),
  fromDay: z.number().int(),
  toDay: z.number().int(),
  needsConsent: Consent.nullable().default(null),
});
export type Assignment = z.infer<typeof Assignment>;

export const Violation = z.object({
  assignment: z.number().int().nullable(),
  rule: z.enum(["capacity", "mandate", "consent", "reach", "days", "unknown_complex", "asset_place", "budget"]),
  message: z.string(),
});
export type Violation = z.infer<typeof Violation>;

export const StageId = z.enum(["situation", "mission", "drafts", "screening", "wargame", "cross_examination", "revision", "comparison", "decision"]);
export type StageId = z.infer<typeof StageId>;

export const AgentKind = z.enum(["chair", "seat", "red", "engine", "analyst"]);
export type AgentKind = z.infer<typeof AgentKind>;

export const MessageAct = z.enum(["brief", "propose", "challenge", "support", "concede", "revise", "question", "answer", "dissent", "decide"]);
export type MessageAct = z.infer<typeof MessageAct>;

export const ScoreSummary = z.object({
  expected: z.number(),
  worstWind: z.number(),
  pessimistic: z.number(),
  optimistic: z.number(),
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
export type EventOf<K extends CouncilEventKind> = Extract<CouncilEvent, { kind: K }>;

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
  ceiling: z.number(),
  baselines: z.array(z.object({ planId: z.string(), title: z.string(), score: ScoreSummary })),
  series: z.object({ baseline: z.array(z.number()), withPlan: z.array(z.number()) }),
  maps: VerdictMaps.nullable().default(null),
  /** Where KL's coming smoke comes from, by area. Null on older runs. */
  sources: z.array(z.object({ area: z.string(), share: z.number() })).nullable().default(null),
  /** What the plan costs Malaysia against the money set aside, ringgit. Null on runs made before budgets. */
  cost: z.object({ total: z.number(), budget: z.number(), lines: z.array(z.object({ label: z.string(), rm: z.number() })) }).nullable().default(null),
});
export type Verdict = z.infer<typeof Verdict>;

export const RunStatus = z.enum(["queued", "running", "done", "failed"]);
export type RunStatus = z.infer<typeof RunStatus>;

export const CouncilRun = z.object({
  id: z.number().int(),
  target: z.string(),
  budgetRm: z.number().nullable().default(null),
  status: RunStatus,
  asOf: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  verdict: Verdict.nullable(),
  error: z.string().nullable(),
});
export type CouncilRun = z.infer<typeof CouncilRun>;

export const CouncilRunSummary = CouncilRun.omit({ verdict: true });
export type CouncilRunSummary = z.infer<typeof CouncilRunSummary>;

export const CouncilRunList = z.object({ runs: z.array(CouncilRunSummary) });
export type CouncilRunList = z.infer<typeof CouncilRunList>;

export const CouncilEventPage = z.object({ events: z.array(CouncilEvent), status: RunStatus });
export type CouncilEventPage = z.infer<typeof CouncilEventPage>;

/** The budgets a run can be given, ringgit; mirrors BudgetChoice in the backend contract. */
export const BUDGET_CHOICES = [4_000_000, 8_000_000, 12_000_000] as const;
export const DEFAULT_BUDGET_RM = 8_000_000;
export const BudgetChoice = z.union([z.literal(4_000_000), z.literal(8_000_000), z.literal(12_000_000)]);

/** What the start route answers: the run to follow, either new or the one already going. */
export const CouncilStart = z.object({ run: CouncilRunSummary, attached: z.boolean() });
export type CouncilStart = z.infer<typeof CouncilStart>;
