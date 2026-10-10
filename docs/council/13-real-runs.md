# Real runs

Full council runs on the real data through the real proxy, read in full, and what each one
changed. The event logs are in `council_events` of the local database; run 1 is also the
frontend's recorded fixture.

## Run 1, 10 October 2026, 20:09 to 20:31 MYT

Data as of 11:00 UTC on 10 October; plan day 1 = 12 October; four wind members; 804 complexes.
80 model calls, 21.6 minutes, 472 events.

### The verdict

Plan P22 (Meteorology's revision): the CL-415 and helicopters on C007 near Manismata, West
Kalimantan (within the accepted consent); 100 Bomba on the two Johor fires for four days; and
one combined request for two lance teams from day 5 and the 150-strong ground task force from
day 7 at C020 near Simpang, Jambi.

| | Expected share of the ceiling | Worst wind | Pessimistic |
| --- | --- | --- | --- |
| P22, the council's | 11.1% | 5.6% | 5.5% |
| Biggest fire first (code) | 0.17% | 0.04% | 0.01% |
| Nearest fire first (code) | 0.00% | 0.00% | 0.00% |
| Greedy, within accepted consent (code) | 6.4% | 1.1% | 4.2% |
| Greedy, if Indonesia agrees (code) | **15.5%** | **9.2%** | 5.0% |

Ceiling 18.1 ug/m3 averaged over the members. Strike list by share removed: C020 Jambi 5.2%,
the Johor fires 3.5% and 2.3%, C007 West Kalimantan 0.09%.

### What was good

- Grounded throughout: ids and figures from the sheet and the engine; the Chair's reasoning
  states the modest gain plainly and that P22 does not beat the greedy request plan.
- The mandates collided as intended. Foreign Affairs challenged every Sumatra ask; Sarawak
  pressed for Kalimantan; Air Quality said a domestic-only plan "leaves roughly 94% of the
  removable ceiling untouched"; Force Command flagged crews worked ten days without rest and
  unconfirmed water; Peat Science flagged air strikes on peat.
- Premises worked: eight drafts were genuinely different (domestic only, Sumatra air, Kalimantan
  concentration, peat crews in Jambi, a maximin backbone).
- The minority report recorded the Red Cell and Health's unresolved objection that the plan
  protects the mild wind member and leaves the worst one thin.

### What was wrong, and the fixes (commit 9cd1ec2)

| Observed | Fix |
| --- | --- |
| Four seat turns failed: on the last step the seat asked for more tools despite "this is your last step" | The last step's output schema has no calls and requires the answer, so the provider enforces it |
| The council's plan lost to the greedy request plan, which never came before the council | The greedy plans join the shortlist as contenders, critiqued and rated like any plan; revisions are shown the three best-scored plans on the board, including code's, and told to adopt and improve them under their premise (prompt council-revise v2) |
| The Chair took a plan's own text ("not re-simulated") over the engine's score line | council-decide v2: every engine line was computed when the plan was tabled; trust it over the plan's text; if the chosen plan was made by code, say so and say what the Committee added |
| A seat put another plan's id in its title ("P8: Consolidated maximin") | council-draft v2 and council-revise v2: never put a plan id in a title |
| The second round was skipped (80 calls against a 90-call budget) | Budget raised to 130 |
| The fact check flagged ids, ranges and a seat's own units ("C121", "-295", "90 Bomba") | Ids and PM2.5 are not figures; hyphens are not minus signs; a seat's own plan is part of what it was shown; the engine's code-written messages are not checked |
| The Red Cell's headlines were cryptic first sentences ("Everything that could fail did.") | Each pre-mortem item has its own one-sentence headline |
| Foreign Affairs' pressure moved revisions back to Kalimantan, where the engine shows almost no benefit | Not a bug: it is the consent trade-off the Committee must weigh. The archive of best plans and the greedy contenders now keep the engine's view in the room |

## Run 2, 10 October 2026, 21:11 MYT (incomplete)

The first run after the fixes. Its process was killed when the session that started it ended,
during the cross-examination (404 events); it is closed as failed with that reason and a
`run_failed` event, so its replay ends cleanly. What it showed before it stopped:

| Plan | Made by | Expected share of the ceiling | Worst wind |
| --- | --- | --- | --- |
| P12 | Greedy search, if Indonesia agrees (code) | 16.4% | 8.8% |
| P2 | Air Quality: crews and the task force on C005 and C014 in Jambi, Bomba in Johor | 14.3% | 8.9% |
| P3 | Health: the whole package on Jambi's two largest peat sources, Bomba in Johor | 13.6% | 7.6% |
| P13 | a critic's variant | 11.5% | 8.0% |
| P8 | Meteorology: South Sumatra C001 and C002 by request, Bomba in Johor | 11.3% | 7.6% |
| P11 | Greedy search, within accepted consent (code) | 6.4% | 1.2% |
| P1 | Domestic Fire: Bomba on the two Johor fires | 5.7% | 1.1% |

The best council drafts now come within two points of the greedy request plan (run 1's best
draft was 6.9%, its verdict 11.1%), and P2's worst-wind figure beats it. The greedy plans were
critiqued like any other: Force Command found the within-consent greedy plan "scatters Bomba
crews onto dead fires, misuses the sole scooper, and runs air crews 14 days straight with no rest
day", which the engine cannot see. Air Operations caught a draft sending the scooper to C005, 62
km from open sea.

Long runs are now started detached (`nohup`), so a session ending cannot kill them.

## Run 3, 10 October 2026, 21:29 to 21:58 MYT (run id 7)

The first complete run with the run-1 fixes (before the money budget and plain English). 90 model
calls, 28.6 minutes. The verdict carried the first before and after maps.

| Plan | Made by | Expected | Worst wind |
| --- | --- | --- | --- |
| P13, chosen | Greedy search, if Indonesia agrees (computer) | 16.4% | 8.8% |
| P3 | Air Quality: strike on the most influential Sumatra fires, Johor at home | 13.5% | |
| P22 | Air Quality, revised: aircraft on C014, peat teams on C005, task force on C018 and C020 | 13.4% | 7.1% |
| P14 | Air Operations' variant: Peat Science's plan plus aircraft where they can scoop | 12.0% | |
| P23 | Health, revised: Johor at home plus aircraft and peat crews on C005 | 11.5% | 7.9% |
| P12 | Greedy search, within accepted consent (computer) | 6.4% | |
| P1 | Domestic Fire: Bomba on the Johor fires | 5.7% | |

The council's own plans rose to 13.4% (run 1: 11.1%), but the matrix chose the computer's plan,
and the Chair said so plainly: "It was written by code, by greedy search. The Committee's
judgement did not beat it ... Judgement added the honest price: feasibility 0.36, diplomacy 0.10,
nine of eleven lines waiting on Sumatra consent." The minority report is the problem: Foreign
Affairs opposed (every consent-dependent asset goes to Sumatra, where a comparable request was
refused in 2019, while accepted Kalimantan gets nothing) and the Red Cell showed the plan splits
the task force into thirds too thin to finish any complex. "The Committee adopted the score, not
these answers."

**Fix (applied after run 3, for run 5 on):** the seats' ratings are no longer only a weighted
term. A plan whose owners rate it below 3 out of 10 on feasibility or on diplomacy is not eligible
while any plan clears both bars; the decision says when that happened. This is the veto the
research describes (Foreign Affairs or Force Command may block a plan on a hard constraint),
made by the ratings rather than by one voice.

## Run 4

Started 21:58 MYT (run id 8), the first run with the money budget (RM 8 million) and the
plain-English prompts; recorded here when read.
