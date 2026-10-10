# Spike 2: do the plans differ, and does the strategy matter?

Run on 10 October 2026, as of 06:00 UTC, with the same read-only use of the engine as spike 1
(`01-spike-attribution.md`) plus two things the real feature will need: an extended horizon and
the effect model of `02-decision-model.md`. Throwaway code, kept in the session scratchpad.

## Set-up

- **Horizon: 14 days.** The stored forecast reaches 85 hours ahead. After it, the wind is a
  replay of a 10-day window of stored analysis (an analogue). Four windows were tried, starting
  30 September, 20 September, 10 September and 25 August, as a crude analogue ensemble.
- **Fires keep burning** as the engine already assumes (each cell at its mean of the last three
  known days).
- **Contributions per complex per emission day** at the six Klang Valley stations, 2 ensemble
  members, 51 candidate complexes (the 40 most influential, every Malaysian one, the biggest and
  the nearest in Kalimantan). Pass 1 took 16 s, pass 2 8 s.
- **Plans** start on day 1 = 12 October. Effect model central case: 1 ha of active front per
  detection (detections = fire power / 7 MW), ground teams 1 ha a team-day, peat relights 30% after
  crews leave, aircraft only knock down the flaming 30% of a peat fire while overhead. Optimistic
  and pessimistic as in `02-decision-model.md`.

## The ceiling and where it comes from

| Analogue window | Ceiling: KL's mean fire smoke from future emissions | Sumatra | Borneo | Peninsula | Top complex |
| --- | --- | --- | --- | --- | --- |
| from 30 Sep | 12.3 ug/m3 | 86.7% | 9.5% | 3.7% | 1.82 S 103.92 E (Jambi peat belt), 23.0% |
| from 20 Sep | 3.4 ug/m3 | 41.5% | 44.2% | 14.2% | 2.85 S 110.75 E (West/Central Kalimantan), 10.0% |
| from 10 Sep | 15.1 ug/m3 | 75.7% | 21.4% | 2.8% | 1.82 S 103.92 E, 12.2% |
| from 25 Aug | 20.6 ug/m3 | 94.7% | 4.6% | 0.7% | 1.82 S 103.92 E, 22.1% |

Over 84 hours the ceiling was 0.84 ug/m3 (spike 1); over 14 days it is 3 to 21. The horizon, not
the fires, was hiding the benefit.

The cluster of complexes at 1.2 to 1.8 S, 103.9 to 104.5 E (Muaro Jambi and Tanjung Jabung Timur,
the Jambi peat belt) leads in three of four windows, and the South Sumatra complexes around
3.3 to 3.6 S, 105.2 to 105.8 E (Ogan Komering Ilir) lead in the oldest. This matches the
literature for KL: Riau and Jambi dominate the Klang Valley in the south-west monsoon, Jambi at
Petaling Jaya, Cheras, Batu Muda and Putrajaya (`research/03`, Murulitharan et al.).

## The plans, share of the ceiling removed (central, with optimistic and pessimistic)

| Plan | from 30 Sep | from 20 Sep | from 10 Sep | from 25 Aug |
| --- | --- | --- | --- | --- |
| Whole package on the biggest Kalimantan fire | 0.03% (0.21 / 0.00) | 0.04% | 0.08% | 0.00% |
| Whole package on the nearest Kalimantan fire | 0.00% | 0.00% | 0.00% | 0.00% |
| Whole package on the most influential Kalimantan complex | 0.09% (0.70 / 0.01) | 0.15% (1.25 / 0.02) | 0.10% | 0.00% |
| Influence-led split in Kalimantan | 0.07% | 0.12% | 0.06% | 0.00% |
| Domestic Bomba only (100 firefighters, 4 Malaysian fires) | 3.87% (3.87 / 2.22) | 10.55% (10.55 / 6.44) | 2.53% | 0.62% |
| Kalimantan split + domestic Bomba | 3.94% | 10.67% | 2.59% | 0.62% |
| Ask Indonesia: package + 150-strong ground task force to the top Sumatra complex | 1.66% (8.16 / 0.18) | 2.27% | 1.25% (9.66 / 0.15) | 2.72% (8.40 / 0.28) |
| Ask Indonesia for Sumatra + domestic Bomba | **5.53%** (12.03 / 2.39) | **12.83%** (12.88 / 6.73) | **3.78%** (12.19 / 1.29) | **3.34%** (9.02 / 0.41) |

## What this settles

1. **The strategy matters, by two orders of magnitude.** The same 52 people and four aircraft
   remove 0.00% or 0.1% of KL's achievable improvement aimed by size or distance in Kalimantan, and
   3 to 13% in the best combined plan. A council that only picked "the biggest fire" would be
   wrong in a way the engine can show.
2. **As accepted, the package cannot move KL's air.** Indonesia accepted it for Kalimantan, which
   is Sarawak's source, and its aircraft cannot put out peat. This is the finding the verdict must
   be willing to state, and the reason the council needs a Foreign Affairs seat with real stakes:
   the highest-value act is a request to redirect, not an assignment.
3. **Act at home first.** Two small Johor fires are worth more to KL than the whole Kalimantan
   deployment in every window. Bomba needs no consent and arrives in hours.
4. **The wind decides the ranking, so robustness is the objective.** The top complex changes with
   the analogue window. The council must score every plan across a wind ensemble and prefer plans
   that hold up in all of it (the combined plan is best or tied best in all four windows). This is
   MetMalaysia's and the Red Cell's job, with numbers.
5. **The effect model's assumptions are as large as the wind.** Optimistic to pessimistic moves the
   ground-crew plans by a factor of 30. The verdict must show the range, and the council must say
   which assumption its choice depends on.
6. **Malaysia's biggest lever may be information.** Indonesia has 64 aircraft and 54,394 personnel;
   the best plan above removes at most 13% because Malaysia's force is tiny. Sharing this ranking
   with Indonesia's agency so its own effort is aimed at the complexes that reach KL is a
   recommendation the council can make. It cannot be scored as a Malaysian asset; it can be scored
   as a scenario ("if Indonesia's crews on the Jambi belt doubled"), clearly labelled.

## What it implies for the build

- The analogue-weather horizon is required, not optional. Agree it with the engine's owner
  (`10-open-questions.md`).
- The analogue ensemble (several past windows) doubles as MetMalaysia's wind ensemble.
- The per-complex, per-day contribution matrix for 50 candidates costs about 25 s per wind member
  at 2 ensemble members. Four analogue members: under two minutes, once per council run.
- The effect model, the plan validator and the plan scorer are pure functions over that matrix and
  need no engine at all: they can be built and tested now.
