# The meeting

**Simplified on 10 October 2026:** no diplomacy criterion, no consent rules and no "Ask
Indonesia" track (Indonesia is assumed to allow everything); eight agents (`04-council-roles.md`);
criteria KL benefit, robustness, feasibility and cost; three critics a plan; the verdict is one
"The plan" line, the reasoning, the cost and what could go wrong. Where the text below mentions
consent, requests or diplomacy it describes the earlier design.

A propose, verify, critique, revise loop with the engine as referee, shaped after the military
decision-making process (mission analysis, courses of action, wargaming, comparison, decision)
and the evidence in `research/04-deliberation-design.md`. Talk is spent only on what the engine
cannot measure: consent, crew safety, peat behaviour, where the model is weak.

## Stages

| # | Stage | Who | Model calls | What comes out |
| --- | --- | --- | --- | --- |
| 0 | Situation | the run itself, no model | 0 | The fact sheet: complexes, influence on the target, persistence, peat, logistics, the ceiling, the package |
| 1 | Mission | Chair | 1 | The objective (which complexes, with what, from when), the weights of the criteria the engine cannot score, and one distinct planning premise per proposer, all frozen before any plan exists. Hard constraints come from the validator, not the Chair |
| 2 | Independent drafts | 8 proposers, in parallel, blind to each other, each under its assigned premise | 8 to 16 | Eight distinguishable plans, each with its reasoning and at most two tool steps |
| 3 | Screening | validator (code), then Chair | 1 | Infeasible plans returned with the reason; near-duplicates merged; 3 to 5 distinct plans named |
| 4 | Wargame | Engine (code) | 0 | Every plan scored central, optimistic, pessimistic, and per wind member, beside the baselines |
| 5 | Cross-examination | assigned critics + Red Cell | 12 to 18 | Challenges, each citing a fact or a score, or marked as judgement; variants sent to the engine instead of argued |
| 6 | Revision | proposers of surviving plans | 3 to 5, then re-scored | Revised plans; any change of support logged with the evidence that caused it. At most two rounds of 5 and 6 |
| 7 | Comparison | every seat, blind to authorship | 11 | Ratings on the frozen criteria, inside each seat's mandate |
| 8 | Decision | Chair | 1 | The verdict: plan, margin, evidence, minority report, what would trigger re-planning |

About 45 to 65 model calls, eight to fifteen minutes with six calls in flight.

## Planning premises

The prototype (`11-prototype-council.md`) showed that blind drafts converge when every seat reads
the same sheet. So the Chair hands each proposer a premise, and the seat drafts the best plan it
can under that premise from its own mandate:

| Premise | Typical seat |
| --- | --- |
| Within what Indonesia has accepted, nothing new asked | Force Command |
| Best for KL if Indonesia agrees to every request | Air Quality |
| Domestic first: what Malaysia controls today | Domestic Fire |
| Robust: the best worst wind member | Meteorology |
| Peat physics first: only what can actually be finished | Peat Science |
| Most people out of unhealthy air soonest | Health |
| Cheapest per ug/m3 removed | Air Operations |
| Sarawak and KL together | Sarawak |

## Output discipline

Every structured answer has a `headline` (at most 25 words) and a capped `detail`. The verdict's
three tracks are at most 40 words each. The page shows headlines and opens detail on click. The
prototype's Chair wrote 1,500 words for one decision.

## Rules that make it a decision and not theatre

1. **Numbers come from tools.** Any figure in a message must be in a tool result or a score the
   engine posted. The run checks each number against the facts the agent was shown and flags
   one it cannot find, on the page.
2. **Drafts are independent.** Stage 2 agents see the fact sheet and their own brief, never each
   other. This is what gives the council a real spread of plans to choose from.
3. **Critique is sparse and assigned.** Each plan gets three critics chosen for opposed mandates
   (a plan heavy on Kalimantan peat gets Peat Science, Air Operations and Foreign Affairs), not
   everyone answering everyone. Authorship is hidden.
4. **Argue with the engine, not each other.** A critic who thinks a variant is better submits it
   as a variant; the engine scores it in the same stage.
5. **Hold your position.** Agents change support only by citing new evidence, and each change is
   an event on the page.
6. **The rule decides, not the mood.** Stage 8 picks the validated plan with the best weighted
   score: engine benefit (central, with a penalty for its pessimistic spread) times the frozen
   criteria. As built, the veto is made by ratings: a plan the owning seats rate below 3 of 10 on
   feasibility or diplomacy cannot win while another clears both (added after run 3). After the
   decision every member says whether it stands behind it, so agreement and dissent are on the
   record.
7. **Stop on stability, never on agreement.** After stage 6, stop when the top plan stays top across
   two scorings and its margin exceeds the wind-scenario spread, or when a round improves the best
   score by under 2%. As built: up to three rounds, stopping as soon as the leader holds; there is
   no cap on model calls (the budget is money, rule 9).
8. **Always beat the baselines.** Every run also scores, on the same engine: biggest fires first,
   nearest fires first, a greedy influence-per-effort plan (no agents), the best single draft
   without debate, and the ceiling. The verdict shows them. If the council does not beat the
   greedy plan and the no-debate draft, the page says so.
9. **Money is the budget.** Every plan must fit the money the run was given (RM 4, 8 or 12
   million); aircraft cost far more a day than people and do little to peat (rule R11).

## The plan format

What a proposer writes and what the validator and engine read:

```json
{
  "title": "Kalimantan border first, Johor on day one",
  "assignments": [
    { "complexId": "K-017", "asset": "cl415", "fromDay": 1, "toDay": 6, "share": 1.0 },
    { "complexId": "K-017", "asset": "ground_crew", "fromDay": 2, "toDay": 10, "crews": 3 },
    { "complexId": "M-002", "asset": "bomba_peat_team", "fromDay": 1, "toDay": 3, "crews": 2 }
  ],
  "rationale": "...",
  "assumptions": ["..."],
  "confidence": 0.6
}
```

Each assignment may also carry `"needsConsent": "sumatra" | "ground_crews" | null`; the validator
fills it in from the consent table and the engine scores such a line only from the day the plan
says the request could be granted (default: day 4 for the aircraft, day 7 for a ground task
force). A flat object, as the structured-output rule requires. `asset` is one of the package's asset
kinds; the validator checks totals per day against the package, range from staging, water within
reach for the scooper, and consent for the province.

## The verdict has three tracks

Spike 2 (`01b-spike-plans.md`) showed that the accepted package, aimed anywhere in Kalimantan,
removes at most about 0.15% of KL's achievable improvement, while domestic fires and a request to
redirect help to the Jambi peat belt remove 3 to 13%. A verdict that only assigns the accepted
package would be honest and useless. So the Chair's decision brief always has three parts:

1. **Act now**: what Malaysia does today with what it controls: the accepted package's best use
   inside its mandate, and Bomba on Malaysian fires.
2. **Ask**: the requests to Indonesia that the engine shows are worth making, each with its
   scored value if granted, the expected lag, and Foreign Affairs' judgement of its chances.
3. **Share**: the targeting picture Malaysia hands Indonesia's agency so Indonesia's own effort
   (64 aircraft and 54,394 personnel on 20 September) lands on the complexes that reach KL. Scored
   only as a labelled scenario, never as a Malaysian asset.

The engine scores tracks 1 and 2; the page shows track 3 as a scenario with its label.

## What the Chair is told to weigh

Frozen in stage 1, shown on the page from the start of the replay:

| Criterion | Scored by | Default weight |
| --- | --- | --- |
| KL benefit (ug/m3 and station-hours over API 100 avoided) | Engine | 0.45 |
| Robustness (benefit in the pessimistic case and across wind members) | Engine | 0.20 |
| Feasibility and crew risk | Force Command, Air Operations | 0.15 |
| Diplomatic acceptability | Foreign Affairs | 0.10 |
| Cost | Treasury | 0.05 |
| Side benefit to Sarawak and others | Sarawak, Health | 0.05 |

The Chair may move the weights in stage 1 with a stated reason; it may not move them after.
