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
