# Prototype council: does it decide, or is it theatre?

Run on 10 October 2026 through the real proxy (`claude -p`), before building the council, to
test the deliberation design on real agents. Throwaway script in the session scratchpad; no rows
were written to the database.

## What ran

- A fact sheet built from the stored data: the 41 complexes that matter of 804, each with place,
  fire power, detections, days burning of the last 30, peat share (PEATMAP), night share of
  detections (FIRMS NOAA-20), km to KL, and its share of KL's coming smoke in four analogue wind
  members (the spike 2 method).
- The package and options as in `03-assistance-package.md`, and ten research rules (R1 to R10)
  from `02-decision-model.md`.
- Stage 1: the Chair (opus) froze the mission and weights.
- Stage 2: five seats (Meteorology, Peat Science, Force Command, Domestic Fire, Air Quality;
  sonnet) drafted blind.
- Stage 4: a crude linear scorer (not the real one; it overstated the package's benefit).
- Stage 5: two critics per plan, always Foreign Affairs plus one opposed seat, authorship hidden;
  the Red Cell (opus) ran a pre-mortem on all five.
- Stage 8: the Chair decided by the frozen rule.

18 calls, about 10 minutes wall time at six in flight; 36 input tokens counted by the wire
(`claude -p` does not report prompt tokens) and 168,000 output tokens; calls took 63 to 179 s.

## What worked

1. **Grounding held.** Agents cited complex ids and the fact sheet's numbers ("C538 23/3.75/12.19/
   22.06", "peat 0.64, night 0.76") and labelled judgement as judgement. The Red Cell did real
   arithmetic: "2 teams x 14 days x 1 ha/team-day = about 28 ha against about 276 ha of active
   front, a tenth of one day's front over the whole fortnight".
2. **The mandates produced real disagreement.** Foreign Affairs objected to every plan on
   grounds no engine can see (routing a shared ranking through the August 2026 science-diplomacy
   initiative rather than handing Indonesia's agency a target list; the 2019 rebuff). Peat Science
   held that the engine under-credits smouldering peat. MetMalaysia and Force Command refused to
   certify robustness and were recorded in a minority report.
3. **Variants beat arguments.** The Chair adopted two critic-authored amendments (strike the
   pre-loaded Jambi ground task force line and carry it as a request only; a Bomba surge sized to
   detections then reassessed on day 3 or 4) and declined to credit them with benefit.
4. **The verdict was honest.** "No option recommended here moves the three high-ceiling members
   by much; that is the finding, not a defect of the choice." "Nothing here is presented to the
   Minister as a meaningful fall in the API." It named seven concrete triggers for re-planning.
5. **The reasoning was the non-obvious kind the brief asks for.** The winning plan won because it
   used every domestic firefighter on the Malaysian fires the others left unassigned; it refused
   to ask for Sumatra because the request is substitutive and could cost the package already held.

## What failed, and the design changes it forces

| Observed | Change |
| --- | --- |
| **The blind drafts converged.** Four of five had the same shape (keep the package in Kalimantan, Bomba at home, share, table the ground task force). Independence is not diversity when every seat reads the same sheet and rules | The Chair assigns each proposer a distinct **planning premise** in stage 1 (MDMP: courses of action must be distinguishable): within accepted consent only; best for KL if Indonesia agrees to everything; domestic first; robust to every wind member; peat physics first; cheapest per ug/m3. A seat drafts the best plan under its premise from its mandate. The screening stage then has real alternatives, and the verdict can show what asking would be worth |
| **The Chair framed the mission as choosing among options** (domestic, request A, request B, share), not hotspots | The mission prompt fixes the question: which complexes, with what, from when. Options are tools inside a plan |
| **Far too much text.** The decision ran to about 1,500 words; output was 168,000 tokens for 18 calls | Every structured answer gets a `headline` field (at most 25 words) and a capped `detail`; the verdict's three tracks are at most 40 words each, with the full reasoning in `detail`. The page shows headlines and opens detail on click |
| **The crude scorer overstated the Kalimantan package** (8 to 9% of the ceiling, against 0.1% in spike 2) | Only the real scorer (`suppression/score.ts` over the seam's attribution) is ever shown to agents |
| **The Chair narrowed consent further than the facts** ("no Malaysian ground asset operating in Indonesia unless a fresh request is tabled" is right; "the accepted package must not be put at risk" is a judgement it then treated as a constraint) | Hard constraints come from the validator, not the Chair; the Chair may add a constraint only as a weighted criterion, so a request plan is still scored and shown |
| **Latency.** Stages run in sequence and each waits for its slowest call (up to 3 minutes) | Keep tool steps per draft to at most two; run critiques and the Red Cell in one wave; expect 20 to 25 minutes for the full protocol, shown as live progress |

## Verdict on the design

Convinced. The engine-as-referee protocol with mandates that differ in information and stakes
produces grounded, adversarial, auditable reasoning that reaches a conclusion a greedy optimiser
could not (the consent risk of a substitutive request, the routing of a shared ranking, the
re-planning triggers). The one structural flaw, convergent drafts, has a known remedy (assigned
premises), and the rest is output discipline.
