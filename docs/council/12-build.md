# What is built

Where each part of the design lives, and how to run it. Written 10 October 2026.

## Run it

```sh
# inside backend/, with the local postgres and llm-proxy up (docker compose up -d postgres llm-proxy)
pnpm db:migrate                 # adds council_runs and council_events (007_council.sql)
pnpm council:situation          # stage 0 only, printed: complexes, shares, baselines (about a minute)
pnpm council:situation --no-files   # the same without downloading the FIRMS files
pnpm council:run                # queue a run for KL and execute it here, then exit (15 to 25 minutes)
pnpm council:worker             # execute queued runs forever (what the page's button relies on)
```

The api serves `POST /council/runs`, `GET /council/runs`, `GET /council/runs/:id` and
`GET /council/runs/:id/events?after=N`. The api never runs a council; the worker does.

## Map of the code

| Part | Files | Doc |
| --- | --- | --- |
| Contracts | `backend/src/contracts.council.ts` (plan, measures), `contracts.council-run.ts` (events, verdict, run) | `08` |
| Suppression core (pure) | `backend/src/suppression/`: `complexes.ts`, `package.ts`, `scenarios.ts`, `effect.ts`, `attribution.ts`, `score.ts`, `validate.ts`, `baselines.ts`, `analogue.ts`, `targets.ts`, `coast.ts` | `02`, `03` |
| Bundled data | `backend/src/sources/peat-data.ts` (PEATMAP), `places-id-data.ts` (GeoNames Indonesia), `peat.ts`, `place-namer.ts`; packers in `backend/scripts/` | `research/05` |
| Engine seam | `backend/src/services/suppression-inputs.ts` (load once), `suppression-engine.ts` (attribution, verdict maps), `fire-complexes.ts` | `06` |
| Store and API | `backend/db/migrations/007_council.sql`, `repositories/council.repo.ts`, `routes/council.routes.ts` | `08` |
| Council | `backend/src/agents/council/`: `seats.ts`, `context.ts`, `situation.ts`, `turn.ts`, `fact-check.ts`, `events.ts`, `run.ts`, `stages/*.ts`, `tools/*.ts`, `skills/*/SKILL.md` | `04`, `05`, `07` |
| Prompts | `backend/src/agents/prompts/council-{mission,draft,critique,premortem,revise,rate,decide}/` (draft, revise and decide at v2) | `05`, `13` |
| Worker | `backend/src/jobs/council-worker.ts`, `council-situation.ts` | |
| Page | `frontend/app/(app)/council/page.tsx`; `frontend/components/council/` (pure: `timeline.ts` beats, `scene.ts` scene at time t, `tray.ts`, `caption.ts`, `layout.ts`; UI: `graph.tsx` and `paint.ts` for the animated SVG, `use-playback.ts`, `use-council-run.ts` live polling, `replay.tsx`, `rail.tsx`, `plan-tray.tsx`, `player.tsx`, `start-panel.tsx`, `verdict*.tsx`); `frontend/lib/api/council-*.ts`; route handlers under `frontend/app/api/council/` | `09` |
| Tests | `backend/test/suppression/`, `test/sources/place-namer.test.ts`, `test/agents/council-run.test.ts`, `test/routes/council.routes.test.ts`; fixtures `recorded-council.ts` (real cells), `council-vector.ts` (a labelled test vector) | |

## How a run goes, in code

`runCouncil` (`agents/council/run.ts`):

1. `engine.attribute` builds the attribution: four wind members (forecast, then the last four
   10-day windows of stored wind replayed), 804 complexes this week, a share for the 216 big or
   near enough to matter, and day-by-day contributions for about 47 candidates. About four
   minutes with the FIRMS download.
2. `mission`: the Chair (opus) freezes objective, weights and one premise per proposer.
3. `drafts`: eight seats (sonnet) draft blind under their premises, up to two tool steps each;
   a refused plan goes back once with the validator's reasons. Quorum six.
4. `tableBaselines` and `screen`: biggest-first, nearest-first and two greedy plans are tabled;
   a shortlist of up to five distinct feasible plans, keeping the best within accepted consent
   and the best that asks.
5. `wargame`: every shortlisted plan and baseline scored, as events.
6. `crossExamine`: three critics a plan (Foreign Affairs and two opposed seats) plus the Red
   Cell's pre-mortem; a critic's variant is tabled if the engine scores it higher.
7. `revision`: authors revise or hold, with the evidence. Further rounds (up to three) run on the
   top three while the leading plan keeps changing. There is no limit on model calls; the only
   budget is the government's money, which every plan must fit (`suppression/costs.ts`).
8. `comparison`: criterion owners rate the shortlist blind, in shuffled order.
9. `decision`: the matrix picks the plan, except that a plan rated below 3 of 10 on feasibility or
   diplomacy by the seats that own them cannot win while another clears both; the Chair writes the
   three tracks in plain English; every member then says in one sentence whether it stands behind
   the decision (`stages/closing.ts`). Then the engine draws the region without and with the plan
   at the hour the plan helps most, and the verdict says where KL's coming smoke comes from by
   area.

Every step writes events (`agents/council/events.ts`) in sequence; a failed run writes
`run_failed` and keeps its events.

## The replay's timing

Model latency is thrown away. Each event gets a fixed beat by kind and plays after the previous
one in sequence: stage and run_started 1.4 s, agent_joined 0.6 s, thinking 0.7 s, tool_call
0.3 s, tool_result 0.12 s, candidate 0.9 s, simulation 0.5 s, vote 0.4 s, verdict 2 s; a message
has a 0.35 s lead, then pulses travel two at a time (0.9 s each, a broadcast squeezed to at most
2.6 s), then 0.25 s to settle. Run 1 (472 events) plays in 3 min 51 s at 1x. The scene is a pure
function of the events and the time, so scrubbing back equals playing forward.
