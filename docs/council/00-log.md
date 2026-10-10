# Log

## 10 October 2026

- Read the code that matters here: `haze/transport.ts`, `ensemble.ts`, `run.ts`, `fires.ts`,
  `smoke.ts`, `grid.ts`, `jobs/forecast.ts` (the engine and its inputs), and `agents/structured.ts`,
  `agents/chat/loop.ts`, the tool and skill registries (the agent machinery to reuse).
- Started four research threads, each writing a cited file into `research/`: suppression science,
  campaigns and Malaysia's capacity, source attribution to KL, deliberation design.
- Looked at the stored fires. 6 to 9 October: Sumatra 160 to 300 burning cells a day, mostly South
  Sumatra (OKI around 3 S 105 E), Jambi, Bangka and Lampung; Borneo 400 to 700, mostly Central
  Kalimantan (2 to 3 S, 111 to 115 E). Riau is nearly quiet this week.
- Ran a throwaway spike (`01-spike-attribution.md`): per fire complex, how much of the coming smoke
  over the Klang Valley it causes, using the engine's own functions read-only. The ranking by
  influence differs sharply from ranking by fire power or by distance. This became the backbone of
  the decision model.
- Research came back (`research/01` to `05`). Headlines: the accepted Malaysian package is one
  CL-415MP, three helicopters and 52 people, accepted on 18 September 2026 for Kalimantan only;
  water from the air does not put out peat; KL's smoke in the south-west monsoon is Riau and Jambi;
  debate helps only when agents differ in information and tools and the dispute is settled by
  evidence; PEATMAP (CC BY 4.0) gives a usable peat fraction grid, and no open map gives depth.
- Measured from this week's FIRMS file (NOAA-20): a detection averages 6 to 8 MW; 63% of Borneo
  detections are at night against 12% on the peninsula, the smoulder signal.
- Spike 2 (`01b-spike-plans.md`): on a 14-day horizon with analogue wind, realistic plans differ by
  two orders of magnitude. The accepted package in Kalimantan removes at most about 0.15% of KL's
  achievable improvement; domestic Bomba plus a request to redirect help to the Jambi peat belt is
  best in all four wind windows (3 to 13%). This produced the three-track verdict (act, ask,
  share) and made the analogue horizon a requirement.
- Wrote `02` decision model, `03` package, `07` tools and skills, `10` open questions, and the
  consolidated `spec.md`.
- Prototype council on the real proxy (`11-prototype-council.md`): 18 calls, about 10 minutes.
  Grounded, adversarial, honest; drafts converged. Added planning premises and output discipline
  to the protocol.
- Phase 1 built and pushed: `backend/src/suppression/` (complexes, package, scenarios, effect,
  attribution, score, validate, baselines), `contracts.council.ts`, the PEATMAP grid
  (`sources/peat-data.ts`, `scripts/pack-peat.mjs`), Indonesian places
  (`sources/places-id-data.ts`, `scripts/pack-places-id.mjs`), `sources/place-namer.ts`; 29 tests.
