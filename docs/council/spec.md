# Suppression Council: design spec

Written 10 October 2026. The design in one document, for review before building. The numbered
files in this folder hold the detail and the evidence; this file states what will be built and
why, and points to them.

## 1. The question and the answer it must give

> With the limited help Malaysia can send, which fires should be put out first to clear the haze
> over Kuala Lumpur and its surroundings, and what will the air look like afterwards?

The user presses one button. A council of role-played Malaysian ministers and experts (a Chair, ten
members and a Red Cell) works the question from the same data for ten to fifteen minutes, every
candidate plan is scored by the smoke engine, and the plan that holds up best becomes the verdict.
The page replays the whole meeting as an animated graph, then shows the verdict: three lines of
answer, a before and after map, the strike list, the reasoning, and what could go wrong.

## 2. What the research and the spikes established

Full evidence: `research/01` to `05`, `01-spike-attribution.md`, `01b-spike-plans.md`.

1. **Influence, not size or distance, ranks fires.** This week, the ten complexes with most
   influence on KL cause 85% of its coming fire smoke; the ten biggest, 49%; the ten nearest, 5%.
2. **The wind decides where KL's smoke comes from**, so influence is computed per run, never
   remembered. Over 14 days on four analogue wind windows, the Jambi peat belt (1.2 to 1.8 S,
   104 E) leads in three. The literature agrees: Riau and Jambi dominate the Klang Valley in the
   south-west monsoon.
3. **Malaysia's package is tiny and was accepted for the wrong island.** One CL-415, three
   helicopters, 52 people, accepted on 18 September 2026 for Kalimantan. Aimed anywhere in
   Kalimantan it removes at most about 0.15% of KL's achievable improvement.
4. **Water from the air does not put out peat.** The whole air deployment would saturate 4 to 6 ha
   of deep peat. Aircraft knock down surface flame; only ground crews end peat fires, at 0.25 to
   3 ha a team-day, and half-suppressed peat relights.
5. **Home and asking beat the deployment.** Bomba on two small Johor fires (mineral soil, 220 and
   300 km from KL) is worth more to KL than the whole Kalimantan deployment in every wind window.
   Adding a request to redirect help to the Jambi belt gives the best plan in all four windows,
   3 to 13% of the achievable.
6. **Debate helps only when grounded.** Persona labels do nothing; identical agents conform.
   Debate improves decisions when agents hold different information and tools, draft
   independently, and settle disputes with outside evidence. The engine is the referee.
7. **The 84-hour forecast hides the benefit.** Kalimantan smoke takes two to three days to arrive
   and suppression takes days to bite. Over 84 hours the ceiling is 0.84 ug/m3; over 14 days on
   analogue weather it is 3 to 21 ug/m3. An extended horizon is required.

8. **A prototype council works** (`11-prototype-council.md`): five seats, critics and a Chair on
   the real proxy produced grounded, adversarial reasoning and an honest verdict. Its drafts
   converged, so proposers get assigned planning premises; its text ran long, so every answer has
   a capped headline.

## 3. Scope

In: target "Kuala Lumpur and surroundings" only (selector shows others disabled); fires as of the
newest stored day, held at their recent level into the future (the engine's existing
assumption); the package in `03-assistance-package.md`; one run at a time; replay of any stored
run.

Out for now: other targets; live re-planning; any change inside `backend/src/haze/`; Web Push of
verdicts.

## 4. Architecture

Placed in the existing dependency rings (CLAUDE.md, "Module rules"):

```
routes/council.ts, jobs/council.ts                 orchestration
  -> services/suppression-engine.ts                the seam to the engine (+ __fakes__)
  -> repositories/council.repo.ts                  council_runs, council_events
     sources/peat.ts, sources/gazetteer-id.ts      bundled PEATMAP grid, Indonesian places
  -> agents/council/                               seats, the agent turn, stages, tools, skills
     suppression/                                  pure: complexes, effect, score, validate, baselines
     contracts.council.ts                          zod: Plan, Verdict, CouncilEvent, Run
```

### 4.1 `suppression/` (pure, no database, no network)

| File | Responsibility |
| --- | --- |
| `complexes.ts` | Group fire cells into compact complexes (strongest cell seeds, 15 km radius) and compute their features: power, detections, persistence, night share, peat share |
| `package.ts` | The assistance package as typed constants, each with its source and fact or assumption tag |
| `scenarios.ts` | Optimistic, central, pessimistic effect parameters |
| `effect.ts` | A plan to a factor per complex per emission day, per scenario (`02-decision-model.md` section 4) |
| `score.ts` | A plan's measures over the attribution matrix: ug/m3 removed, share of ceiling, station-hours over 100 and 200 avoided, peak change, arrival, per wind member |
| `validate.ts` | A plan against the package: per-day totals, reach, water, consent, visibility, crew rest; returns violations |
| `baselines.ts` | Biggest first, nearest first, greedy influence-per-effort, ceiling |

### 4.2 The engine seam

`services/suppression-engine.ts` (`06-engine-seam.md`):

- `attribute({ asOf, target })`: loads the run input, builds the extended weather (stored forecast,
  then one analogue window per wind member), groups complexes, and returns for each candidate
  complex its contribution series at the target stations per emission day per wind member, plus
  the baseline series and the ceiling. Uses `loadRunInput`, `runModel` (calibration),
  `emissionsFor`, `ensembleMean`, `smokeFrom`, unchanged. Under two minutes.
- `simulate({ asOf, target, scaling })`: one full run with scaled emissions, for the verdict's
  maps. Only for the chosen plan and the baseline.
- The fake returns a recorded attribution, so council tests never run the engine.

### 4.3 The council (`agents/council/`)

| File | Responsibility |
| --- | --- |
| `seats.ts` | The twelve agents (Chair, ten members, Red Cell): mandate, private brief builder, tools, skills to load first, voice, model (`04-council-roles.md`) |
| `turn.ts` | One seat's turn: the chat's JSON tool protocol over structured output, up to 4 steps, each step a model call and a set of events |
| `board.ts` | The shared state: facts with ids, plans, scores, messages; what each seat may see at each stage |
| `fact-check.ts` | Every number in a message must match a fact id or a score; misses are flagged on the event |
| `run.ts` | The stages in order, the budget, the stopping rule (`05-protocol.md`) |
| `stages/*.ts` | One file per stage: mission, draft, screen, wargame, critique, revise, rate, decide |
| `tools/*.ts`, `tools/index.ts` | The council's tools (`07-tools-and-skills.md`), reading the frozen attribution |
| `skills/<name>/SKILL.md` | Seven skills distilled from the research, loaded by the chat's skill registry pointed at this folder |

Prompts: `agents/prompts/council-<stage>/v1.md`, seven files. Seat identity is rendered into the
stage prompt from `seats.ts`.

Models: seats on `sonnet`, Chair and Red Cell on `opus`. Six calls in flight (the proxy allows
eight). About 45 to 65 calls per run.

### 4.4 Persistence and API

Migration `007_council.sql`: `council_runs`, `council_events` (`08-replay-events.md`). Append-only.

| Method | Path | Does |
| --- | --- | --- |
| POST | `/api/council/runs` | Queue a run for `{ target: "klang-valley" }`; refuses if one is running |
| GET | `/api/council/runs` | The runs, newest first |
| GET | `/api/council/runs/:id` | The run, its package and verdict |
| GET | `/api/council/runs/:id/events?after=N` | Events after `seq` N, for the replay and the live tail |

The jobs process picks up a queued run (it already owns long work), executes it and writes events
as it goes. `pnpm council:run` runs one from the command line.

### 4.5 The page

`frontend/app/(app)/council/` (`09-page.md`): start panel, replay (graph, side rail, player),
verdict. The scene is a pure function of `(events, t)` in `components/council/scene.ts`; the
graph is SVG driven by `requestAnimationFrame`, with no new dependencies. Contracts mirrored in
`frontend/lib/api/council-schemas.ts`. The nav's Simulation entry is switched to it last.

## 5. Data flow of one run

1. POST queues a run. The jobs process takes it, sets `running`.
2. Stage 0: `attribute` (about two minutes), complexes and features, baselines scored; facts posted.
3. Stage 1: Chair freezes objective, constraints, weights.
4. Stage 2: eight seats draft independently, each with up to four tool steps.
5. Stage 3: validator; Chair merges near-duplicates into 3 to 5 plans.
6. Stage 4: every plan scored across scenarios and wind members.
7. Stages 5 and 6: assigned critiques with variants scored on the spot; revisions; at most two
   rounds; stop on stability.
8. Stage 7: blind ratings on the frozen criteria.
9. Stage 8: Chair's decision by the rule; three tracks; dissent.
10. `simulate` for the chosen plan and the baseline; the verdict stored; `done`.

## 6. Failure handling

- A model call that fails after the client's retries: that seat's turn is recorded as failed and
  the stage continues without it. A stage needs a quorum (six of eight drafts, two critics per
  plan) or the run fails with the reason.
- An invalid structured answer gets the existing one corrective retry (`callStructured`).
- The engine seam failing in stage 0 fails the run at once: nothing to argue over.
- A run is never resumed; a failed run stays in the log with its events, and a new run starts.
- Budget: 80 model calls and 25 minutes hard cap; the verdict says "budget-limited" if hit.
- Errors are the project's `RetryableError`, `TerminalError`, `UpstreamError`; nothing swallowed.

## 7. Truthfulness rules

- Every number shown comes from the stored data, the engine, or the package; package and effect
  numbers carry an "assumption" mark linking to their source.
- Seats are named by office. The page says the council is role-played by AI.
- No synthetic data: tests use fire cells and weather recorded from this database on 10 October
  2026, added to `backend/test/fixtures/` like the existing recordings.
- The ceiling is shown beside every benefit, and baselines beside the chosen plan.

## 8. Testing

| What | How |
| --- | --- |
| `suppression/` | Unit tests on recorded fire cells: complexes are compact and cover every cell; effect respects arrival, rates, re-ignition; score is linear and equals the sum of parts; validator catches each violation; baselines are deterministic |
| Seam | The real implementation against the test database with recorded weather: the matrix's prediction for a plan matches a full scaled run within 5% (the linearity check) |
| Council | Scripted fake LLM and the fake engine: stages run in order, events are complete and ordered, drafts never see each other, budget and quorum hold, the verdict follows the rule, a fabricated number is flagged |
| Routes | supertest: queue, refuse a second, list, events after N |
| Frontend | `scene.ts` on a recorded event log: node counts, pulses at time t, scrubbing back equals playing forward; schemas parse the recorded run |

## 9. Build order

Each phase ends with tests passing and a commit.

1. **Core**: `suppression/`, the peat grid (`scripts/pack-peat.mjs`, GDAL, from PEATMAP), the
   Indonesian gazetteer, recorded fixtures. No engine, no model.
2. **Seam**: real and fake `SuppressionEngine`, analogue weather, `pnpm council:situation` to
   print stage 0 for today.
3. **Store and API**: migration, repository, contracts, routes, the jobs pick-up.
4. **Council**: seats, turn, board, fact check, stages, tools, skills, prompts; fake-model tests;
   then the first real run, read in full, prompts tuned (new versions).
5. **Page**: start panel, replay, verdict, on the recorded first run.
6. **Switch**: the nav entry and the backtest's new place, coordinated with the engine's owner.

Phases 1, 3 and the page's replay engine (5) do not depend on the engine and can start now.
Phase 2 depends only on the engine's public functions, which spike 1 and 2 already use read-only.

## 10. Decisions taken, and open

Taken in this design, each reversible: a Chair, ten members and a Red Cell, named by office; Sarawak seated as
the authentic dissenter; domestic Bomba in scope; three-track verdict; 14-day analogue horizon;
engine as referee with frozen criteria; seats on sonnet, Chair and Red Cell on opus; the page at
`/council` until the nav switch.

Open: `10-open-questions.md`, chiefly the analogue horizon and linearity, for the engine's owner.
