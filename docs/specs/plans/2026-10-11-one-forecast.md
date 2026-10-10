# One forecast, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the learned model the one forecast a person sees past today, with the smoke simulation shaping its hours and explaining it, every number labelled with its source, and the live record beside the claim.

**Architecture:** A foundation commit fixes the contracts, the migration, the repository reads and writes, the model service's `/report` and a `forecast-source` service. Four tracks then run in parallel on disjoint files: A reshapes the station outlook to the learned peaks and writes the reason; B corrects the run's future frames to the learned values at every instrument; C puts the chips, the caption and the labels on the map and the panel; D adds the live record (tiles, watch, ledger) to the existing Model page.

**Tech Stack:** TypeScript strict, Express 5, pg, zod 4, vitest against the compose Postgres (`haze_test`); Next 16, React 19, Tailwind 4; Python 3.12, FastAPI, pytest for the model service.

**Spec:** `docs/specs/2026-10-11-one-forecast-design.md`. Section numbers below refer to it.

## Global Constraints

- Everything in `CLAUDE.md`: strict TypeScript, no `any`, named exports, files under 200 lines, kebab-case files, zod at every boundary, `RetryableError` / `TerminalError` / `UpstreamError`, never `catch {}`, pino per module, config only from `config.ts`, comments say why, no emoji, no em dashes.
- `repositories/` owns all SQL. `haze/` stays pure: no database, no network, no config.
- Never delete, truncate or overwrite anything in any database. Migration `009` is forward-only and never edited once applied.
- Real data only. Fixtures are recorded values. The learned issue fixture in this plan is the real 10 October 2026 00:00 UTC issue, copied from the compose database.
- Contracts in `backend/src/contracts*.ts` and their zod mirrors in `frontend/lib/api/*-schemas.ts` change in the same commit.
- Frontend: read `frontend/AGENTS.md` before writing Next code. Components never import `lib/api/transport.ts`.
- Run backend commands inside `backend/`, frontend inside `frontend/`, model inside `model/`. Postgres and the model service must be up: `docker compose up -d postgres model` from the root.
- Another session is committing to `haze-product` at the same time. Touch only the files your track names. Do not edit `docs/FEATURES.md`, `backend/src/jobs/ingest-openaq.ts`, `backend/src/repositories/source-fetches.repo.ts` or `backend/test/jobs/history-observations.test.ts`.
- Commit per task, message imperative, one line, blank line, then exactly `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Stage only your own files by name; never `git add -A`.

## Review Focus

1. A station with a learned row for tomorrow but a `physics` series of all zeros (no smoke within 50 km). Expected: a flat line at the learned median for that day, not a division by zero. Pinned in A1.
2. The learned issue is older than `LEARNED_STALE_HOURS` against the run. Expected: no reshaping, no frame correction, every day labelled `hourly`, the caption says so. Pinned in A3 and B3.
3. The physics peak falls in the first three hours of the first learned day. Expected: the ramp ends at the peak hour and the day's maximum still equals the learned median. Pinned in A1.
4. An instrument with a learned row that lies outside the field (an OpenAQ sensor off the grid). Expected: skipped by the frame correction, nothing throws. Pinned in B1.
5. `MODEL_MODE=shadow`: the outlook, the frames and the map response must be byte-identical to today's except for the new labels. Pinned in A3, B3 and C2.

---

## Foundation (done first, one commit, by the planner)

**Files:**
- Create: `backend/db/migrations/009_learned_frames.sql`
- Modify: `backend/src/contracts.haze.ts`, `backend/src/contracts.ts`
- Create: `backend/src/contracts.model.ts`
- Modify: `backend/src/repositories/forecasts.repo.ts`, `backend/src/repositories/model-forecasts.repo.ts`
- Modify: `backend/src/sources/model.ts`, `backend/src/sources/__fakes__/fake.model.ts`
- Create: `backend/src/services/forecast-source.ts`
- Modify: `backend/src/services/outlook.ts` (minimal: `source` on the context and the outlook, `source`/`why` on each day), `backend/src/services/map.ts` (minimal: `source`, `learnedFrom: null`)
- Modify: `backend/src/app.ts`, `backend/src/routes/haze.routes.ts`, `backend/src/index.ts` (a `model: ModelClient | null` dependency)
- Create: `backend/test/fixtures/recorded-model-issue.ts`, `backend/test/fixtures/recorded-model-report.ts`
- Modify: `model/src/hazemodel/serve.py`, `model/tests/test_serve.py`, `compose.yaml`
- Modify: `frontend/lib/api/haze-schemas.ts`; create `frontend/lib/api/model-schemas.ts`, `frontend/lib/api/model-client.ts`, `frontend/app/api/haze/model/route.ts`; modify `frontend/lib/api-client.ts`

**Interfaces produced (every track consumes these; do not rename):**

```ts
// contracts.haze.ts
export const ForecastSourceKind = z.enum(["learned", "hourly"]);
export const ForecastRecord = z.object({
  checkedDays: z.number().int(),
  gain: z.number().nullable(),
  backtest: z.object({ model: z.number(), persistence: z.number(), v2: z.number() }).nullable(),
});
export const ForecastSource = z.object({
  kind: ForecastSourceKind,
  modelVersion: z.string().nullable(),
  issuedAt: z.string().nullable(),
  trial: z.boolean(),
  record: ForecastRecord,
});
// DayOutlook gains:   source: ForecastSourceKind, why: z.string().nullable()
// StationOutlook gains: source: ForecastSource
// HazeMap gains:      source: ForecastSource.nullable(), learnedFrom: z.string().nullable()

// contracts.model.ts
export const ModelLedgerRow = z.object({
  asOf: z.string(), stationId: z.string(), stationName: z.string(), day: z.string(), leadDays: z.number().int(),
  forecast: z.number().int(), low: z.number().int(), high: z.number().int(), observed: z.number().int(),
  miss: z.number(), persistenceMiss: z.number().nullable(), v2Miss: z.number().nullable(),
});
export const ModelLive = z.object({
  source: ForecastSource,
  skill: ModelSkill,
  nextCheckAt: z.string().nullable(),
  watch: z.array(StationOutlook),
  ledger: z.array(ModelLedgerRow),
});

// repositories/forecasts.repo.ts
insertRun(db, asOf, kind, calibration, grid = GRID_KEY, learnedVersion: string | null = null): Promise<number>
insertStationForecasts(db, runId, forecasts: { stationId: string; api: Float32Array; physics?: Float32Array }[]): Promise<void>
stationPhysics(db, runId, stationId): Promise<number[] | null>
latestLearnedVersion(db, runId): Promise<string | null>

// repositories/model-forecasts.repo.ts
export interface LearnedIssue { asOf: Date; modelVersion: string; byInstrument: Map<string, Map<string, ModelDay>> }
latestIssue(db, notBefore: Date): Promise<LearnedIssue | null>   // newest as_of >= notBefore, from the version stored most recently
// ScoreRow gains p10 and p90

// sources/model.ts
export interface ModelReport { version: string; trainedAt: Date; promotionScore: number | null;
  hazyMae: { d1: { model: number; persistence: number; v2: number } | null; d2: {...} | null } }
ModelClient gains report(): Promise<ModelReport>
FakeModelClient takes an optional third argument, the report

// services/forecast-source.ts
forecastSource(db, mode: ModelMode, model: ModelClient | null, runAsOf: Date | null): Promise<ForecastSource>
// kind is "learned" only when mode is live and latestIssue(db, runAsOf - LEARNED_STALE_HOURS) exists.
// record.backtest is the memoised report (5 minutes), null when the service is unreachable (logged, never thrown).

// services/outlook.ts
export interface OutlookContext { asOf; runId; errorsFor; learned: boolean; source: ForecastSource }
outlookContext(db, mode = config.MODEL_MODE, model: ModelClient | null = null)
```

Tests in the foundation: `test/sources/model.test.ts` parses the recorded report; `test/repositories/model-forecasts.test.ts` for `latestIssue`; `model/tests/test_serve.py` for `/report`; the existing suites still pass with the new fields present (`source: hourly`, `why: null`).

---

## Track A: the outlook follows the learned peaks

**Files:**
- Create: `backend/src/haze/reshape.ts`, `backend/src/haze/why.ts`
- Modify: `backend/src/services/outlook.ts`
- Modify: `backend/src/agents/chat/tools/get-forecast.ts`
- Create: `backend/src/agents/prompts/chat/v5.md` (copy of v4 plus the trust sentence), `backend/src/agents/chat/skills/haze-decision/SKILL.md` version 4
- Modify: `backend/src/agents/chat/loop.ts` (`CHAT_PROMPT` bump)
- Tests: `backend/test/haze/reshape.test.ts`, `backend/test/haze/why.test.ts`, `backend/test/services/outlook.test.ts`, `backend/test/agents/tools.test.ts` (or wherever `get_forecast` is tested)

**Interfaces:**
- Consumes: `stationPhysics`, `latestIssue`, `OutlookContext.source`, `ModelDay` from `haze/outlook.ts`.
- Produces (B and C read nothing from A; the contract is fixed):

```ts
// haze/reshape.ts
export interface ReshapeInput {
  asOf: Date;
  /** PM2.5 per hour from asOf + 1, the hourly forecast converted with apiToPm25. */
  hourly: number[];
  /** Calibrated smoke PM2.5 per hour, same indices, or null for a run before migration 009. */
  physics: number[] | null;
  learned: ReadonlyMap<string, ModelDay>;
}
export const RAMP_HOURS = 3;
export function reshapeToLearned(input: ReshapeInput): number[]
// Rules 1 to 4 of spec section 3. Today's hours untouched. For a learned day D (localDay of the hour):
//   s = physics slice for D (0s when physics is null); sPeak, sMin
//   r = sPeak > sMin ? clamp((p50 - p10) / (sPeak - sMin), 0, 1) : 0
//   pm25(h) = p50 - (sPeak - s(h)) * r
// Ramp: over the first RAMP_HOURS of the first day whose source differs from the previous hour's, linear from the
// previous hour's value to the shaped value, stopping early at the day's peak hour.

// haze/why.ts
export const SMOKE_MATTERS_UGM3 = 5;
export function whyFor(input: { physicsDay: number[]; hourOfPeak: number; windFromDeg: number | null }): string
// "Simulated smoke peaks around 15:00 on a north-east wind." when max(physicsDay) - min(physicsDay) >= 5, else
// "Little simulated smoke reaches here; the forecast rests on the current level and trend."
// Compass from windFromDeg in 8 points; without wind the sentence ends at the hour.
```

### A1: `reshape.ts`

- [ ] Write `test/haze/reshape.test.ts` on the recorded Seremban (CA24N) hourly series from `test/fixtures/recorded.ts` and the learned rows from `recorded-model-issue.ts`:
  - each learned day's maximum equals `p50` within 0.01
  - the dip never passes below `p10`
  - a physics series of zeros gives a flat day at `p50` (Review Focus 1)
  - the ramp never moves the peak hour when the peak sits in hour 1 of the day (Review Focus 3)
  - a day with no learned row is unchanged
  - an empty `learned` map returns `hourly` unchanged
- [ ] Run, see it fail, implement, run, commit.

### A2: `why.ts`

- [ ] Test both sentences, the 5 ug/m3 line, the eight compass points and the no-wind form. Implement. Commit.

### A3: the outlook service

- [ ] In `outlookFor`: read `physics` with `stationPhysics`, convert `api` to PM2.5, call `reshapeToLearned`, convert back for `forecast`; set `days[].source` (`learned` where a learned row was used, else `hourly`); build `why` for learned days from the physics slice and `weather.windAt` at the peak hour at the station's grid point (bilinear through the pure helper already in `haze/wind-at.ts`, or a 1 degree nearest point if that helper is day-only; say which in the commit).
- [ ] Extend `test/services/outlook.test.ts`: after the recorded cycle and `runModelForecast` with the real issue fixture, for CA24N in `live` the line's maximum on each learned day equals `days[i].forecastPeak`; in `shadow` the `forecast` array equals today's (Review Focus 5); a stale issue leaves every day `hourly` (Review Focus 2).
- [ ] Commit.

### A4: the assistant

- [ ] `get-forecast.ts` adds `source` to its result and labels its chip "Learned model <version>" or "Hourly forecast". `v5.md` and the skill carry: "When the answer leans on a day ahead or more, say it is the learned model's forecast and give its record from the result's source: the backtest gain on hazy days and the live days checked." Update the tool test. Bump `CHAT_PROMPT`. Commit.

---

## Track B: the map's future is the learned forecast

**Files:**
- Modify: `backend/src/haze/field.ts` (add `correctToPoints`)
- Create: `backend/src/haze/learned-frames.ts`
- Modify: `backend/src/haze/run.ts` (optional `instruments`, `learned` inputs; `physics` per station; frame correction via `learned-frames.ts`)
- Modify: `backend/src/jobs/forecast.ts` (load the issue and the instruments in live mode; store `physics` and `learned_version`), `backend/src/jobs/cycle.ts` (model ask before the run), `backend/src/services/map.ts` (`learnedFrom`)
- Tests: `backend/test/haze/model.test.ts` (or a new `learned-frames.test.ts`), `backend/test/jobs/cycle.test.ts`, `backend/test/services/map.test.ts` (new)

**Interfaces:**

```ts
// haze/field.ts
export function sampleAt(field: Float32Array, lat: number, lon: number): number   // bilinear on the field grid
export function correctToPoints(pm25: Float32Array, points: { lat: number; lon: number; pm25: number }[]): Float32Array
// difference = point.pm25 - sampleAt(pm25, point); spread with spreadErrors; added. Points outside the domain skipped.

// haze/learned-frames.ts
export interface LearnedInstrument { id: string; lat: number; lon: number; days: ReadonlyMap<string, ModelDay> }
export function learnedTargets(start: Date, hour: number, instruments: LearnedInstrument[], physicsAt: (lat, lon, hour) => number): { lat; lon; pm25 }[]
// For the Malaysian day of `hour`, each instrument with a row: rule 2 of section 3 using the instrument's physics over that day.

// haze/run.ts
RunInput gains: instruments?: LearnedInstrument[]
RunOutput.forecasts[] gains: physics: Float32Array
RunOutput gains: learnedVersion: string | null
```

### B1: `correctToPoints` and `sampleAt`

- [ ] Tests: one point moves its own cell to the target within 0.5 ug/m3 and leaves a cell 400 km away unchanged; no points returns the input; a point outside the domain is skipped (Review Focus 4). Implement. Commit.

### B2: `learned-frames.ts` and the run

- [ ] Test on the recorded run input plus the real issue fixture: for a future frame on 11 October (Malaysian), the decoded field at CA24N's cell is within 2 API points of `pm25ToApi` of CA24N's rule 2 value at that hour; frames at or before `asOf` are unchanged; a run without `instruments` is byte-identical to today's. Implement. Commit.

### B3: the job, the cycle and the map

- [ ] `jobs/forecast.ts`: in `live` mode load `latestIssue(pool, addHours(asOf, -LEARNED_STALE_HOURS))` and `listInstruments(pool)`, hand both to the run, store `physics` and `learned_version`. In `shadow` or `off` pass nothing (Review Focus 5). `cycle.ts`: move the model ask before `runForecast`. `services/map.ts`: `learnedFrom` is the first future frame's `validAt` when the run has a `learned_version`, else null; `source` from `forecastSource`.
- [ ] `test/jobs/cycle.test.ts`: the order of fetches shows the model asked before the run. `test/services/map.test.ts`: `learnedFrom` null in shadow, set in live. Commit.

---

## Track C: the map and the panel say whose forecast it is

**Files:**
- Modify: `frontend/components/map/timeline.tsx`, `frontend/components/map/use-time-travel.ts`, `frontend/components/map/haze-map.tsx`
- Create: `frontend/components/map/forecast-caption.tsx`, `frontend/components/map/jump-chips.tsx`, `frontend/components/map/forecast-moments.ts`
- Modify: `frontend/components/map/station-panel.tsx`, `frontend/components/map/day-rows.tsx`
- Tests: `frontend/components/map/forecast-moments.test.ts`, `frontend/components/map/forecast-caption.test.ts` (the wording function, pure)

**Interfaces:**

```ts
// forecast-moments.ts (pure, Malaysian time through lib/malaysia-time.ts)
export interface Moment { key: "now" | "tonight" | "tomorrow" | "dayAfter"; label: string; at: number }
export function forecastMoments(asOfMs: number, lastFrameMs: number): Moment[]   // tonight 20:00 today, tomorrow 14:00, day after 14:00, clamped to lastFrameMs; a moment past the last frame is dropped
// forecast-caption.tsx exports captionFor(at: number, asOfMs: number, source: ForecastSource | null, learnedFromMs: number | null): string
```

### C1: chips and caption

- [ ] Tests for `forecastMoments` across midnight Malaysian time and for `captionFor` in the learned, hourly and trial cases. Implement the chips beside the Now button calling `seek`, and the caption under the map when `at > asOf`. Commit.

### C2: the panel

- [ ] `day-rows.tsx` shows `why` under the day line and a small "hourly" tag on a day whose `source` is `hourly` while the station's `source.kind` is `learned`. `station-panel.tsx` footer: "Forecast by the learned model <version>, issued <Sun 08:00>. Hourly shape from the smoke simulation. Checked on N days so far." with a link "How good is this?" to `/model`; in `hourly` kind the footer keeps today's sentence plus "Hourly forecast" (Review Focus 5). Commit.

---

## Track D: the live record on the Model page

**Files:**
- Create: `backend/src/services/model-live.ts`; modify `backend/src/routes/haze.routes.ts` (`GET /haze/model`)
- Create: `frontend/components/model/live-chapter.tsx`, `frontend/components/model/live-tiles.tsx`, `frontend/components/model/ledger.tsx`, `frontend/components/model/watch.tsx`; modify `frontend/components/model/chapters.ts` (a first chapter `live`), `frontend/app/(app)/model/page.tsx` (fetch `getModelLive`, render the chapter first, keep the rest)
- Tests: `backend/test/services/model-live.test.ts`, `backend/test/routes/haze.test.ts` (or new), `frontend/lib/api/model-schemas.test.ts`

**Interfaces:** consumes `ModelLive` from the foundation, `modelSkill`, `modelForecasts.scorable` (now with p10, p90), `outlookFor`.

### D1: `model-live.ts`

- [ ] `modelLive(db, mode, model, follow: string[])`: `source` and `skill`; `nextCheckAt` = 16:00 UTC of the earliest stored day not yet scorable; `watch` = outlooks of the six DOE stations with the highest `p50` for tomorrow in the newest issue plus `follow`, deduplicated; `ledger` from `scorable`, newest first, misses in API points like `model-skill`.
- [ ] Test on the recorded cycle plus the real issue fixture: six watch stations, `nextCheckAt` is `2026-10-11T16:00:00Z` for the fixture's first day, the ledger is empty before any day passes and has rows after `insertMany` of a scored day (reuse the `model-skill.test.ts` rows). Route test: 200 and parses as `ModelLive`. Commit.

### D2: the page

- [ ] Chapter "Live record" first: three tiles (backtest from `source.record.backtest`, live from `skill`, status from `source`), then `watch` as six `OutlookChart`s with the station name and a "readings so far" note, then the ledger table. The page's existing chapters follow unchanged. The nav already links `/model`. Commit.

---

## Finish

- [ ] Both backend suites, `pnpm type-check`, `pnpm lint`; frontend `pnpm type-check && pnpm lint && pnpm test && pnpm build`; `model/` `pytest -q && ruff check .`.
- [ ] Rebuild the stack: `docker compose up -d --build model api jobs frontend`; run one cycle; go through acceptance in spec section 10 on Jerantut and record it in `docs/HANDOVER.md`.
- [ ] `README.md`: `/haze/model` in the API table, `GET /report` under the model service.
