# Checklist verification

An independent check of `14-requirements-checklist.md`, written 10 October 2026 on branch
`haze-product` at HEAD `b950468` (032f8f0 plus the README line for the council service). Every
item was checked again from the code, the tests, the database and the page, without relying on
the auditor's evidence. Nothing in the code or the database was changed.

How it was checked:

- Code read at HEAD: `backend/src/agents/council/` (run, context, seats, stages, tools, prompts),
  `backend/src/suppression/`, `backend/src/contracts.council-run.ts`, `backend/src/jobs/council-worker.ts`,
  `compose.yaml`, `frontend/components/council/`, `frontend/components/shell/nav.ts`, the docs.
- Tests run: backend `pnpm test` (28 files, 210 tests, all pass) and `pnpm type-check` (clean);
  frontend `pnpm type-check`, `pnpm lint` (clean) and `pnpm test` (10 files, 86 tests, all pass).
- Database, read only (`council_runs`, `council_events`): runs 1, 2, 7, 8 and 20.
- The page: the compose stack's frontend on port 3000, rebuilt from HEAD by the main session at
  about 22:55 MYT, driven with Playwright. Screenshots are in the session scratchpad,
  `.../scratchpad/check/`, named `check-01` to `check-06` and cited by number. "Convene the
  council" was never pressed.

About the live runs. Run 8 finished at 22:57 MYT (141 model calls, 59 minutes, budget RM 8
million, maps present). It was executed by a process started before 032f8f0, so it has the
plain-English prompts and the money budget but not the closing round, the source breakdown or the
new strike order. Run 20, the first run with every fix, was queued through `POST /council/runs`
and picked up by the compose `council` worker, then stopped by the main session after its first
event because the user asked for a redesign. So the closing round and the source breakdown are
verified in code and tests only.

The redesign. While this check was running the user changed the brief: Indonesia is now assumed
to allow all air activity and every support asked (no consent rules, no request lag, no diplomacy
criterion, no "Ask Indonesia" track), and the council keeps only the most relevant seats (Foreign
Affairs, Sarawak and Health go; Force Command and Domestic Fire merge into one Fire Operations
seat). An item whose substance is Indonesian consent, diplomacy or a removed seat is marked
SUPERSEDED instead of judged. Items that will need checking again after the redesign are listed at
the end.

Labels used: AGREE (same status as the auditor), DISPUTE (I read the evidence differently),
UPDATED (the status differs only because of a change made after the audit, which I verified),
SUPERSEDED (replaced by the user's new instruction).

## Summary

| | Count |
| --- | --- |
| AGREE | 58 |
| DISPUTE | 1 (R06) |
| UPDATED | 7 (R08, R12, R34, R37, R49, R57, R65) |
| SUPERSEDED | 1 (R15) |

My final counts at HEAD:

| Status | Count |
| --- | --- |
| MET | 63 |
| PARTIAL | 3 (R03, R62, R63) |
| NOT MET | 0 |
| SUPERSEDED | 1 (R15) |
| Total | 67 |

The three that are not met, and the smallest change for each:

1. **R03, the order of attack still puts fires first that cannot be worked first.** The new sort
   uses the start day the plan writes, not the day work can begin. A Sumatra line written "day 1"
   cannot start before day 4 to 7 (consent), and a ground crew written "day 1" works from day 2
   (travel). Fix: in `verdict.ts` `strikeList`, take `fromDay` as the earliest `arrivalDay(line)`
   (`suppression/effect.ts:18`) instead of `line.fromDay`. After the redesign the consent part
   goes away but the travel day stays, so the fix is still needed.
2. **R63, the verdict a person reads still carries plan and fire codes.** Run 8, on the
   plain-English prompts, writes "(P12)" and "P28" in its reasoning, and every verdict's comparison
   lists "Biggest fire first: everything on C003", "Nearest fire first: everything on C454" and
   "Greedy search, ...", titles made by code. Fix: name the baselines in plain words with the
   place (`baselines.ts:47,53,93`), and give the Chair plan titles instead of ids in the decision
   input (or replace `\bP\d+\b` with the plan's title in `buildVerdict`); a prompt change is a new
   `council-decide/v4.md`.
3. **R62, some docs and one page string still describe what was not built.** Listed under R62.

## The items

### A. What the system answers

**R01. Say which hotspots to take down.** Auditor MET, mine MET, AGREE.
`verdict.ts:24-50` builds the strike list (place, province, country, peat, assets, days, consent,
share). Run 8 verdict names five fires: near Muaro Jambi and near Simpang (Jambi), near Senggarang
and near Pekan Serkat (Johor), near Seruyan (Central Kalimantan), each with what is sent (query on
`verdict->'strikeList'`; screenshot check-06).

**R02. The unit of attack is a group of hotspots.** Auditor MET, mine MET, AGREE.
Complexes in `suppression/complexes.ts`; tests "puts every burning cell in exactly one complex"
and "keeps every complex compact, so a task force can be sent to it" pass.

**R03. Say which to take down first, in order.** Auditor PARTIAL, mine PARTIAL, AGREE (the
post-audit fix is incomplete).
`verdict.ts:47-48` now sorts by `fromDay`, then share, and the test "says where KL's coming smoke
comes from, by area, adding up to the whole" asserts the list is sorted by `fromDay`. But
`fromDay` is the day the plan writes, while the effect model starts work at
`arrivalDay = max(fromDay, earliestWithConsent or travel)` (`effect.ts:18-24`; consent lags 4, 4,
5 and 7 days in `package.ts:49,60,71,93`). Query on `candidate` events: in runs 1, 2, 7 and 8, 34
assignment lines that need consent are written to start before day 4 (for example run 7's chosen
plan P13 has the CL-415 and a helicopter on Jambi from day 1). Under the new sort, run 7's list
would number the Jambi fire 1 with "Day 1 to 14", although nothing can work there before day 4,
and the page note says "Day 1 is the first day the team can work" (`verdict-strikes.tsx:67`).
Run 8's stored list still shows the old order (Jambi day 5 numbered 1 and 2, Johor day 1 numbered
3, screenshot check-06) because its verdict was built by the older process; older verdicts are not
re-sorted. Missing: order and days by when work can actually begin. Smallest change: use the
earliest `arrivalDay` per complex for `fromDay` in `strikeList`.

**R04. Limited money is a hard constraint.** Auditor MET, mine MET, AGREE.
`validate.ts:82-83` refuses a plan over budget; `context.ts:94-97` validates every tabled plan
against `budgetRm`; test "refuses a plan that costs more than the budget" passes. Live: run 8
verdict cost RM 7,930,000 of RM 8,000,000 (query `verdict->'cost'`), shown as "RM 7.9 million.
Of the RM 8.0 million the government set aside" (check-05).

**R05. Limited manpower is a constraint.** Auditor MET, mine MET, AGREE.
Per-day and days-worked caps for every asset line, `validate.ts:71-81`; test "refuses more
aircraft than Malaysia has, on any one day".

**R06. Limited fleet is a constraint.** Auditor PARTIAL, mine MET (interpretation), DISPUTE.
The fleet is limited where it matters: one CL-415 for ten days, three helicopters, two lance
teams, per day and in total (`package.ts`, `validate.ts:71-81`, tests "refuses more aircraft..."
and "refuses the CL-415 past its ten operating days"). The 25 km water reach is shown, not
enforced, by decision (`02-decision-model.md:26`, `10-open-questions.md:59`): the land outline has
no rivers, and the Batang Hari beside the Jambi fires can be scooped from, so the coded rule would
wrongly bar real targets. The reach is in front of the seats who own it: `get_logistics`
(`tools/get-logistics.ts:18`, "sea beyond the scooper's reach unless a river run is confirmed")
belongs to Force Command, Air Operations and Domestic Fire (`seats.ts:93,106,119`), and the Air
Operations brief states the 25 km run (`seats.ts:105`). The two chosen plans that used the CL-415
sent it to complexes 14 km from open sea (runs 7 and 8, computed with `suppression/coast.ts` from
the strike-list coordinates). "Limited fleets/resources" in the brief is about how much Malaysia
has, which is enforced; where a scooper can fill is a refinement that a hard sea-only rule would
get wrong. Residual risk, not a gap: nothing stops a future winning plan from sending the scooper
inland; a bundled river layer would let the validator enforce it.

**R07. Limited time is modelled.** Auditor MET, mine MET, AGREE.
14 days in theatre, day 1 two days after the data (`package.ts`, `analogue.ts`), travel and
consent lags (`effect.ts:18-24`), rule R8 (`situation.ts:22`); test "does nothing before the crews
can arrive". The clause "requests to Indonesia take time" is superseded by the redesign; the rest
stands.

**R08. Limited resources and time are emphasised strongly.** Auditor PARTIAL, mine MET, UPDATED.
Resources: rule R11 and the money line (`situation.ts:25,49`), the Treasury seat, the budget
selector and assumed chips (check-02), the cost fact and section. Time: `clears()` in
`verdict.tsx:26-30` is now under the "Cleaner air for KL" fact, from `score.arrivalHours`. Seen on
the page: "KL starts to feel it after about 3 days." on run 7 and on run 8 (check-05; run 8
`arrivalHours` 64). The "Days" column and the 14 days chip remain.

**R09. As quick as possible.** Auditor MET, mine MET, AGREE.
The score is the mean over the horizon, so earlier relief counts for more hours (`score.ts:59-77`);
arrival is now shown (R08).

### B. Where the haze comes from

**R10. The closest hotspot is not assumed to be the cause.** Auditor MET, mine MET, AGREE.
Rule R1 (`situation.ts:15`), the nearest-first baseline (`baselines.ts:50-54`). Run 8: "Nearest
fire first" 0.00% against the verdict's 12.5% (query on `verdict->'baselines'`).

**R11. A quick way to know where a place's haze comes from.** Auditor MET, mine MET, AGREE.
Per-run attribution (`services/suppression-engine.ts`), shares in every fact-sheet line, the
`get_influence` tool, the `reading-influence` skill's prior. The interpretation (fresh per run,
not stored) is reasonable because the wind decides.

**R12. The person can see where KL's haze comes from.** Auditor NOT MET, mine MET (verified in code
and tests only), UPDATED.
`sharesByArea` (`attribution.ts:61-85`) sums each complex's share of the ceiling by area (Sumatra,
Kalimantan, Peninsular Malaysia, Sarawak and Sabah) plus "Smaller or farther fires", averaged over
wind members. It feeds the verdict (`verdict.ts:85`, contract `sources` at
`contracts.council-run.ts:137`, mirrored in `frontend/lib/api/council-schemas.ts:147`), drawn as
"Where KL's smoke is coming from" with bars (`verdict.tsx:32-47,130-135`), and the engine's
opening message (`run.ts:105`). Test "says where KL's coming smoke comes from, by area, adding up
to the whole" passes. Not seen live: runs 1, 7 and 8 have `sources` null, and run 20 stopped before
its opening message. Note: in the replay the breakdown is in the message's full text, behind "Read
the full text"; the headline still says only "ten of them make X%".

**R13. The Sumatra and Kalimantan picture is reflected.** Auditor MET, mine MET, AGREE.
Spike 2 (`01b-spike-plans.md`), the skill's prior; all three finished verdicts put their main
work in Jambi, Sumatra (runs 1, 7, 8).

### C. Malaysia's support

**R14. Work out what Malaysia can provide.** Auditor MET, mine MET, AGREE.
`research/02-campaigns-capacity.md`, `03-assistance-package.md`, fact or assumption per line in
`package.ts`.

**R15. The Prime Minister's commitment is the premise.** Auditor MET, mine SUPERSEDED.
The premise was the package accepted for Kalimantan only. The user's new instruction replaces it:
Indonesia allows all air activity and every support asked.

**R16. Assumed numbers are marked as assumptions.** Auditor MET, mine MET, AGREE.
Dashed "assumed" chips, "What this rests on" and "The government's real figure is not public"
(check-02; `start-panel.tsx:86,99,106`).

### D. Feeding plans to the simulation engine

**R17. The chosen hotspots are removed and run through the engine.** Auditor MET, mine MET
(interpretation), AGREE.
Matrix scoring (`score.ts:38-51`) and a full engine run for the maps (`run.ts:61-67,135`); run 8
has maps (`jsonb_typeof(verdict->'maps')` = object, at 2026-10-21 00:00 UTC). Still missing, as
the auditor said: the promised check that matrix and full run agree, now recorded as open
(`06-engine-seam.md:61`).

**R18. The engine gives an AQI forecast for the target after the plan.** Auditor MET, mine MET,
AGREE.
PM2.5 chart with the API 100 line and API-coloured maps (check-01, check-06).

**R19. The target is KL and surroundings.** Auditor MET, mine MET, AGREE.
`targets.ts`; test "refuses an area the council cannot be asked about yet".

**R20. Candidate plans go to the engine to choose the best.** Auditor MET, mine MET, AGREE.
`simulation` events: run 1 20, run 7 20, run 8 26. Engine benefit and robustness are 0.65 of the
default weights.

### E. The reasoning

**R21. Not just the largest flame.** Auditor MET, mine MET, AGREE.
Run 8: "Biggest fire first" 0.19% against 12.5%.

**R22. Many interacting variables.** Auditor MET, mine MET, AGREE.
Fact-sheet lines, three effect scenarios, four wind members, consent, cost, caps.

**R23. A fire in a cluster is relit by fires left burning.** Auditor MET, mine MET, AGREE.
`keepTable` pressure (`score.ts:26,32`), `neighbourRelapse` (`effect.ts:64`); test "lets peat
relight once the crews leave, and more with fire next door" passes.

**R24. The reasoning is extensive and visible.** Auditor MET, mine MET, AGREE.
Counts by kind: run 1 36 messages, 78 gists, 142 tool calls; run 7 46 messages, 80 gists, 157 tool
calls (the checklist says 45 and 149, a small miscount that changes nothing); run 8 74 messages,
129 gists, 247 tool calls.

**R25. Research on how hotspots are taken down.** Auditor MET, mine MET, AGREE.
`research/01-suppression-science.md`, 750 lines, 80 lines with links.

**R26. Historical strategies.** Auditor MET, mine MET, AGREE.
`research/02` sections 3 and 4, used in `package.ts` and the skills.

**R27. Research becomes prompts, skills and tools.** Auditor MET, mine MET, AGREE.
Eight prompt steps now (the closing step `council-close/v1.md` added), five skills, eleven tools
(`tools/index.ts:20`). No prompt file was edited after it was first committed (git log per file).

**R28. Each role gets only its tools.** Auditor MET, mine MET, AGREE.
`callCouncilTool` refuses a tool not on the seat's list (`tools/index.ts:30-34`).

### F. The multi-agent council

**R29. A multi-agent framework.** Auditor MET, mine MET (interpretation), AGREE.
Staged orchestration, each seat its own structured-output calls; run 8 made 141 calls.

**R30. Agents discuss and challenge each other.** Auditor MET, mine MET, AGREE.
Message acts: challenges and revisions run 1 19 and 5, run 7 29 and 4, run 8 52 and 10.

**R31. They continue until a verdict.** Auditor MET, mine MET, AGREE.
Up to three rounds while the leader changes (`run.ts:35,119-129`); the bar below 3 of 10
(`comparison.ts:72,97-99`, `decision.ts:24-27`).

**R32. Role-play ministers and experts from around Malaysia.** Auditor MET, mine MET, AGREE.
Twelve seats by office (`seats.ts`), "role-played by AI" on the start panel, replay and verdict
(check-02, check-03, check-05).

**R33. The choice of agents is decided and justified.** Auditor MET, mine MET, AGREE.
`04-council-roles.md`.

**R34. Sub-agents are spawned.** Auditor PARTIAL, mine MET (interpretation), UPDATED.
The brief asked the team to decide which agents and sub-agents to spawn. The decision is now
recorded: no separate helper agents, a seat's lookups are the small nodes
(`08-replay-events.md:48`). That was one of the auditor's two allowed fixes. Leftover: `09-page.md:61`
still describes a sub-agent visual (see R62).

**R35. Data-driven, unsupported figures flagged.** Auditor MET, mine MET, AGREE.
Test "flags a figure the seat was never shown" passes; `stages/say.ts`, `fact-check.ts`.

**R36. Candidates and final choice are separate.** Auditor MET, mine MET, AGREE.
Screening then decision; run 8 chose P29, a revised council plan, over the computer's best (P12,
7.1% against 12.5%).

**R37. One button runs the long job and returns a verdict.** Auditor PARTIAL, mine MET, UPDATED.
`compose.yaml:123-135` adds the `council` service (`council-worker.ts loop`); the root README now
lists it (`README.md:46`, commit `b950468`). Seen live: run 20 was queued through
`POST /council/runs`, the call the button makes, and the compose container logged
`"run":20 ... "council run started"` and built the attribution (804 complexes, 4 members) before
the main session stopped it. A full verdict through this path was not seen, because of the stop.
Two notes: the start panel says "A meeting takes ten to twenty minutes" (`start-panel.tsx:61`)
while runs took 22, 29 and 59 minutes; and a worker that dies mid-run leaves the run "running",
which the unique index then uses to refuse every new run (`council.repo.ts:80,89-97`), so the
button would stay blocked. Marking runs left "running" as failed when the worker starts would
close that.

**R38. A live run can be watched.** Auditor MET, mine MET, AGREE.
3 s polling (`use-council-run.ts:15`); the start panel offered "Watch live" for run 8 while it
ran (check-02).

### G. The visualisation

**R39. Agents are nodes.** Auditor MET, mine MET, AGREE. Check-03, check-04.

**R40. A message is a transmission from A to B.** Auditor MET, mine MET, AGREE.
Pulses along curved edges (`paint.ts`, `scene.ts`); faint threads between seats in check-03.

**R41. Not noisy.** Auditor MET, mine MET, AGREE.
Non-focus agents dim (`paint.ts:87`), threads capped at 0.42 opacity (`paint.ts:122`), one caption
line (check-04: "Health reads a skill.").

**R42. Show an agent thinking.** Auditor MET, mine MET, AGREE. Halo in `paint.ts`, gist in the rail.

**R43. Tool calls spawn smaller nodes.** Auditor MET, mine MET, AGREE.
Satellites on tethers by Foreign Affairs, Meteorology, Peat Science, Health and Air Operations in
check-04.

**R44. Nodes float smoothly.** Auditor MET, mine MET, AGREE. Code as cited; motion seen while
playing.

**R45. Spawning bursts smoothly.** Auditor MET, mine MET, AGREE (code; motion not filmed).

**R46. Replace the Simulation page.** Auditor MET, mine MET, AGREE.
Nav is Map, KL in 3D, Alerts, Council, Sources (page evaluation of `nav a`; `nav.ts:11-18`).

**R47. A replay player.** Auditor MET, mine MET, AGREE.
Play and pause, 0.5x to 4x, scrubber, nine stage buttons; key 6 jumped to "Stage 6 of 9:
Cross-examination" (check-03).

**R48. See agents being spawned.** Auditor MET, mine MET, AGREE.
Treasury, Foreign Affairs and Red Cell appear at cross-examination (check-04 against check-03).

**R49. See how they finally agree.** Auditor PARTIAL, mine MET (verified in code and tests only),
UPDATED.
After the Chair's decision every member except the Chair answers `support` or `dissent` with one
sentence to the Chair (`stages/closing.ts:26-42`, called at `decision.ts:57`; prompt
`council-close/v1.md`, which asks for honesty and plain words). Captions: "X stands behind the
decision." and "X does not stand behind the decision." (`caption.ts:40-55`). Test "ends with every
member saying whether they stand behind the decision" passes (at least ten members, at least one
dissent with the fake model). Not seen live: run 8 predates it and run 20 stopped. The closing
words are in the replay only, not on the verdict page.

**R50. Convene with a single button.** Auditor MET, mine MET, AGREE.
`start-panel.tsx:114-118`; a second press attaches (`council-client.ts:42-47`).

**R51. The selector is limited to KL.** Auditor MET, mine MET, AGREE.
Options: Kuala Lumpur and surroundings; Johor Bahru, Kuching, Penang "(later)", disabled (page
evaluation).

**R52. The focus is obvious after pressing.** Auditor MET, mine MET, AGREE.
Objective card on every replay (check-03); arrival animation in `objective-card.tsx:13-32`, not
pressed.

### H. The verdict

**R53. Before and after map.** Auditor MET, mine MET, AGREE.
Run 8 renders both maps with the API legend (check-06). Same weakness as the auditor saw: the two
panels look the same to the eye (2.2 ug/m3 removed in a field of 50 to 300), and markers 1 and 2
overlap near Jambi. A third panel showing the difference would make the effect visible.

**R54. The hotspots taken out are shown.** Auditor MET, mine MET, AGREE. Numbered markers and the
strike list (check-06); order caveat in R03.

**R55. The strategy is shown.** Auditor MET, mine MET, AGREE. Three tracks (`verdict.tsx:19-23`),
run 8 text in check-05.

**R56. The reasoning is shown.** Auditor MET, mine MET, AGREE.

**R57. Concise, readable, a good flow.** Auditor PARTIAL, mine MET, UPDATED.
The duplicate row is gone: `verdict-compare.tsx:24-28` drops the baseline equal to the chosen plan
and labels the chosen row "(one worked out by computer)". Seen on run 7: one chosen row, three
baselines, and no React key warning (console showed only a favicon 404). Run 8's verdict reads top
to bottom in plain sentences (check-05). The codes that remain are counted under R63.

**R58. The verdict compares with simple rules.** Auditor MET, mine MET, AGREE.
Run 8: biggest-first 0.19%, nearest-first 0.00%, the two computer searches 5.7% and 7.1%, against
12.5%.

### I. The follow-up instructions

**R59. Never touch the engine.** Auditor MET, mine MET, AGREE.
`git log 9cb1fa7^..HEAD -- backend/src/haze/` is empty.

**R60. One seam to the engine.** Auditor MET, mine MET, AGREE.
`SuppressionEngine` in `services/suppression-engine.ts`. As the auditor noted: the fake is inline
in the test, not in `__fakes__/`, and `suppression/` imports engine helpers read-only in six files
(`grid`, `api-index`, `land-outline`, `transport` types).

**R61. Many markdown docs.** Auditor MET, mine MET, AGREE. 20 files in `docs/council/`.

**R62. The docs are accurate.** Auditor PARTIAL, mine PARTIAL, AGREE.
Fixed since the audit: README status, `00-log.md`, `12-build.md` (no call limit), `09-page.md:101`
(no slider), `06-engine-seam.md:61`, `07` (five skills, why two were dropped). Still wrong:
`07-tools-and-skills.md:20-25` lists `get_fire_history`, `get_peat`, `get_consent` and `get_costs`,
which do not exist (the code has `get_complex` and `get_consent_and_costs`); `07:12-13` promises
`factIds` that are not built (no match in `backend/src`); `07:58-60` lists a `council-screen` prompt
that does not exist, omits `council-premortem` and `council-close`, and says "ten seats";
`04-council-roles.md:34` gives Health `get_guidelines`; `09-page.md:61` describes a sub-agent node;
`spec.md:116` says "About 45 to 65 calls per run" (runs used 80, 90 and 141); the page string
"A meeting takes ten to twenty minutes" (`start-panel.tsx:61`). Smallest change: one pass over
`07`, `04`, `09`, `spec.md` and that string. The redesign will rewrite `04` and `05` anyway.

**R63. The verdict is in plain English.** Auditor PARTIAL, mine PARTIAL, AGREE.
Now seen on a finished run. Run 8's headline, three tracks, minority report and re-planning
trigger are plain, name places and use no dashes. But its reasoning says "The best plan worked out
by computer managed a fourteenth (P12)" and "that is why it beat the near identical P28", and
every verdict page shows the code-made titles "Biggest fire first: everything on C003", "Nearest
fire first: everything on C454", "Greedy search, within what Indonesia accepted" and "Greedy
search, if Indonesia agrees" (`baselines.ts:47,53,93`, rendered by `verdict-compare.tsx:27`;
check-01 on run 7, the same on run 8). Missing: no codes or jargon anywhere on the verdict.
Smallest change: plain baseline titles with place names, and plan titles instead of ids in what
the Chair is given (or a substitution in `buildVerdict`).

**R64. Budget means money, shown as cost against the budget.** Auditor MET, mine MET, AGREE.
Run 8: `budget_rm` 8000000, verdict cost 7,930,000 in six lines, page "RM 7.9 million. Of the RM
8.0 million the government set aside." (check-05).

**R65. Before and after maps on the new code.** Auditor PARTIAL, mine MET, UPDATED.
Run 8, the first budgeted plain-English run, finished with maps, cost and plain tracks, all
rendered (check-05, check-06). Its wording gaps are R63.

**R66. Model calls are not capped.** Auditor MET, mine MET, AGREE.
No call limit in `run.ts`; run 8 made 141 calls over 3523 s (`run_finished` payload).

**R67. The replay's words are plain English too.** Auditor MET, mine MET, AGREE.
Whole of run 8: 3 of 129 gists and 0 of 74 headlines match codes or jargon (same regular
expression as the checklist), against 56 of 78 and 28 of 36 in run 1. Residual: 8 of run 8's 29
plan titles carry codes or "Greedy" ("P12 with realistic Sumatra start dates", "P7 plus a scooper
at Simpang's surface flame", the four computer titles), shown in the plan tray and in the caption
"The computer puts forward a simple plan to beat: ..." (`caption.ts:60`). The R63 change to
baseline titles fixes four of them.

## To check again after the redesign

The redesign removes consent, request lags, the diplomacy criterion, the "Ask Indonesia" track and
three seats. These items will need checking again on the new code and a new finished run:

- R03: with consent gone, only the ground crews' travel day separates written and real start; the
  `arrivalDay` fix still applies.
- R07, R22: consent lag and consent leave the variables; time and the rest must still be modelled.
- R14, R16: the package and its fact or assumption marks (the "accepted for Kalimantan" wording on
  the start panel).
- R28, R30, R32, R33: fewer seats; cross-examination today always includes Foreign Affairs
  (`cross-examination.ts`); "from all around Malaysia" loses Sarawak; `04-council-roles.md` needs
  a new rationale.
- R31: the bar today covers feasibility and diplomacy; the diplomacy half goes.
- R36, R58: the two computer searches are split by "within what Indonesia accepted" and "if
  Indonesia agrees"; with full consent they become one.
- R08, R55, R57: the "Needs Indonesia to agree" fact and the "Ask Indonesia for" track go; the
  verdict layout must still read as three facts and a strategy.
- R12, R49: still to be seen on a finished run (sources and closing words).
- R62, R63, R67: new prompt versions and docs for the new protocol.
