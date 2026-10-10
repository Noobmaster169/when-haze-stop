# Requirements checklist

An audit of the Suppression Council against the user's original brief and the four follow-up
instructions, written 10 October 2026 on branch `haze-product` at commit `687ff04`. Each
requirement quotes the words it comes from, says what "met" means, gives the evidence seen, and a
status. MET means the evidence was seen first hand: the code read, a test run, a database row
queried, or the page opened in a browser. Interpretations the team made are named as
interpretations. Nothing in the code was changed by this audit.

How the evidence was gathered:

- Read: `CLAUDE.md`, every file in `docs/council/`, and the council code in `backend/src/suppression/`,
  `backend/src/agents/council/`, `backend/src/agents/prompts/council-*`, `backend/src/services/`,
  `backend/src/routes/council.routes.ts`, `backend/src/jobs/council-worker.ts`,
  `frontend/app/(app)/council/`, `frontend/components/council/`, `frontend/components/shell/nav.ts`.
- Ran: `pnpm test` in `backend/` (28 files, 208 tests, all pass), `pnpm type-check` in `backend/`
  (clean), `pnpm type-check && pnpm lint && pnpm test` in `frontend/` (clean, 10 files, 86 tests pass).
- Queried (read only): `council_runs` and `council_events` in the local Postgres. Runs present:
  1 (done, old prompts, no budget, no maps), 2 (failed, process killed), 7 (done, maps, no budget,
  old prompts), 8 (the first run with the money budget and plain-English prompts; see R63 to R67).
- Opened in a browser: the backend from source on port 8092 and the frontend on port 3001, driven
  with Playwright. Screenshots are in the session scratchpad,
  `/private/tmp/claude-501/-Users-gshbhd-henson-when-haze-stop/da44ceaf-de7b-410c-a539-5d864d4d5837/scratchpad/audit/`,
  named `01-start-panel.png` to `NN-...png` and cited below by number. "Convene the council" was
  never pressed.

Run 8 status when this was written: started 21:58 MYT with a budget of RM 8 million
(`run_started` payload `budgetRm: 8000000`); at 22:45 MYT it was still in its second round of
cross-examination (713 events, no verdict yet). The audit waited 45 minutes as agreed and then
stopped. Everything run 8 had written by then was read; its verdict, cost section and maps
could not be checked (R63 and R65 say so).

## Summary

| Status | Count |
| --- | --- |
| MET | 56 |
| PARTIAL | 10 |
| NOT MET | 1 |
| Total | 67 |

PARTIAL: R03, R06, R08, R34, R37, R49, R57, R62, R63, R65. NOT MET: R12.

The gaps that matter most:

1. **R37, the button alone does not produce a verdict on the standard stack.** `compose.yaml`
   starts no council worker, so a run queued from the page waits forever unless someone runs
   `pnpm council:worker`. One compose service closes it.
2. **R12, the person never sees where KL's haze comes from.** The agents get every fire group's
   share, but the page shows no Sumatra, Kalimantan and Malaysia breakdown, which the brief
   asked to "know".
3. **R63 and R65, the plain-English verdict, its cost line and the maps on the new code are not
   yet seen on a finished run.** Run 8's meeting text is plain (no codes or jargon in 183
   headlines and gists, against 84 of 114 in run 1), but its verdict had not been written when
   the audit stopped.
4. **R03, the strike list's order is by smoke removed but labelled as the order of attack.** In
   run 1 the fire numbered 1 starts on day 5, after fires 2 and 3.
5. **R06, the scooper's 25 km water-reach rule is never applied in a run**, although it is coded
   and tested; `context.ts` calls the validator without the coast distances.
6. **R49, the replay shows ratings and a rule, not agreement.** No seat ever concedes or records
   dissent on the chosen plan (zero `concede` acts in every run).
7. **R08, time is modelled but not shown.** When the air starts to clear is computed and never
   displayed.
8. **R62, several docs describe an earlier state** (README nav status, the log, the 130-call
   budget, two skills never built, tool names).

## The checklist

### A. What the system answers

**R01. Say which hotspots to take down.**
Quote: "We are offering the prediction of which hotspots should be taken down first."
Met means: a finished run names the fires to attack, where they are, and with what.
Evidence: `Verdict.strikeList` built in `backend/src/agents/council/stages/verdict.ts:24-49`
(place, province, country, peat share, assets, days, whether it waits on Indonesia, share of
smoke removed); shown by `frontend/components/council/verdict-strikes.tsx`. Run 1 verdict in the
database lists C020 near Simpang (Jambi), C121 near Senggarang and C120 near Pekan Serkat (Johor),
C007 near Manismata (West Kalimantan). Screenshots 10 and 14.
Status: MET.

**R02. The unit of attack is a group of hotspots (interpretation).**
Quote: "which hotspots or fire spots should we take down."
Met means: the thing ranked is something a crew can be sent to.
Evidence: interpretation recorded in `docs/council/02-decision-model.md` section 1: satellite
hotspots are grouped into fire complexes (strongest cell seeds, 15 km radius),
`backend/src/suppression/complexes.ts:9-14,70`; tests "puts every burning cell in exactly one
complex" and "keeps every complex compact" in `backend/test/suppression/complexes.test.ts`.
Status: MET (interpretation: complexes, not single 375 m hotspots).

**R03. Say which to take down first, in order.**
Quote: "which hotspots should be taken down first"; "which hotspots or fire spots should we take
down for the very first time."
Met means: the verdict gives an order of attack in time, and labels it truthfully.
Evidence: the strike list is sorted by share of smoke removed, not by when work starts
(`verdict.ts:47`, `.sort((a, b) => b.share - a.share)`). The page labels it as attack order: the
section heading "Which fires, in what order" (`verdict.tsx:110`), the map caption "Numbered in
the order the plan attacks them" (`verdict-map.tsx:144`) and the component comment
(`verdict-strikes.tsx:5`, "in the order it attacks them"). In run 1 the row numbered 1 (C020,
Jambi) starts on day 5, after rows 2 and 3 (Johor, day 1) (screenshot 10). The "Do now" track
does say what starts today.
Status: PARTIAL.
Missing: the numbering is impact order presented as attack order.
Smallest change: either sort the strike list by `fromDay` then share, or relabel the column and
captions as "by smoke removed" (one line in `verdict.ts` or three strings in the frontend).

**R04. Limited money is a hard constraint.**
Quote: "with the limited budget"; follow-up (d): "budget" means the government's money.
Met means: every plan has a cost in ringgit, and a plan over the budget is refused.
Evidence: daily rates and plan cost in `backend/src/suppression/costs.ts:27-64`; the validator
refuses an over-budget plan, `backend/src/suppression/validate.ts:82-83`; the council validates
every tabled plan against the run's budget, `backend/src/agents/council/context.ts:94-97`; the
baselines are trimmed to the budget, `baselines.ts:35-43`. Tests: "refuses a plan that costs
more than the budget" (`test/suppression/validate.test.ts:51`) and the council test asserts the
verdict cost is within RM 8 million (`test/agents/council-run.test.ts`, first test).
Status: MET in code. Live evidence in R64.

**R05. Limited manpower is a constraint.**
Quote: "man power."
Met means: people are counted per day and capped.
Evidence: `PACKAGE.assets` in `backend/src/suppression/package.ts:41-97`: 2 lance teams of 6,
up to 100 Bomba at home, a 150-person ground task force; per-day caps and days worked checked in
`validate.ts:71-81`; test "refuses more aircraft than Malaysia has, on any one day".
Status: MET.

**R06. Limited fleet is a constraint, including where aircraft can actually work.**
Quote: "fleets/resources that we have."
Met means: aircraft counts, operating days and physical reach are enforced on every plan.
Evidence: 1 CL-415 for 10 operating days, 3 helicopters (`package.ts:42-63`), capped per day
(`validate.ts:71-81`). The scooper's reach rule exists (`validate.ts:65-68`, test "refuses the
scooper where no open water is in reach") but the council never applies it: `context.ts:96`
calls `validate(normalised, attribution.complexes, { budgetRm })` with no `coastKm`, so the
check is skipped in every run, although the same file computes `coastKm` per complex
(`context.ts:90`). `docs/council/13-real-runs.md` (run 2) records that a seat, not the
validator, caught a draft sending the scooper to C005, 62 km from open sea.
Status: PARTIAL.
Missing: the scoop-reach limit is not enforced in a run.
Smallest change: pass `coastKm: new Map([...logistics].map(([id, l]) => [id, l.coastKm]))` to
`validate` in `context.ts`.

**R07. Limited time is modelled.**
Quote: "within the limited resource and time."
Met means: plans run inside a fixed window, help arrives with realistic delays, and requests
to Indonesia take time.
Evidence: 14 days in theatre and plan day 1 two days after the data (`package.ts:38-39`,
`dayOneFor`); arrival delays and consent lags (`backend/src/suppression/effect.ts:17-24`,
`earliestWithConsent` 4, 5, 7); a 14-day horizon on analogue wind because the 84-hour forecast
hides the benefit (`docs/council/01b-spike-plans.md`, `backend/src/suppression/analogue.ts`);
rule R8 "value suppression only until the rains" (`situation.ts:22`). Test "does nothing before
the crews can arrive".
Status: MET.

**R08. Limited resources and time are emphasised strongly.**
Quote: "(please emphasize on this a lot)."
Met means: the limits are visible to the agents and to the person at every step, money and time
alike.
Evidence for resources: rule R11 and the money line in the fact sheet (`situation.ts:25,49`); a
"Money" section in every current prompt (`prompts/council-*/v2.md` and `v3.md`); a Treasury seat
whose mandate is the budget (`seats.ts:164-176`); the start panel's budget selector and package
chips marked "assumed" (screenshot 01); a "What it costs" section on the verdict
(`verdict-cost.tsx`). Evidence for time: the strike list's "Days" column (screenshot 10) and the
"14 days" chip. Missing for time: the score computes when the benefit reaches KL
(`ScoreSummary.arrivalHours`, `score.ts:66`), but nothing on the page shows it
(`grep arrivalHours frontend/components/council` finds only the schema), and no criterion or
headline says how soon the air gets better.
Status: PARTIAL.
Smallest change: add "Air starts to clear: about N days from now" (from `verdict.score.arrivalHours`)
as a line under the "Cleaner air for KL" fact in `verdict.tsx`.

**R09. As quick as possible.**
Quote: "which hotspots should be taken down first as quick as possible."
Met means: speed of effect counts in choosing the plan.
Evidence: the score is the mean removed over the horizon, so earlier relief counts for more
hours (`score.ts:59-77`); the Health seat's premise is "Most people out of unhealthy air soonest"
(`seats.ts:136`); Bomba at home needs no travel and starts day 1 (`effect.ts:21`). Arrival time is
not a criterion of its own in the matrix (`comparison.ts` weights) and is not shown (R08).
Status: MET (interpretation: speed is valued through hours of cleaner air, not as a separate criterion).

### B. Where the haze comes from

**R10. The closest hotspot is not assumed to be the cause.**
Quote: "the closest hotspot might not always be the cause of the haze."
Met means: fires are ranked by measured influence on the target, and the nearest-first rule is
shown losing.
Evidence: spike 1, `docs/council/01-spike-attribution.md` (ten nearest cause 5%, ten most
influential 85%); rule R1 (`situation.ts:15`); the "Nearest fire first" baseline in every run
(`baselines.ts:50-54`). Run 1: nearest-first 0.00% of the achievable against the verdict's 11.1%
(database verdict `baselines`, screenshot 12).
Status: MET.

**R11. A quick way to know where a place's haze comes from.**
Quote: "it's good if we can have a quick memory or way to know where does the haze of a
particular location actually comes from."
Met means: for the target, each fire group's share of the coming smoke is worked out and given
to the reasoning.
Evidence: the source-receptor matrix built once per run by the engine seam
(`backend/src/services/suppression-engine.ts:58-87`), shares per wind member in every fact-sheet
line (`tools/format.ts:6-13`), the `get_influence` tool, and the `reading-influence` skill with
the literature as a prior (`skills/reading-influence/SKILL.md:18`). It is recomputed each run
(about four minutes, `docs/council/12-build.md`), not stored, by design (the wind decides).
Status: MET (interpretation: "memory" is a fresh per-run attribution plus the literature prior,
not a stored table).

**R12. The person can see where KL's haze comes from.**
Quote: "we need to know this."
Met means: the page tells a person what share of KL's coming smoke comes from Sumatra,
Kalimantan and Malaysia (or similar), not only the agents.
Evidence: the replay's first engine message gives only "N groups of fires; ten make X%"
(`run.ts:100-107`); the verdict shows only the struck fires' shares (`verdict-strikes.tsx`).
`grep -i "sumatra\|borneo\|region" frontend/components/council` finds no regional breakdown.
Status: NOT MET.
Smallest change: in `run.ts`, add the share by area (sum of `ctx.shares` grouped by
`complex.place.area`) to the engine's opening message and to the verdict, and show it as one
line above the strike list.

**R13. The Sumatra and Kalimantan picture is reflected.**
Quote: "the haze is mostly from Sumatra and Kalimantan. And the one that causes haze in Kuala
Lumpur is mostly from Sumatra."
Met means: the reasoning knows the regional pattern and checks it against this week's wind.
Evidence: `docs/council/research/03-source-attribution.md` section 2; spike 2 measured Sumatra at
41.5 to 94.7% of KL's achievable improvement across four wind windows
(`docs/council/01b-spike-plans.md`); the `reading-influence` skill states Riau and Jambi as the
prior (`SKILL.md:18`). Both completed verdicts put the first strike in Jambi, Sumatra (runs 1
and 7, database).
Status: MET.

### C. Malaysia's support

**R14. Work out what Malaysia can provide, by search or stated assumption.**
Quote: "with the current power or support that Malaysia can provide (you can do a web search of
this or make an assumption)."
Met means: a package with facts sourced and assumptions marked.
Evidence: `docs/council/research/02-campaigns-capacity.md` (67 links; the 8 October 2026 FMT
report of Anwar contacting Prabowo, section 1.1); `docs/council/03-assistance-package.md`; each
line tagged fact or assumption in `package.ts:41-97`.
Status: MET.

**R15. The Prime Minister's commitment is the premise (interpretation).**
Quote: "Anwar Ibrahim has said that Malaysia will support on taking down the fire in Indonesia."
Met means: the scenario rests on the real 2026 offer.
Evidence: research found the accepted package was presented by the Deputy Prime Minister and
accepted on 18 September 2026 for Kalimantan only; the Prime Minister's 8 October statement is
cited (`research/02` section 1.1, line 36). Seats are offices, never named people
(`seats.ts:3-11`), so the Prime Minister is not role-played.
Status: MET (interpretation: Anwar is context, the accepted package is the premise).

**R16. Assumed numbers are marked as assumptions to the person.**
Quote: "or make an assumption."
Met means: the page distinguishes accepted facts from assumptions.
Evidence: dashed "assumed" chips and the link "What this rests on" on the start panel
(`start-panel.tsx:89-108`, screenshot 01); the budget note "The government's real figure is not
public" (`start-panel.tsx:85-87`); verdict caveats (`verdict-notes.tsx:7-12`).
Status: MET.

### D. Feeding plans to the simulation engine

**R17. The chosen hotspots are removed and run through the engine.**
Quote: "we will feed the new updated hotspots into the simulation engine."
Met means: the plan's suppressed emissions go through the engine and come back as smoke.
Evidence: interpretation in `docs/council/06-engine-seam.md`: every plan is scored on a
source-receptor matrix built from the engine's own runs per fire group and day (linear in
emissions, `score.ts:38-51`), and the chosen plan gets one full engine run with scaled
emissions for the maps (`suppression-engine.ts:89-117`, called from `run.ts:61-67`). Run 7's
verdict carries those maps (database: `maps` not null, at 2026-10-21T15:00Z). Not done: the
promised check that the matrix and the full run agree (`06-engine-seam.md` "the verdict page
shows both" and spec section 8 "within 5%"); no test exercises `engineSuppression`.
Status: MET (interpretation: matrix arithmetic for scoring, full engine run for the verdict),
with the agreement check still missing.

**R18. The engine gives an AQI forecast for the target after the plan.**
Quote: "gives us the simulation and the forecast of the AQI index in a particular area that we
target."
Met means: the verdict shows the target's air over time without and with the plan, on the index.
Evidence: `Verdict.series` (`verdict.ts:51-65`), drawn by `verdict-chart.tsx` as 24-hour PM2.5
with the API 100 line (screenshot 11); maps on the map's API colours with a legend
(`verdict-map.tsx:91-105`, screenshot 14).
Status: MET (interpretation: shown as 24-hour PM2.5 with the API 100 line marked, not as API
values).

**R19. The target area is Kuala Lumpur and surroundings.**
Quote: "for example we focus on removing the haze in Kuala Lumpur and surroundings."
Met means: the target is defined as real stations around KL.
Evidence: `backend/src/suppression/targets.ts:17-25`, nine DOE stations (Klang Valley,
Putrajaya, Nilai, Seremban); the route refuses any other target
(`contracts.council-run.ts:160`, test "refuses an area the council cannot be asked about yet").
Status: MET.

**R20. Candidate plans go to the engine to choose the best.**
Quote: "Once they have candidates of decisions made on which hotspots should be taken down, they
will be fed to the simulation engine to finally decide which is the best strategy."
Met means: every candidate is scored by the engine and the scores drive the choice.
Evidence: every tabled plan is scored on table (`context.ts:105-109`); a `simulation` event for
each shortlisted plan (`screening.ts:59-62`); engine benefit and robustness carry 0.65 of the
default weights in the decision matrix (`mission.ts:17`, `comparison.ts:70-95`). Run 1: 20
`simulation` events; run 7: 20.
Status: MET.

### E. The reasoning

**R21. Not just the largest flame.**
Quote: "The logic can't be as simple as just targeting the hotspots that have the largest
flame."
Met means: fire power is not the ranking, and the biggest-first rule is shown losing.
Evidence: rule R2 (`situation.ts:16`); the "Biggest fire first" baseline (`baselines.ts:45-48`);
run 1: biggest-first 0.17% against 11.1% (screenshot 12).
Status: MET.

**R22. Many interacting variables are reasoned over.**
Quote: "there are so many variables impacting each other."
Met means: influence, wind spread, peat, persistence, re-ignition, access, consent, cost and
crew limits all enter.
Evidence: fact-sheet line per complex (`tools/format.ts:6-13`); three effect scenarios
(`scenarios.ts:34-68`); four wind members (`analogue.ts`); consent from place
(`validate.ts:17-23`); cost (`costs.ts`); 11 tools (`tools/index.ts:19`).
Status: MET.

**R23. A fire in the middle of a cluster is relit by the fires left burning.**
Quote: "If we just target the hotspots in the middle of the other hotspots, it won't be affective
as it's possible that it will be re-triggered by the other hotspots that we are not able to take
down."
Met means: the scoring itself penalises suppressing a fire next to unsuppressed ones.
Evidence: `keepTable` marks a complex "pressured" when a neighbour within 10 km is untouched
(`score.ts:26,32`); `keepByDay` adds `neighbourRelapse` (0.1 to 0.3) and peat relapse after crews
leave (`effect.ts:62-64`); rule R4 (`situation.ts:18`); test "lets peat relight once the crews
leave, and more with fire next door" (`test/suppression/score.test.ts:42`). Run 7's Red Cell
used it: "attack a cluster piecemeal (R4), too thin to finish any of it" (verdict minority report).
Status: MET.

**R24. The reasoning is extensive and visible.**
Quote: "it should require extensive reasoning, such as which hotspots should be targeted."
Met means: the reasons behind the choice are recorded and shown.
Evidence: run 1 wrote 36 messages, 78 thinking gists, 142 tool calls; run 7 45 messages, 149 tool
calls (database counts by kind); the verdict's reasoning, minority report and re-planning
triggers (screenshots 11 and 12); the rail's full text per message (`rail.tsx`).
Status: MET.

**R25. Extensive research on how hotspots are taken down.**
Quote: "I want you to do an extensive research of how taking down hotspots should be done, you
need to rely on expert research."
Met means: cited research on suppression.
Evidence: `docs/council/research/01-suppression-science.md` (750 lines, 80 links: peat
behaviour, emissions, water needs, aerial and ground methods, prioritisation doctrine, why
"biggest flame" and "middle of the cluster" fail, decision rules), `05-peat-data.md`.
Status: MET.

**R26. Historical strategies.**
Quote: "as well as relying on historical strategies of how should it be done best."
Met means: past campaigns are studied and used.
Evidence: `research/02-campaigns-capacity.md` sections 3 and 4 (1997 to 98, 2005 Riau, 2015
CL-415 in South Sumatra, 2019 declined, 2023 denial, evaluations); used in the package
(2015 Palembang cycle, 2005 Riau task force sizing, `package.ts:51,95`) and in the
`transboundary-diplomacy` and `aerial-firefighting` skills.
Status: MET.

**R27. The research becomes prompts, skills and tools.**
Quote: "we are going to make a lot of prompts, skills, relevant tools, directed toolings."
Met means: the research is distilled into what agents read and call.
Evidence: 7 prompt steps (`backend/src/agents/prompts/council-*`, current versions v2 or v3);
5 skills (`backend/src/agents/council/skills/*/SKILL.md`, each with sources); 11 tools
(`tools/index.ts:19`); 11 research rules in the fact sheet (`situation.ts:14-26`). The design
promised 7 skills; `writing-a-plan` and `cross-examination` were not built
(`docs/council/07-tools-and-skills.md:49-50`).
Status: MET (two designed skills not built; see R62).

**R28. Directed tooling: each role gets only its tools.**
Quote: "directed toolings."
Met means: tools are scoped per seat and enforced.
Evidence: per-seat tool lists in `seats.ts`; `callCouncilTool` refuses a tool not on the seat's
list (`tools/index.ts:30-34`).
Status: MET.

### F. The multi-agent council

**R29. A multi-agent framework (interpretation).**
Quote: "we will be using multi-agent framework."
Met means: several distinct agents, each its own model call with its own role, tools and
information.
Evidence: interpretation: an orchestrated pipeline, not free-running agents. `runCouncil`
(`run.ts:69-140`) runs stages; each seat's turn is one or more structured-output calls through
the proxy using the chat's JSON tool protocol (`turn.ts:57-109`), because the proxy refuses the
Messages API `tools` field (CLAUDE.md). Seats differ in mandate, private brief, tools, skills and
model (`seats.ts`). Run 1: 80 model calls (`run_finished` payload).
Status: MET (interpretation: staged orchestration over structured output).

**R30. The agents discuss and challenge each other.**
Quote: "These agents would be discussing, challenging each other."
Met means: agents send each other challenges grounded in evidence, and the target answers.
Evidence: cross-examination gives each shortlisted plan Foreign Affairs plus two opposed seats,
and the Red Cell runs a pre-mortem (`cross-examination.ts:27-30,67-90`); authors revise in reply
(`revision.ts`). Message acts in the database: run 1 has 19 challenges and 5 revisions; run 7 has
29 challenges and 4 revisions. Challenges are directed critic to author, not open discussion;
the author answers only by revising.
Status: MET.

**R31. They continue until a verdict.**
Quote: "until they finally come up with the verdict of which hotspots should be taken down."
Met means: rounds repeat until the result is stable, then a decision is made.
Evidence: up to three rounds of critique and revision, stopping when the engine's leading plan
does not change (`run.ts:34-35,119-129`); decision by the frozen matrix (`decision.ts`), with the
feasibility and diplomacy bar added in `687ff04` (`comparison.ts`, `BAR = 0.3`).
Status: MET.

**R32. Role-play ministers and experts from around Malaysia.**
Quote: "They will be role-playing ... imagine as if they are ministers and experts from all around
Malaysia."
Met means: seats are Malaysian ministries, agencies and experts, including outside the Klang
Valley, and the page says they are AI.
Evidence: Chair (NADMA committee), DOE, MetMalaysia, a university peat scientist, NADMA
operations, APMM and TUDM, Bomba, Wisma Putra, KKM, MOF, Sarawak's state committee, and a Red Cell
(`seats.ts:33-190`); "role-played by AI" on the start panel, replay and verdict (screenshots 01,
02, 09). Seats are offices, never named ministers (`seats.ts:6-8`).
Status: MET (interpretation: offices, not named people, to avoid inventing what a real minister said).

**R33. The choice of agents is decided and justified.**
Quote: "which I want you to decide what agents/sub-agents should be spawned."
Met means: a written rationale for each seat.
Evidence: `docs/council/04-council-roles.md` (mandate, private brief, tools, natural conflict per
seat; why roles help only with differing information, from `research/04`).
Status: MET.

**R34. Sub-agents are spawned.**
Quote: "what agents/sub-agents should be spawned"; "agents and agents swarms."
Met means: agents can spawn helpers that work and report back, and the replay shows it.
Evidence: the design had `subagent` and `subagent_done` events (`docs/council/08-replay-events.md`),
but the contract has no such kind (`contracts.council-run.ts:42-79`) and `grep subagent` finds
nothing in `backend/src` or `frontend/components`. The only "smaller nodes" are tool calls and
skill loads (R44).
Status: PARTIAL.
Missing: no sub-agent exists; "swarm" is the council itself.
Smallest change: either record this as a decision in `docs/council/10-open-questions.md`, or let
the Red Cell or Peat Science spawn a scoped sub-turn (for example one `stress_plan` analyst per
plan) emitted as `agent_joined` with `parent` set, which the contract already allows
(`parent: z.string().nullable()`).

**R35. Data-driven: figures come from data, and unsupported figures are flagged.**
Quote: "such decisions usually take into account a lot of data driven decision."
Met means: agents get the stored data and engine scores, and numbers they invent are caught.
Evidence: fact sheet and tools read one frozen attribution (`context.ts:10-15`); every message is
fact-checked against what the seat was shown (`stages/say.ts`, `fact-check.ts`), flagged on the
page as "Not found in what it was shown" (screenshot 06); test "flags a figure the seat was never
shown".
Status: MET.

**R36. The candidates and the final choice are separate steps.**
Quote: "Once they have candidates of decisions made ... This will give us the final verdict."
Met means: a shortlist of distinct, feasible candidates, then one decision.
Evidence: screening keeps up to five distinct feasible plans plus the computer's greedy plans
(`screening.ts:64-87`); decision picks one (`decision.ts:21-57`). Run 7's chosen plan was the
computer's greedy plan, not a council draft, and the Chair said so (database verdict
`reasoning`, `docs/council/13-real-runs.md` run 3).
Status: MET.

**R37. One button runs the long job and returns a verdict.**
Quote: "Think of this something as an AI harness where it performs long run, but we run it by just
clicking a single button and it will give the verdict."
Met means: pressing the button on a running stack is enough for a verdict to arrive.
Evidence: the button posts to `/api/council/runs` (`council-experience.tsx:44-64`), which queues a
run (`council.routes.ts:27-39`); a separate worker executes queued runs
(`jobs/council-worker.ts`, `pnpm council:worker`). `compose.yaml` starts no council worker (its
`jobs` service runs only `src/jobs/main.ts`, lines 102-115; `grep council compose.yaml` finds
nothing), so on the documented `docker compose up -d --build` stack the button leaves the run
queued forever. Runs so far were started with `pnpm council:run` (`docs/council/13-real-runs.md`).
Status: PARTIAL.
Missing: nothing executes a queued run in the standard stack.
Smallest change: add a `council` service to `compose.yaml` (same image as `jobs`, command
`node --import tsx src/jobs/council-worker.ts loop`), and a line in `README.md`.

**R38. A live run can be watched as it happens.**
Quote: "Since this is a long run."
Met means: the replay follows a running meeting.
Evidence: live polling every 3 s (`use-council-run.ts:15,52-64`); "Watch live" for a running run
on the start panel (screenshot 01, run 7); run 8 opened live shows "Live" and "The council is
gathering" (screenshot 15).
Status: MET.

### G. The visualisation

**R39. Agents are nodes.**
Quote: "I am imagining something where agents are nodes."
Evidence: `graph.tsx:93-112`; screenshots 03, 07, 08.
Status: MET.

**R40. A message is a transmission along an edge from A to B.**
Quote: "when an agent send message or debate with another agent, they will look like an edge or
transmission being sent from agent A to agent B."
Met means: a visible pulse travels from sender to recipient along a curve.
Evidence: pulses along curved paths (`graph.tsx:119-129`, `paint.ts:170-195`, `scene.ts:77-88`);
screenshot 07 shows a pulse in flight from Foreign Affairs to Domestic Fire; sampling the SVG
every 250 ms showed the pulse head moving across the table.
Status: MET.

**R41. Not noisy, easy to follow.**
Quote: "make sure that this is not noisy, make it easily followable."
Met means: one focus at a time, few things moving, a plain caption.
Evidence: at most two pulses at once (`timeline.ts:37`); agents not in the event dim to 40%
(`paint.ts:87`); one caption line ("Foreign Affairs supports Domestic Fire's plan", screenshot
07); past exchanges as faint threads that thicken with use (`paint.ts:120-123`); a filter "Only
challenges and concessions" (`rail.tsx:73-75`). By the decision stage the threads cross the whole
table (screenshot 08), which is busier but still faint.
Status: MET.

**R42. Show when an agent is thinking on its own.**
Quote: "show when they are brainstorming themselves."
Evidence: a breathing halo on a thinking node (`paint.ts:99-102`) and the agent's own one-line
gist in the rail ("Peat Science is weighing: ...", screenshot 04).
Status: MET.

**R43. Tool calls spawn smaller nodes from the agent.**
Quote: "or doing any tool callings, where smaller nodes are spawned from themselves."
Evidence: a satellite buds on a tether, pulses while running, flashes and is absorbed
(`paint.ts:139-160`, `scene.ts:90`); visible on Sarawak (screenshot 04) and Health (screenshot
06); the engine node lights for engine tools (screenshot 06).
Status: MET.

**R44. Nodes float smoothly.**
Quote: "The frontend should be smooth where nodes are floating."
Evidence: each node drifts on a slow, per-agent wander plus a spring to its seat
(`layout.ts:57-58`, `paint.ts:74-91`), painted per animation frame without React re-render
(`graph.tsx:49-57`). Reduced-motion users get fades (`use-playback.ts:99-111`).
Status: MET.

**R45. Spawning bursts, smoothly.**
Quote: "spawning shows a nice animation around as if its bursting (in a smoother sense)."
Evidence: a node scales in on a spring with one soft ring that expands and fades
(`paint.ts:84-97`); satellites bud with a smaller spring (`paint.ts:142`).
Status: MET (seen in code and in the stage-by-stage arrival of nodes across screenshots 02, 03, 06;
motion quality judged from the code, not from video).

**R46. Replace the Simulation page (interpretation).**
Quote: "Replace the simulation page with this."
Met means: the nav entry that led to Simulation now leads to the Council.
Evidence: `frontend/components/shell/nav.ts:15-16` ("Council" at `/council`, no Simulation entry),
commit `5a8a587`; the nav in screenshot 01 shows Council highlighted and no Simulation. `/simulation`
still answers 200 and is linked from the verdict as "How the engine was checked"
(`verdict.tsx:136`).
Status: MET (interpretation: replaced in the nav, the old page kept as the engine's backtest).

**R47. A replay player.**
Quote: "I want to have like a replay player where I can see how agents are being spawned and how
they are finally agreeing on something."
Met means: play, pause, speed, scrub, jump to a stage.
Evidence: `player.tsx` (play and pause, 0.5x to 4x, a scrubber with stage marks, nine stage
buttons), keyboard space, arrows and 1 to 9 (`replay.tsx:54-70`); run 1 plays in 3:51
(screenshots 02 to 08); keys 3, 6 and 9 jumped to the drafts, cross-examination and decision
stages in the browser.
Status: MET.

**R48. See agents being spawned over the meeting.**
Quote: "see how agents are being spawned."
Evidence: agents join the first time they act (`stages/join.ts`): the engine and Chair first
(screenshot 02), the eight proposers at drafts (screenshot 03), Treasury, Foreign Affairs and the
Red Cell at cross-examination (screenshot 06).
Status: MET.

**R49. See how they finally agree.**
Quote: "how they are finally agreeing on something."
Met means: the replay shows the room converging on the plan.
Evidence: ratings appear as ticks on plan cards ("5.4 of 10 from 7 seats", screenshot 08), the
Chair's decision message to all seats, and a "Chosen" badge. But the code never emits `concede`
or `dissent` acts (`grep` in `backend/src/agents/council` finds none), critics only "support" or
"challenge" (`cross-examination.ts:42`), and database message acts show 0 concessions in runs 1,
2 and 7. Agreement is decided by the matrix, and the minority report (run 7) says "The Committee
adopted the score, not these answers."
Status: PARTIAL.
Missing: no visible moment where seats come round or record dissent on the chosen plan.
Smallest change: after the decision, one short closing turn per seat that answers "support" or
"dissent" on the chosen plan with one line (acts already exist in `MessageAct`), drawn as the
last wave of pulses to the Chair.

**R50. Convene with a single button.**
Quote: "we run it by just clicking a single button."
Evidence: "Convene the council" (`start-panel.tsx:111-121`, screenshot 01); a second press while a
run is going attaches to it instead of failing (`lib/api/council-client.ts:43-56`). Not pressed in
this audit.
Status: MET for the page (see R37 for what executes the run).

**R51. The selector is limited to KL and surroundings.**
Quote: "For now, just make the selector that we are focusing on taking down the haze around KL and
surroundings."
Evidence: a select with Kuala Lumpur and surroundings enabled and Johor Bahru, Kuching and Penang
listed as "(later)" and disabled (`package.ts:42-47`, browser snapshot of `/council`, screenshot
01).
Status: MET.

**R52. When the button is pressed, the focus is obvious.**
Quote: "Show this when that button is clicked so that this is obvious."
Met means: after pressing, the objective "Clear the haze over Kuala Lumpur and surroundings" is
prominent.
Evidence: the replay always opens with the objective card (screenshots 02 and 15); when the
person has just convened, the card rises in with a warm flash (`objective-card.tsx:13-32`, driven
by `arrived` set in `council-experience.tsx:57`). The animation itself was not observed, since the
audit could not press the button.
Status: MET (card seen; arrival animation verified in code only).

### H. The verdict

**R53. Before and after map of the simulation after removing the hotspots.**
Quote: "show the final verdict, which is as simple as the simulation after removing hotspots
(which should be similar to map)."
Met means: two maps of the region, without and with the plan, on the map's own colours.
Evidence: `verdict-map.tsx:107-134` draws both from the engine's full run, with the API legend;
run 7 renders it (screenshot 14). Run 1 has no maps and shows the fallback outline (screenshot
10). Weaknesses seen in screenshot 14: the two panels look almost the same at this scale because
the plan removes a few ug/m3 in a field of 50 to 300, and numbered markers overlap near Jambi and
Johor; the design's slider (`09-page.md:101`) and a difference view were not built.
Status: MET (on run 7; on the current code see R65).

**R54. The hotspots taken out are shown.**
Quote: "the hotspots being taken out."
Evidence: numbered markers on the map and the strike list (screenshots 10 and 14).
Status: MET (ordering caveat in R03).

**R55. The strategy is shown.**
Quote: "the strategy."
Evidence: three tracks, "Do now", "Ask Indonesia for", "Tell Indonesia" (`verdict.tsx:19-23,94-104`,
screenshot 09); the plan's assets and days per fire (strike list).
Status: MET.

**R56. The reasoning is shown.**
Quote: "and the reasoning."
Evidence: "Why this plan" with the Chair's reasoning, the PM2.5 chart and the comparison with
the computer's plans; "What could go wrong" with the minority report, re-planning triggers and
caveats (screenshots 11 and 12).
Status: MET.

**R57. Concise, readable, a good flow.**
Quote: "Make this concise, easily readable, easily followed like a good flow."
Met means: a short page that reads top to bottom, answer first.
Evidence: order is headline, three facts, three tracks, map, strike list, why, cost, risks
(`verdict.tsx:86-132`). Answer fields are capped (`answers.ts:70-78`: 20-word headline, 30-word
tracks, 100-word reasoning). Run 1 and run 7 verdict text is dense with codes and jargon ("By the
frozen rule ... P22 ... consent ask at C020", screenshot 09; "klBenefit 1.00, robustness 0.93",
screenshot 11), written before the plain-English prompts. On run 7 the chosen plan, a computer
plan, is also a baseline, so the comparison lists it twice and React warns of a duplicate key
`P13` (browser console on `/council?run=7&view=verdict`, `verdict-compare.tsx:24-27`).
Status: PARTIAL.
Missing: a finished verdict in plain words (R63), and the comparison lists a computer-made chosen
plan twice.
Smallest change: in `verdict-compare.tsx`, drop the baseline row whose `planId` equals
`verdict.planId` and label the chosen row "worked out by computer" when it is one.

**R58. The verdict compares the plan with simple rules.**
Quote: "The logic can't be as simple as just targeting the hotspots that have the largest flame."
Met means: the page shows the plan beside biggest-first, nearest-first and a computer search.
Evidence: `verdict-compare.tsx` (screenshot 12). Duplicate-row bug when the chosen plan is a
baseline (R57).
Status: MET.

### I. The follow-up instructions

**R59. Never touch the engine.**
Quote, follow-up (a): "a teammate is reworking the simulation engine, so work must not touch it
(never edit backend/src/haze/)."
Met means: no council commit changes `backend/src/haze/`.
Evidence: `git log 9cb1fa7^..HEAD -- backend/src/haze/` is empty and
`git diff --stat 9cb1fa7^ HEAD -- backend/src/haze/ backend/src/jobs/forecast.ts` is empty; the
council only imports engine functions read-only through one seam
(`services/suppression-engine.ts:1-13`), plus `distanceKm` (`context.ts:2`) and `apiToPm25`
(`score.ts:2`).
Status: MET.

**R60. The council survives the engine rework (one seam).**
Quote, follow-up (a): "a teammate is reworking the simulation engine."
Met means: the engine is reached through one interface with a fake for tests.
Evidence: `SuppressionEngine` (`suppression-engine.ts:25-29`); the council test passes an inline
fake (`test/agents/council-run.test.ts`, `run()`), not one in `__fakes__/` as `CLAUDE.md` asks;
`services/suppression-inputs.ts` also imports engine modules directly (`haze/fires`, `haze/grid`,
`haze/smoke`, `haze/transport`, lines 2 to 5), so a reworked engine changes this file and
`suppression-engine.ts`, which is what `06-engine-seam.md` expects ("only this file changes" is
in fact two files).
Status: MET.

**R61. Many markdown docs track the work.**
Quote, follow-up (b): "keep many markdown docs to track work."
Met means: the folder has docs per topic and they are current.
Evidence: 20 files in `docs/council/` (README, log, spikes, decision model, package, roles,
protocol, seam, tools, events, page, open questions, prototype, build, runs, spec, five research
files).
Status: MET (currency is R62).

**R62. The docs are accurate about what is built.**
Quote, follow-up (b), as above.
Met means: what the docs say is built matches the code.
Evidence of drift: `README.md:11` still says "The nav still points at the old Simulation page
until the switch" (switched in `5a8a587`); `00-log.md` ends at phase 1 (line 34) and omits phases
2 to 6, runs 1 to 4, the budget and the plain-English work; `12-build.md:52` still says the second
round runs "if ... the budget (130 calls) allows", while `run.ts` has no call budget and up to three
rounds; `07-tools-and-skills.md:49-50` lists `writing-a-plan` and `cross-examination`, never built;
`09-page.md:101` promises a slider; `06-engine-seam.md` promises the matrix-versus-full-run check;
`04-council-roles.md` names tools (`get_costs`, `get_consent`, `get_peat`, `get_fire_history`,
`get_guidelines`) that are `get_consent_and_costs` and `get_complex` in code; `spec.md` section 6
gives "80 model calls and 25 minutes hard cap".
Status: PARTIAL.
Smallest change: a status pass over README, 00-log, 04, 07, 09 and 12 marking each item built,
changed or dropped.

**R63. The verdict is in plain, simple English.**
Quote, follow-up (c): "the verdict must be in plain, simple English."
Met means: the verdict a person reads has no codes or jargon, short sentences, places named.
Evidence: every current prompt carries a "Plain English" section that bans the jargon and codes
and asks for place names (`prompts/council-decide/v3.md` and the other current versions; `grep`
shows the section in all seven current files and in none of the older ones); answer fields are
capped (`answers.ts:70-78`); the verdict page's own labels are plain ("Do now", "Ask Indonesia
for", "Tell Indonesia", "Cleaner air for KL: 11% of what is possible", screenshot 09). Live
meeting text in run 8 is plain (R67). Not seen: run 8's verdict, which had not been written when
the audit stopped. The only finished verdicts (runs 1 and 7) were written by the old prompts and
are full of codes ("adopts P13", "klBenefit 1.00", "R10", database `verdict` of runs 1 and 7).
Status: PARTIAL (in place in prompts and page, not yet verified on a finished verdict).
Missing: a finished run on the plain-English prompts, read in full.
Smallest change: read run 8's verdict when it finishes and record it in `13-real-runs.md`; if a
code slips through, the prompt is already explicit, so a post-check in `verdict.ts` that flags
`\b[CP]\d+\b` in the headline and tracks would catch it.

**R64. Budget means money, shown as cost against the budget.**
Quote, follow-up (d): "'budget' means the Malaysian government's limited MONEY for the operation."
Met means: the budget is ringgit, chosen by the person, enforced, and talked about in money.
Evidence: R04 for the code; the start panel offers RM 4, 8 or 12 million and says the real figure
is not public (screenshot 01); run 8's `run_started` carries `budgetRm: 8000000` and its row in
`council_runs` has `budget_rm 8000000`; 26 of run 8's messages state money ("The money available
is RM 8.0 million"; Air Operations: "within the RM8 million budget"); none of run 8's tabled plans
was refused for cost (no `budget` violation in its `candidate` events). The verdict's cost section
(`verdict-cost.tsx`, `verdict.tsx:45-49`) shows "Not worked out" for run 1, which had no budget
(screenshot 09); the cost of a finished budgeted verdict is checked under R65.
Status: MET.

**R65. Before and after maps on the new code.**
Quote: "the simulation after removing hotspots (which should be similar to map)."
Met means: a finished run on the current code has before and after maps, a cost against the
budget, and plain words, all rendered on the page.
Evidence: the map path is unchanged since it was built (`git log 5e503cb..HEAD --
backend/src/services/suppression-engine.ts` is empty) and it worked on run 7 (screenshot 14);
the cost line is in the contract (`Verdict.cost`, `contracts.council-run.ts`) and asserted in
`test/agents/council-run.test.ts` (cost within the RM 8 million budget). Run 8 had not finished
when the audit stopped, so no budgeted verdict with maps was seen on the page.
Status: PARTIAL (not yet verified live).
Missing: open `/council?run=8&view=verdict` after run 8 finishes and check the three facts, the
cost section, the maps and the wording.

**R66. Model calls are not capped.**
Quote, follow-up (d): "model calls may be used as much as needed."
Met means: no call or token limit stops the meeting early.
Evidence: `run.ts` counts calls only for the record (`run.ts:74-80,137`) and has no call budget;
rounds stop on a stable leader, at most three (`run.ts:34-35`); commit `641efc3` "Give the council a
money budget instead of a call limit". Run 7: 90 calls (`docs/council/13-real-runs.md`).
Status: MET.

**R67. The replay's words are plain English too.**
Quote, follow-up (c) read with "Make this concise, easily readable."
Met means: gists, headlines and captions avoid codes and jargon.
Evidence: of run 8's thinking gists and message headlines written by 22:45 MYT, 0 of 183 contain a
complex or plan code, "ceiling", "maximin" or "wind member" (query: `payload->>'gist' ~
'\mC[0-9]{3}\M|\mP[0-9]+\M|ceiling|maximin|wind member'` and the same on `headline`); in run 1
it was 56 of 78 gists and 28 of 36 headlines. Example run 8 headlines: "Fight Johor's two new
fires first, with no permission needed, then send Bomba's ground pump and lance crews to the
peat fires in Central Kalimantan"; "Keep the two Johor fire details to three days, not
fourteen". No headline uses a dash as punctuation. Residual: the engine's opening message still
attaches the raw fact sheet ("The ceiling is the mean fire-smoke PM2.5 ...", ids such as C003)
under "Read the full text", and seats' full texts still cite ids in brackets, as the prompt allows.
Status: MET.
