# Spike: which fires reach the Klang Valley this week

Run on 10 October 2026 against the stored data, as of 06:00 UTC. A throwaway script (kept in the
session scratchpad, not in the repo) that calls the engine's own functions and changes none of
them: `loadRunInput`, `runModel` for the calibration, `emissionsFor`, `ensembleMean`, `smokeFrom`.
Numbers are from the current engine (`MODEL_VERSION` v2), which a teammate is reworking, so the
figures will move. The method will not.

## Method

1. Load the run input as the hourly job does: 8 days of weather back, 84 hours forward, the fires,
   the readings.
2. Take the emissions that start at or after now. These are the only smoke that putting out a
   fire can prevent. The engine carries each cell forward at its mean over the last three known
   days, so "future emissions" means "the fires keep burning as they have been".
3. Group the 0.1 degree fire cells into compact complexes: the strongest unassigned cell seeds a
   complex and takes every unassigned cell within 15 km. 1,442 cells became 804 complexes. A
   first try with single linkage at 0.25 degrees chained all of Central Kalimantan into one
   780-cell blob, which no task force could be sent to; a cap on size is required.
4. For each complex, run the ensemble (4 members) on its future emissions alone, and read the
   24-hour mean smoke within 50 km of six Klang Valley stations (Batu Muda, Cheras, Putrajaya,
   Petaling Jaya, Shah Alam, Klang), averaged across the six, over the next 84 hours. Multiply by
   the run's calibration slope (0.241 ug/m3 per unit) to get ug/m3 of PM2.5.

The transport is linear in emissions: a particle's mass is proportional to the fire power that
released it, and nothing interacts. So the sum of the complexes' contributions is the
contribution of all of them, and removing a set of complexes removes exactly the sum of their
contributions (up to the ensemble's random sampling). That is what makes a plan cheap to score.

## Result

| Rank | Complex (centre) | Region | Fire power per day | km to KL | Share of KL's coming fire smoke |
| --- | --- | --- | --- | --- | --- |
| 1 | 2.85 S 110.75 E | West/Central Kalimantan border | 1,713 MW | 1,206 | 33.0% |
| 2 | 1.65 N 103.00 E | Johor | 86 MW | 220 | 17.8% |
| 3 | 3.25 S 112.15 E | Central Kalimantan | 2,521 MW | 1,362 | 9.9% |
| 4 | 1.25 N 103.60 E | Johor, south | 86 MW | 299 | 7.8% |
| 5 | 3.25 S 111.87 E | Central Kalimantan | 1,929 MW | 1,336 | 6.3% |
| 6 | 2.62 S 111.58 E | Central Kalimantan | 858 MW | 1,271 | 3.9% |

| Way of choosing 10 complexes | Share of KL's coming fire smoke they cause |
| --- | --- |
| The 10 with the most influence on KL | 85.0% |
| The 10 with the most fire power | 49.2% |
| The 10 nearest to KL | 5.2% |

By region: Borneo 67.1%, Peninsular Malaysia 32.6%, Sumatra 0.3%.

The large South Sumatra complex (310 cells, about 20 GW a day, 3.3 S 104.5 E) contributes
nothing to KL in this window. The wind explains it. Mean wind at smoke height (925 to 850 hPa),
10 to 14 October, from the stored forecast:

| Point | u (east) m/s | v (north) m/s |
| --- | --- | --- |
| South Sumatra, 3 S 104 E | -5.6 | +1.3 |
| Riau, 0 N 102 E | -3.5 | +2.8 |
| Central Kalimantan, 3 S 112 E | -6.1 | +2.1 |
| South China Sea, 2 N 106 E | -2.4 | +2.2 |
| KL, 3 N 101 E | -2.6 | +3.7 |

An east-south-easterly flow. South Sumatra's smoke goes west, out over the Indian Ocean.
Kalimantan's goes west across the Java Sea and turns north up the Strait of Malacca to the
peninsula in about two and a half days. September's mean flow at the same points is the same
shape, so this is not a one-week accident.

## What this changed in the design

1. **Influence, not size or distance, ranks the fires.** The user's instinct, that the nearest
   fire is not always the cause, is measured here: the nearest ten cause 5% and the biggest ten
   49%. The council must see each complex's influence on the target before it argues.
2. **Small fires at home can matter as much as huge ones abroad.** Two Johor fires of 86 MW each
   cause a quarter of the coming smoke. They need no diplomatic consent and Bomba can reach them
   in hours. Every plan should consider a domestic track beside the transboundary one.
3. **Influence depends on the wind, so it is recomputed each run.** No fixed "KL's haze comes from
   Riau" table. The literature's seasonal source regions (see `research/03`) are the prior; the
   week's wind is the evidence.
4. **A ceiling has to be shown.** Over these 84 hours the engine puts KL's 24-hour PM2.5 at an
   intercept of 36.0 ug/m3 plus 2.8 of modelled fire smoke, of which only 0.84 comes from smoke not
   yet emitted. Putting out every fire on Earth would lower KL by under 1 ug/m3 on average in this
   window (peak effect a few ug/m3 near its end). Any verdict must say what the most that could be
   gained is, or a modest number will look like failure and a big claim will be false.
5. **The horizon is the binding constraint.** Smoke takes 2 to 3 days to arrive from Kalimantan
   and suppression takes days to bite, while the weather forecast reaches about 4 days. Benefits
   land at the very end of the window. See `10-open-questions.md`: an extended horizon on analogue
   weather from the stored history is the likely answer, and it changes the engine's input, not
   the engine.
6. **It is cheap.** The full run took 18 s. Attributing 804 complexes took 7 s (95 coarser ones,
   1.6 s). A plan is then scored by adding up rows of a source-receptor matrix in microseconds, and
   only the final few plans need a full engine run for the map.

## Caveats

- The intercept (36 ug/m3) is the part of KL's PM2.5 the calibration does not tie to modelled
  smoke. Some of it is surely aged regional smoke older than the engine's 144-hour particle life
  or lost to its 72-hour decay, so the true benefit of suppression is probably larger than the
  engine shows. This is for the engine's owner; recorded in `10-open-questions.md`.
- Fire power is a poor measure of smouldering peat, which emits much smoke for little heat (see
  `research/01`). The engine burns fire power as mass, so it under-weights peat. The council's
  peat expert is there partly to correct for that.
- 4 ensemble members per complex; ranks below about the top 30 are within sampling noise.
