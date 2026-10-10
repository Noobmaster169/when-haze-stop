# Designing the haze crisis council so it decides better, not just louder

Research brief for the multi-agent "crisis council" that picks which Indonesian hotspots a limited
Malaysian assistance force suppresses first, with candidate plans scored by the smoke simulation.
Compiled 2026-10-10. Where a source was read only through its abstract or a secondary summary, that
is noted.

## 0. The one-paragraph answer

The research on LLM debate agrees on one uncomfortable result. When agents talk to each other
without outside feedback, most of the gain comes from sampling several answers and voting, not
from the conversation itself. Talking adds conformity: agents drop correct answers to agree with
peers. Debate earns its cost under four conditions. The agents are actually different (different
models, information or tools). Their first answers are drafted independently. Disagreement is
settled by outside evidence rather than by persuasion. The run stops on a stability rule, not on
"everyone agrees". Human decision science reached the same conclusions decades earlier: Delphi's
anonymity and iteration, the nominal group technique's silent generation, the hidden-profile
literature, dialectical inquiry and the military planning process (MDMP), where several courses of
action are wargamed before a decision matrix. The council should therefore be built as an
LLM-Modulo loop. Agents propose and critique plans. The smoke simulator, together with
deterministic feasibility checks, is the referee for anything it can measure. Deliberation is kept
for what the simulator cannot measure (diplomatic acceptability, crew safety, peat behaviour, where
the model is weak), and every position change has to point to evidence.

---

## 1. What the LLM multi-agent debate literature actually shows

### 1.1 The founding results

- **Du, Li, Torralba, Tenenbaum, Mordatch, "Improving Factuality and Reasoning in Language Models
  through Multiagent Debate", ICML 2024** (arXiv 2305.14325, https://arxiv.org/abs/2305.14325).
  Several copies of one model answer on their own, then read each other's answers and revise over
  several rounds. Gains were reported on arithmetic, GSM8K, chess and biographies. Accuracy rose
  steadily with the number of agents, and gains levelled off at about four rounds ("additional
  debate rounds above four led to a similar final performance"). Two design details carry over.
  First, *long prompts*, which make agents hold their own answer longer, converged more slowly
  but reached a more accurate consensus than short "agreeable" prompts. Second, summarising the
  other agents' answers instead of pasting them in full helped, and was needed for larger groups.
  The authors also observed that agents were generally "agreeable".
- **Liang et al., "Encouraging Divergent Thinking in Large Language Models through Multi-Agent
  Debate" (MAD), EMNLP 2024** (arXiv 2305.19118, https://arxiv.org/abs/2305.19118). Names
  **Degeneration-of-Thought**: once a model is confident in an answer, self-reflection stops
  producing new ideas even when the answer is wrong. Their fix is an affirmative and a negative
  debater arguing "tit for tat", with a judge who manages the debate and can stop it early. The
  analysis found that an *adaptive break* (the judge ending the debate once satisfied) and a
  *moderate* level of opposition were both needed. Too much forced opposition hurt. They also
  report that an LLM judge may be unfair when the debaters are different LLMs.
- **Chan et al., "ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate", ICLR
  2024** (https://arxiv.org/abs/2308.07201). Giving every agent *the same* role prompt removed the
  benefit over a single agent. *Diverse* role prompts were needed. The evidence comes from a
  narrow setup (2 agents, 2 turns).
- **Chen, Saha, Bansal, "ReConcile: Round-Table Conference Improves Reasoning via Consensus among
  Diverse LLMs", ACL 2024** (https://arxiv.org/abs/2309.13007). Agents run on *different model
  families*. Each round passes along answers, explanations and confidence. The final answer is a
  confidence-weighted vote, which beat plain majority and max-confidence. Their ablation found
  that diversity across models drove most of the gain.
- **Zhuge, Schmidhuber et al., "Mindstorms in Natural Language-Based Societies of Mind",
  NeurIPS 2023 R0-FoMo workshop; Computational Visual Media 2025** (https://arxiv.org/abs/2305.17066).
  Societies of up to 129 modules. Larger and longer "mindstorms" sometimes helped, and
  "democracies" (voting) beat "monarchies" (one leader decides) only sometimes. Structure has to
  be chosen per task.
- **Hegazy, "Diversity of Thought Elicits Stronger Reasoning Capabilities in Multi-Agent Debate
  Frameworks", 2024** (https://arxiv.org/abs/2410.12853). Three different mid-size models (Gemini
  Pro, Mixtral, PaLM 2-M) debating for 4 rounds scored 91% on GSM8K, above GPT-4. Several copies of
  one model did worse. Heterogeneity was the active ingredient.

### 1.2 The sceptical results (read these before building)

- **Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet", ICLR 2024**
  (https://arxiv.org/abs/2310.01798). Reran Du et al. on GSM8K. At an *equal number of responses*,
  debate clearly underperformed plain self-consistency (sample and majority-vote). The authors
  argue debate works as a consistency mechanism, not as real correction. Without outside feedback,
  self-correction can even make answers worse.
- **Smit et al., "Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs",
  ICML 2024** (https://proceedings.mlr.press/v235/smit24a.html). Benchmarked many debate protocols.
  None reliably beat self-consistency or ensembling. Debate is very sensitive to hyperparameters,
  and the *agreement level* between agents was the setting that mattered most. Tuning
  Multi-Persona's agreement intensity gained about 15% on MedQA.
- **Wang et al., "Rethinking the Bounds of LLM Reasoning: Are Multi-Agent Discussions the Key?",
  ACL 2024** (https://aclanthology.org/2024.acl-long.331). A single agent with a strong prompt and
  demonstrations matched the best discussion method. Discussion helped only when the prompt had no
  demonstrations.
- **Choi, Zhu, Li, "Debate or Vote: Which Yields Better Decisions in Multi-Agent Large Language
  Models?", NeurIPS 2025** (https://arxiv.org/abs/2508.17536). Across seven benchmarks, majority
  voting alone explains most of the gain credited to debate. Their theory treats debate among
  *homogeneous, fully connected* agents as a martingale: expected correctness does not move. Debate
  helps only when interventions *bias belief updates toward correction*. In this project the
  simulator is that bias.
- **Wynn, Satija, Hadfield, "Talk Isn't Always Cheap: Understanding Failure Modes in Multi-Agent
  Debate", ICML 2025 MAS workshop** (https://arxiv.org/abs/2509.05396). Debate can *lower* accuracy
  over rounds, even when stronger models outnumber weaker ones. Models flip from correct to
  incorrect after reading peer reasoning, "favoring agreement over challenging flawed reasoning".
  A prompt promising a payoff for correctness did not reduce these flips.
- **Yao et al., "Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate", 2025**
  (https://arxiv.org/abs/2509.23055). Sycophancy from debaters and from judges causes disagreement
  to collapse before the group reaches a correct answer, with accuracy below single-agent
  baselines.
- **Choi, Zhu, Li, "When Identity Skews Debate: Anonymization for Bias-Reduced Multi-Agent
  Reasoning", ACL 2026 main** (https://arxiv.org/abs/2510.07517). Treats sycophancy (giving peers
  too much weight) and self-bias (giving one's own past answer too much weight) as one *identity
  bias*. Sycophancy is far more common than self-bias. **Stripping identity markers so an agent
  cannot tell its own past output from a peer's** reduces it. Read via abstract and summary.
- **Wu, Li, Li, "Can LLM Agents Really Debate? A Controlled Study of Multi-Agent Debate in Logical
  Reasoning", 2025** (https://arxiv.org/abs/2511.07784). On puzzles with checkable answers,
  *individual reasoning strength and group diversity* dominate. Structural settings (speaking
  order, visible confidence) add little. Majority pressure suppresses independent correction. The
  teams that succeed are the ones that overturn a wrong consensus.
- **Bertalanič & Fortuna, CAIS 2026, "Decomposing Sycophancy, Fragility, Consensus Collapse and
  Cost in Homogeneous Multi-Agent Debate"**, with the companion paper "The Cost of Consensus:
  Isolated Self-Correction Prevails Over Unguided Homogeneous Multi-Agent Debate"
  (https://arxiv.org/abs/2605.00914). Homogeneous teams without guidance did worse than agents
  correcting themselves in isolation. Title and abstract only.
- **Cemri et al., "Why Do Multi-Agent LLM Systems Fail?" (MAST), NeurIPS 2025 Datasets & Benchmarks**
  (https://arxiv.org/abs/2503.13657). 14 failure modes found in 1,600+ traces across 7
  frameworks, in three groups: system design, inter-agent misalignment, and task verification.
  Most failures were *design* failures, not model limits. Missing or weak verification is a major
  group.

### 1.3 Protocol knobs with evidence

| Knob | Evidence | Implication for the council |
|---|---|---|
| Agent count | More agents help, mostly through voting (Du; Li et al., "More Agents Is All You Need", TMLR 2024, https://arxiv.org/abs/2402.05120; Kaesberg et al. below) | More *independent proposers* is cheap and useful. More *talkers* is not. |
| Rounds | Saturates at ~4 (Du). More rounds before a vote *reduce* accuracy (Kaesberg et al., "Voting or Consensus? Decision-Making in Multi-Agent Debate", Findings of ACL 2025, https://arxiv.org/abs/2502.19130). Random-peer routing study: most of the value comes in early rounds (arXiv 2609.27150) | 2 critique and revision rounds, hard cap 3 |
| Decision rule | Voting does better on reasoning, consensus on knowledge tasks. Drafting by all agents first and "Collective Improvement" increase diversity (Kaesberg). Confidence-weighted voting beats plain majority (ReConcile) | Rank by simulation, then a weighted vote on criteria the simulator cannot measure. Never require unanimity. |
| Topology | Sparse topologies match or beat fully connected ones at lower cost. Stronger models deserve more connections (Li et al., "Improving Multi-Agent Debate with Sparse Communication Topology", Findings of EMNLP 2024, https://aclanthology.org/2024.findings-emnlp.427/) | Critique assigned through a matrix (each critic reviews 2-3 plans), not everyone answering everyone |
| Heterogeneity | Different models, information and tools are the active ingredient (ReConcile, Hegazy, Wu et al., Choi et al.) | Give each role private data and its own tool, not just a persona label |
| Personas | Persona labels alone do not improve factual accuracy, and their effect is "largely random" (Zheng et al., "When 'A Helpful Assistant' Is Not Really Helpful", Findings of EMNLP 2024, https://arxiv.org/abs/2311.10054). ChatEval shows *diverse* roles beat identical roles | A role must change the agent's *objective, information or tools*, not its tone |
| Stubbornness | Long, "hold your view" prompts give slower but better consensus (Du). Agreement intensity is the main tuning setting (Smit) | Agents may change position only by citing new evidence |
| Stopping | Judge-managed adaptive break (Liang). Stability tests beat fixed rounds (Hu et al., "Multi-Agent Debate for LLM Judges with Adaptive Stability Detection", arXiv 2510.12697). Stopping at plain consensus fires very early and can lock in errors (arXiv 2604.07667, "From Debate to Decision: Conformal Social Choice") | Stop when the simulator's ranking is stable, never because the agents agree |
| Judges | LLM judges show position, verbosity and self-preference bias (Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023, https://arxiv.org/abs/2306.05685) | Randomise order, anonymise authors, keep the judge on a rubric with numbers fixed by tools |

### 1.4 Grounded debate: verifiers and simulators in the loop

- **Kambhampati et al., "Position: LLMs Can't Plan, But Can Help Planning in LLM-Modulo
  Frameworks", ICML 2024** (https://proceedings.mlr.press/v235/kambhampati24a.html). LLMs cannot
  check their own plans reliably. Pair them with outside, model-based *critics* (hard checks such
  as feasibility, plus soft checks such as style and preference) in a generate, test and critique
  loop. This is the closest published blueprint for this council: agents generate, the
  simulator and validators test.
- **FunSearch (Romera-Paredes et al., Nature 2024) and AlphaEvolve (Google DeepMind, 2025).** An
  LLM proposes candidates, an automatic evaluator scores them, and the best feed the next
  generation. Search quality is capped by evaluator quality. Read via secondary explainers, for
  example https://www.deeplearning.ai/the-batch/googles-alphaevolve-uses-llms-and-evolutionary-code-to-solve-complex-math-and-speed-up-gemini-training.
  Takeaway: show proposers the *scores and diffs of earlier candidates* (an archive of elite plans)
  so they edit good plans rather than start over.
- **Tool-MAD (arXiv 2601.04742, 2026)**: each debater gets a *different* outside tool, retrieval
  adapts during the debate, and the judge uses faithfulness scores. **DynaDebate (arXiv
  2601.05746)**: debates collapse to majority vote because agents give near-identical answers;
  it forces different solution paths and triggers verification. **DebateCV (arXiv 2507.19090)**:
  a moderated debate over evidence for claim verification.
- **Khan et al., "Debating with More Persuasive LLMs Leads to More Truthful Answers", ICML 2024
  best paper** (https://arxiv.org/abs/2402.06782). Adversarial debate helps a *weaker judge* find
  the truth (76% for LLM judges and 88% for humans, against 48% and 60% baselines) *when the
  debaters can quote verifiable evidence*. Debate here works as a way to bring evidence to a judge,
  not as a way to reach consensus. Implication: critics should have to quote simulation outputs or
  tool records, and the chair should see quotes it can check.
- **Anthropic, "How we built our multi-agent research system", 2025**
  (https://www.anthropic.com/engineering/multi-agent-research-system). An orchestrator plans,
  spawns parallel sub-agents with clear objectives, output formats, tools and boundaries, and
  keeps its plan in memory. Multi-agent runs cost about 15x the tokens of a chat. Token usage
  alone explained 80% of the performance variance. It pays off on parallel, breadth-first work.
  Tightly coupled work suits it less.

**Synthesis.** For this product the debate literature points toward a *propose, verify, critique,
revise* loop with a simulator as the referee. It points away from a free-form roundtable. The LLM
agents add value in three places: (a) a varied supply of candidate plans, (b) bringing up
constraints and facts the simulator does not model, and (c) explaining the result. They should
not settle disputes the simulator can settle.

---

## 2. Human decision science for expert panels

### 2.1 Information pooling and conformity

- **Hidden profiles (Stasser & Titus 1985, J. Personality and Social Psychology).** Groups
  discuss information everyone already holds and neglect facts held by one member, so they miss
  the best option when it depends on that unshared information. The bias grows when members are
  motivated to close quickly. Overview: https://en.wikipedia.org/wiki/Hidden_profile.
  *Council design*: give each role private facts (for example, scooping-site limits only the
  maritime agency knows, peat depth only the peat scientist knows) and make the chair *ask each
  role for its unshared facts* before options are discussed.
- **Groupthink (Janis, *Victims of Groupthink*, 1972/1982).** The symptoms are illusion of
  unanimity, self-censorship, pressure on dissenters, and "mindguards" who filter information.
  Janis's remedies: the leader stays impartial and speaks last, outside experts are brought in,
  a devil's advocate is assigned in every meeting, subgroups work in parallel, and a "second
  chance" meeting is held before committing.
- **Devil's advocacy vs dialectical inquiry (Schweiger, Sandberg & Ragan, "Group Approaches for
  Improving Strategic Decision Making", Academy of Management Journal 29, 1986; Schweiger, Sandberg
  & Rechner, AMJ 32, 1989).** Both methods produced better decisions than consensus seeking, but
  members accepted the final decision less readily. Dialectical inquiry builds a full counter-plan
  from opposite assumptions. Devil's advocacy attacks the plan on the table.
- **Authentic vs role-played dissent (Nemeth, Brown & Rogers, "Devil's advocate versus authentic
  dissent", European Journal of Social Psychology 31, 2001, doi:10.1002/ejsp.58).** An assigned
  devil's advocate tends to make the group *bolster* its first view. Authentic dissent, from
  someone who truly holds the opposing position, produces more and better solutions. Read via
  abstract and summaries. *Council design*: dissent should come from agents with a **real
  competing objective** (for example, a Sarawak-exposure or crew-safety mandate), not from an
  agent told to "argue the opposite".
- **LLM devil's advocates in human groups (Chiang, Lu, Li, Yin, "Enhancing AI-Assisted Group
  Decision Making through LLM-Powered Devil's Advocate", IUI 2024,
  https://doi.org/10.1145/3640543.3645199).** An interactive LLM devil's advocate that argued
  *against the AI recommendation* led groups to rely on the AI more appropriately.

### 2.2 Structured group methods

- **Delphi (RAND, Dalkey & Helmer 1963; review: Rowe & Wright, "The Delphi technique as a
  forecasting tool: issues and analysis", International Journal of Forecasting 15(4), 1999,
  doi:10.1016/S0169-2070(99)00018-7).** Four features: anonymity, iteration, controlled feedback
  (a summary of the group's views and reasons), and statistical aggregation of the final
  estimates. Delphi beat statistical (non-interacting) groups in 12 of 16 studies and interacting
  groups in 5 of 8. It showed no consistent edge over other *structured* methods. Maps directly
  to: independent drafts, anonymised summaries, revise, aggregate.
- **Nominal group technique (Delbecq, Van de Ven & Gustafson, *Group Techniques for Program
  Planning*, 1975).** Silent independent idea generation, round-robin sharing without debate,
  discussion for clarification only, then private ranking. It separates *generating* from
  *evaluating*, which removes production blocking and anchoring.
- **Pre-mortem (Klein, "Performing a Project Premortem", HBR 85(9), 2007; Mitchell, Russo &
  Pennington, "Back to the future: temporal perspective in the explanation of events", J.
  Behavioral Decision Making 1989).** Imagine the plan has already failed and explain why.
  Prospective hindsight produced more reasons, and more specific ones. The often quoted "30%"
  figure is about *how many reasons* people generate, not accuracy.
- **Analysis of Competing Hypotheses and contrarian techniques (Heuer, *Psychology of
  Intelligence Analysis*, CIA 1999; US Government, "A Tradecraft Primer: Structured Analytic
  Techniques", 2009, https://www.cia.gov/resources/csi/static/955180a45afe3f5013772c313b16face/Tradecraft-Primer-apr09.pdf).**
  ACH lays out evidence against hypotheses and looks for *disconfirming* evidence, preferring the
  hypothesis with the least evidence against it. The primer's contrarian set: Devil's Advocacy,
  Team A/Team B, High-Impact/Low-Probability, "What If?", Red Team Analysis. *Council design*:
  the critique stage can use an ACH-style matrix with plans as columns and evidence rows (wind
  scenario, peat depth, water access), marking for each pair whether the evidence is consistent or
  inconsistent with the plan.
- **UK MOD *Red Teaming Handbook* 3rd ed., DCDC, June 2021**
  (https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1027158/20210625-Red_Teaming_Handbook.pdf).
  Stresses a red-team *mindset*, with techniques split into quick (time-pressed) and deliberate
  sets. Part 1 covers the biases that distort decisions.
- **Six Thinking Hats (de Bono 1985).** Everyone wears the same "hat" (facts, risks, benefits,
  creativity, feelings, process) at the same time. Its useful lesson for LLMs is *parallel
  thinking by phase*: everyone does risk analysis in the same step instead of one designated
  pessimist.

### 2.3 How real crisis committees and military staffs structure deliberation

- **ICS Planning P (FEMA ICS-300; NFPA 1561 annex;
  https://training.fema.gov/emiweb/is/icsresource/assets/Incident%20Action%20Planning%20Process.pdf).**
  The "leg" runs once: notification, initial assessment, ICS-201 briefing, first command meeting.
  The repeating circle runs every operational period: set or update objectives, command and
  general staff meeting, tactics meeting (Operations Section Chief proposes resource assignments
  on ICS-215), planning meeting (the plan is presented and the commander approves), Incident
  Action Plan prepared and approved, operations briefing, execute and assess. Doctrine: plan with
  the best information available at the meeting, and *do not delay the planning meeting waiting
  for more data*. Objectives come before tactics. Tactics are worked up by operations staff
  before the full meeting, which then challenges and approves them.
- **US Army MDMP (FM 5-0, *Planning and Orders Production*; ATP 5-0.1).** Seven steps: receipt
  of mission, mission analysis, COA development, COA analysis (wargame), COA comparison, COA
  approval, orders production. COAs must pass five screening criteria: *feasible* (within time,
  space and resources), *acceptable* (cost and risk worth the gain), *suitable* (meets the
  commander's intent), *distinguishable* (truly different from the other COAs) and *complete*
  (https://www.army.mil/article/209253/). The wargame runs in action, reaction, counteraction
  turns against the most likely and most dangerous enemy COAs, with results recorded in a
  synchronization matrix and decision support template. Comparison uses a *decision matrix of
  evaluation criteria and weights agreed in mission analysis*, before any COA exists. The
  commander then decides from a decision brief. Army writing notes COA analysis is the least
  understood step (army.mil, 2025). For this council the "enemy" is nature: the most likely and
  most dangerous wind and fire scenarios.
- **UK COBR (Institute for Government explainer,
  https://www.instituteforgovernment.org.uk/explainer/cobr-cobra).** Chaired by the PM or a lead
  minister, with membership set by the emergency. Supported by the Civil Contingencies
  Secretariat and its cells, including a situation cell that keeps a shared picture (the
  Commonly Recognised Information Picture, CRIP, in UK resilience doctrine). The pattern: one
  agreed fact picture briefed first, then options from the lead department, then decisions and
  actions recorded. Detailed meeting format not confirmed from a primary source.

**Shared structure across ICS, MDMP and COBR:** (1) one shared situation picture, (2) objectives,
constraints and *evaluation criteria fixed before options*, (3) several *distinguishable* options
built by the people who own the resources, (4) each option tested against likely and dangerous
futures, (5) a weighted comparison, (6) a decision by one accountable chair, with dissent and
risks recorded, (7) execute, assess and re-plan each operational period.

---

## 3. Architecture for a long-running, replayable council harness

### 3.1 Control pattern: orchestrator plus blackboard

- **Orchestrator-worker** (Anthropic 2025, above): a deterministic phase machine (not an LLM)
  owns the agenda, budget and stopping. LLM agents are workers called for each phase with a
  bounded task and a structured output. The project already runs turns as structured-output
  steps (`agents/chat/loop.ts`), so each agent turn can be one step with a flat JSON schema.
- **Blackboard** (Hayes-Roth 1985; for LLMs: Han & Zhang, "Exploring Advanced LLM Multi-Agent
  Systems Based on Blackboard Architecture", arXiv 2507.01701; Salemi et al., "LLM-Based
  Multi-Agent Blackboard System for Information Discovery in Data Science", arXiv 2510.01285).
  A shared board holds facts, COAs, simulation results and critiques. Agents read it and post to
  it, and a control component picks who acts next. Salemi et al. found that posting *requests*
  for agents to answer works better than a controller that must know every agent's capability.
  For the council: the blackboard holds the **situation fact sheet** (tool outputs only), the
  **COA registry** (each with an id, versions and simulation scores), the **critique matrix** and
  the **decision record**. Agents never see raw transcripts of each other. They see the board,
  filtered for anonymity.

### 3.2 Event-sourced trace

Store the run as an append-only event log (Fowler, "Event Sourcing", 2005,
https://martinfowler.com/eaaDev/EventSourcing.html). Board state at any moment is a fold over the
events, which gives exact replay, a scrubber for the visualisation and a backtest. Fields to give
every event: `run_id`, monotonically increasing `seq`, `ts`, `phase`, `actor` (agent id,
`orchestrator`, `simulator` or `validator`), `type`, `causation_id` (the event that triggered
it), `refs` (COA ids, hotspot ids, evidence ids) and a typed `payload`. OpenTelemetry's GenAI
conventions (`invoke_agent`, `execute_tool` spans,
https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans) are a useful naming
reference but still in Development status. The log should be the source of truth, with telemetry
derived from it.

Proposed event types:

- `run_started` (scenario, budget, criteria weights, model ids, prompt versions)
- `agent_spawned` (role, model, tools granted, private brief hash)
- `phase_started` / `phase_ended`
- `fact_posted` (from a tool: hotspots, FRP, winds, baseline forecast). Every number the agents
  may cite has a `fact_id`.
- `coa_proposed` / `coa_revised` (a ranked hotspot list plus asset allocation, assumptions and
  confidence. Linked to parent COA for revisions.)
- `validation_result` (feasibility pass or fail with reasons: range, sortie capacity, scooping
  water within radius, consent zone)
- `sim_requested` / `sim_result` (COA id, scenario ensemble, KL PM2.5 or API delta, spread)
- `critique` (critic, target COA, claim, evidence refs, severity, kind: risk, error,
  counterproposal)
- `question` / `answer` (directed, for hidden-profile elicitation)
- `position_changed` (agent, from COA, to COA, *required* reason and evidence refs). This is the
  event that separates deliberation from drift.
- `rationale` (a short public summary of reasoning. Do not emit raw chain-of-thought. It is
  long, noisy and not what the model "really" did.)
- `vote` / `rating` (per criterion, anonymous to peers, visible in the trace)
- `verdict` (chosen COA, decision rule applied, margin, minority report)
- `dissent_recorded`, `budget_tick` (tokens, simulator calls, wall clock), `run_ended` (reason:
  converged, budget, error)

Each LLM call is also a row in `llm_calls`, per the project rules, linked by `causation_id`.

### 3.3 Budgets and convergence

- Hard caps: number of phases, critique rounds (2, maximum 3), tokens per agent per phase,
  simulator calls per run, wall clock. Log a `budget_tick` after each step so the replay can show
  spend.
- Convergence on the *decision*, not on the conversation. Stop when (a) the top COA by simulator
  score stays first across two consecutive evaluation rounds and its margin over second place is
  larger than the spread across wind scenarios, or (b) the latest revision round improved the best
  score by less than a threshold (plateau, as in MACI arXiv 2510.04488 and stability detection in
  Hu et al.), or (c) the budget runs out, in which case the best validated COA so far wins and the
  verdict is flagged "budget-limited".
- Never stop on "all agents agree". Consensus-based early stopping fires very early and gives no
  guarantee (arXiv 2604.07667).

---

## 4. Malaysia: who sits at the table, and where they pull

### 4.1 Real 2026 context the scenario should respect

- On 18-19 Sep 2026 Deputy Prime Minister Ahmad Zahid Hamidi, chair of the **National Disaster
  Management Committee**, offered Indonesia a **Bombardier CL-415MP (APMM/MMEA), three helicopters
  and 52 personnel from NADMA, APMM and TUDM (RMAF)**. President Prabowo accepted at Istana
  Hambalang. Zahid said the work would extend to Kalimantan, Sumatra and other regions, and he
  stressed the help was not interference
  (The Star, 18 Sep 2026, https://www.thestar.com.my/news/nation/2026/09/18/malaysia-offers-firefighting-help;
  Gulf News / Bernama, 19 Sep 2026, https://gulfnews.com/world/asia/indonesia-accepts-malaysias-help-to-tackle-wildfires-1.500680478).
  **This is the "limited assistance force".** Its real capacity should be the hard constraint.
- Precedent: in Oct 2015, at Indonesia's request, the MMEA's CL-415 and a Dauphin helicopter
  flew from Palembang, with a TUDM C-130 for logistics and 25 MMEA officers. They averaged 26
  water-bombing runs and about 165,000 litres a day
  (NST, Oct 2015, https://www.nst.com.my/news/2015/10/105236/malaysia-begins-firefighting-operation-south-sumatera).
  This gives a real sortie-rate anchor for the feasibility validator.
- 29 Sep 2026: ASMC counted 327 hotspots in Kalimantan and 191 in Sumatra. 23 areas in Peninsular
  Malaysia were unhealthy, the worst in Selangor, Johor, Negeri Sembilan, Pahang, KL and Putrajaya.
  The National Haze Action Plan (PTJK) assigns agency roles by severity
  (The Star, 30 Sep 2026, https://www.thestar.com.my/news/nation/2026/09/30/smoke-from-kalimantan-sumatra-hotspots-causing-haze-in-m039sia-says-doe).
- ASEAN Alert Level 2 was raised on 3 Aug 2026 and Level 3 on 27 Aug 2026. The NRES minister
  (Arthur Joseph Kurup) reported the National Haze and Dry Weather Committee met on 15 June. El
  Nino was expected to peak around October. Malaysia proposed a science-diplomacy initiative and
  a haze fund at the 27th Sub-Regional Ministerial Steering Committee
  (The Star, 16 Aug 2026, https://www.thestar.com.my/news/nation/2026/08/16/malaysia-prepared-for-super-el-nino-haze-says-nres-minister).
- Health: the Health Ministry (Dzulkefly Ahmad) reported sentinel asthma cases rising from 61 to
  219 between epi-weeks 32 and 33 (Aug 2026). Sarawak peaked at API 475, its worst since 2019.
  The government said it may declare a haze emergency at API 400 or above
  (Malay Mail, 23 Aug 2026; Asia News Network, 2026). Under the PTJK, NADMA activates disaster
  management committees when API is above 150 for more than 24 hours. Schools stop outdoor
  activity above API 100 and close above 200 (NST, Jul 2025, https://www.nst.com.my/news/nation/2025/07/1247212/environment-dept-activates-haze-open-burning-national-plan).
- The disaster directive framework: MKN Directive No. 20 (1997) has been superseded in part by
  **NADMA Directive No. 1 (effective 1 Aug 2024)**, with national, state and district levels
  (https://aipalync.org/document/national-disaster-management-agency-nadma-directive-no-1-policy-and-mechanism-on-national-disaster-management-1).
- Diplomatic memory: in 2019 Indonesia's environment minister rejected Malaysia's complaints and
  pointed to fires in Malaysia and on Malaysian-owned plantations in Indonesia
  (FMT, 13 Sep 2019, https://www.freemalaysiatoday.com/category/nation/2019/09/13/indonesia-hits-back-over-haze-from-forest-fires).
  In 2023 Jakarta said it did "not work based on Malaysia's request". Sovereignty and blame are
  live sensitivities.

### 4.2 Seats, mandates, private information and natural conflicts

Seat agents by *office*, not by named individuals. The council's statements are simulated, and
attaching them to real ministers would put invented words in real mouths, which breaks the
project's real-data rule.

| Seat | Mandate / objective | Private information or tool | Natural conflicts |
|---|---|---|---|
| **Chair**: National Disaster Management Committee (DPM's office), with NADMA as secretariat | Runs the agenda, fixes criteria and weights, decides. Speaks last. Does not propose. | Budget, political guidance | Pressure to show visible action quickly |
| **NRES / DOE** | Lower API in the Klang Valley. Enforcement. Owns the PTJK. | DOE station API, API forecast | Wants the largest KL benefit, may underweight Sarawak |
| **MetMalaysia** | Wind, trajectory and monsoon-transition skill | Wind fields, scenario ensemble, forecast uncertainty | Warns that plans tuned to one wind forecast are fragile |
| **NADMA (force commander)** | Run the 52-person force safely and well | Crew hours, basing, logistics | Prefers concentrated, sustainable operations over scattered "show" sorties |
| **APMM / MMEA (CL-415MP operator)** | Aircraft use and safety | Scooping-water sources within range, turnaround times, 2015 sortie data | Fires far from scoopable water are infeasible whatever their smoke value |
| **TUDM / MINDEF** | Helicopters, C-130 lift, overflight clearances | Airframe availability, clearance lead times | Clearance and basing limit which provinces are reachable |
| **Wisma Putra (KLN)** | Indonesian consent, ASEAN framing, no appearance of interference | Which areas Jakarta has cleared, sensitivities (plantation ownership) | May veto politically awkward targets even with high smoke value |
| **KKM (Health)** | Population exposure and vulnerable groups | Exposure-weighted population, hospital surveillance | Pushes exposure-weighted benefit (Klang Valley population) and may raise Sarawak |
| **MOF (Treasury)** | Cost-effectiveness | Fuel and deployment cost per sortie-day | Questions marginal sorties |
| **Peat scientist (UKM/UPM)** | Physical realism | Peat depth and type maps. Smouldering persistence. | Aerial water-bombing barely touches deep smouldering peat, so favour surface or new ignitions, and treat the model's emission factors sceptically |
| **Sarawak representative** (optional authentic dissenter) | Sarawak exposure (it took the worst API in 2026) | Sarawak station data | A real competing objective to KL. This is the authentic dissent Nemeth recommends. |

Seven to nine voices is about right. The Du and Kaesberg evidence says more independent
*proposers* help. Critique cost grows with the square of the number of agents if everyone talks to
everyone, so the critique stage should be sparse. A small, homogeneous council shows the
conformity failures described in section 1.2.

---

## 5. Visualising the deliberation so the replay is legible

### 5.1 Existing work

- **AgentLens (Lu, Pan et al., IEEE TVCG 2024, https://arxiv.org/abs/2402.08995).** Builds a
  hierarchical summary of raw agent events over time, traces causes between behaviours, and offers
  an outline view (one curve per agent over time), an agent detail view and a focus-driven monitor
  view.
- **AGDebugger (Epperson, Bansal, Dibia, Fourney, Gerrits, Zhu, Amershi, "Interactive Debugging
  and Steering of Multi-Agent AI Systems", CHI 2025, https://arxiv.org/abs/2503.02068).**
  Developers struggled to *find the error in long conversations*. The tool provides a message
  timeline overview, plus editing and resetting a past message to re-run from there. Resetting
  was the most valued feature.
- **AgentCoord (arXiv 2404.11943, 2024).** Visual exploration of coordination strategies.
  **AutoGen Studio** (Microsoft, https://microsoft.github.io/autogen/stable/user-guide/autogenstudio-user-guide/):
  live message streaming and a control-transition graph of who handed off to whom.
- General visualisation principles: Shneiderman's "overview first, zoom and filter, then details
  on demand" (IEEE Symp. Visual Languages 1996). Hierarchical edge bundling (Holten, IEEE TVCG
  2006) for dense message edges. Stable "mental map" layouts in dynamic graphs (Misue et al.,
  1995; Archambault & Purchase on dynamic graph drawing).

### 5.2 Principles for this replay

1. **Make it a bipartite graph of agents and COAs, not agents talking to agents.** The debate is
   *about plans*. Agent nodes sit on a fixed ring, grouped by cluster (operations, science,
   diplomacy and health, chair at the centre). COA nodes sit in the middle and grow in size with
   their simulator score. Critiques are edges from an agent to a COA. Position changes are an
   agent's tether jumping from one COA to another. This turns "a hairball of messages" into "which
   plans gained or lost support, and why".
2. **Fixed layout, no force-directed jitter.** Positions are set by role, so the viewer's mental
   map survives scrubbing.
3. **Time is a scrubber with phase bands** (Brief, Criteria, Draft, Screen, Simulate, Critique,
   Revise, Compare, Verdict). Each band can be a small-multiple snapshot. Within a band, aggregate
   edges (thickness = number of critiques) and animate only the *current* event.
4. **Highlight the events that matter**: `sim_result` (a COA's score bar updates),
   `position_changed` (with its cited evidence), `validation_result` failures (the COA greys out
   with its reason) and the verdict. Leave routine messages in a collapsible side log.
5. **Couple the graph to the map.** When an event references hotspot ids, those hotspots light up
   on the map. When a COA is selected, its targets and the simulated plume difference are drawn.
   The map shows the content of the plan. The graph shows the process that chose it.
6. **Details on demand**: clicking a node or edge opens the agent's public rationale, its cited
   facts (with `fact_id` links to the source records) and the prompt version. Do not show raw
   chain-of-thought.
7. **Budget and convergence strip**: tokens, simulator calls and the score of the best COA per
   round, so a viewer can see *why* the council stopped.
8. Keep encodings few: colour = role cluster, size = simulator score, edge style = critique
   versus support. Never use colour for both role and stance.

---

## 6. Recommended council protocol (synthesis)

**Stage 0. Situation brief (ICS-201 / CRIP).** The orchestrator, not an LLM, posts the fact
sheet: current hotspots with FRP, wind ensemble, the baseline KL forecast from the simulator,
force capacity and consent zones. Each agent also gets a *private brief* with its own data and
its own tool.

**Stage 1. Objectives, constraints, criteria (MDMP mission analysis).** The chair fixes the
objective (largest expected reduction in KL PM2.5 or API over the next N hours), the hard
constraints (validator-enforced) and the weights of the non-simulated criteria (diplomatic
acceptability, crew risk, robustness across wind scenarios, Sarawak spillover, cost). Weights are
frozen *before any plan is seen*.

**Stage 2. Independent drafting (NGT silent generation, Delphi round 1, Kaesberg's All-Agents
Drafting).** Every seat drafts one COA *without seeing the others*: a ranked target list,
allocation, assumptions, confidence. Optionally add 2-4 extra "free" proposers on other models or
temperatures to widen the pool.

**Stage 3. Screening.** A deterministic validator checks feasibility (range from base, scoopable
water within radius, sortie-hours, consent zones). Near-duplicate COAs are clustered, leaving 3-5
*distinguishable* COAs (the MDMP criteria).

**Stage 4. Simulate.** Each surviving COA is run across the wind ensemble (likely and dangerous
scenarios). Scores and spread are posted as facts.

**Stage 5. Anonymised critique (sparse, ACH plus pre-mortem).** Each critic reviews 2-3 COAs
assigned by a matrix that pairs authentic opposing mandates with each COA. Authorship is hidden,
and an agent cannot tell its own past COA from others. Each critique must cite a `fact_id` or a
`sim_result`, or be labelled "judgement". A pre-mortem pass ("72 hours on, KL is still above API
200: why?") is run by the peat scientist and MetMalaysia seats. **Critics may propose a variant
and have it simulated instead of arguing about it.**

**Stage 6. Revise and re-simulate (at most 2 rounds).** Drafts are revised, or COAs merged, then
re-validated and re-simulated. Any change of support requires a `position_changed` event with new
evidence. Prompts tell agents to hold their position unless the evidence changes.

**Stage 7. Comparison matrix.** Simulated KL benefit (with uncertainty) is combined with anonymous
per-criterion ratings from each seat, aggregated with the frozen weights. ReConcile-style
confidence weighting is allowed only for criteria inside a seat's mandate.

**Stage 8. Verdict and decision brief.** The chair applies the rule: among validated COAs, pick
the best weighted score. Wisma Putra or NADMA may veto, but only by citing a hard constraint. The
chair publishes the decision, the margin, the simulator evidence, the minority report and what
would change the decision (the trigger for the next operational period, as in the ICS cycle).

**Stop** at the earliest of: top-COA stability across 2 evaluations with margin above the
scenario spread, improvement below a threshold, or budget exhausted. Never stop on agreement.

**Baseline check (keep the council honest).** For every run, also score (a) a no-debate baseline
of independent drafts, simulate, take the best, and (b) a greedy simulator-only plan. If the
council does not beat (a) over many runs, the deliberation is theatre and should be cut back to
proposal generation plus explanation.
