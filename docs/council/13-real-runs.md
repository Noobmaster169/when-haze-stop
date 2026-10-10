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

## Run 2

Started after the fixes; recorded here when read.
