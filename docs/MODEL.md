# The learned forecast: target, features, truth, training and tests

Written 11 October 2026. This is the learned model's own document: what it predicts, what it is
given, what it is taught from, how it is trained and how it is tested. The physical forecast it
sits beside is in `docs/FORECAST.md`; the stored history it learns from is `docs/FEATURES.md`
section 3.4; the design it follows is `docs/specs/2026-10-10-predictive-model-design.md`. Its code
is `model/`. Where the build differs from the design, this document says what was built.

## 1. What it predicts

One row is one instrument on one issue time. The issue time is 00:00 UTC (08:00 Malaysian time)
each day, and every feature is built from data at or before it. An instrument is a DOE station, a
Singapore region, an OpenAQ sensor or an airport; there are about 189.

Two targets, in ug/m3 of 24 hour mean PM2.5:

- `peak_d1`: the highest 24 hour mean during the next Malaysian day.
- `peak_d2`: the same for the day after.

Day +3 comes only from recursion (section 4.4) and is labelled as such.

API, chances and alert wording are derived afterwards through `haze/api-index.ts` and
`haze/chance.ts`. The model never predicts the index, because DOE's bands make it discontinuous
(`docs/FORECAST.md` section 1).

One known skew: training rows are all issued at 00:00 UTC, but the live cycle asks the service at
its own run hour. A model that has only seen 08:00 mornings is asked about other hours. This is
measured in shadow (section 5.7), not assumed away.

## 2. What it is given

About 110 feature columns in six groups (`model/src/hazemodel/features/`, one module per group). The first
real build is 27,579 rows by 119 columns for 2025-06-07 to 2026-10-08, made in 190 seconds; the 119 includes the two keys, the kind and weight columns, the two targets
and their weights and censor flags. The
ablation in section 5.6 decides which groups survive.

**Group 1, state of the air** (`air.py`). The 24 hour mean PM2.5 at issue time; the same at 24, 48
and 72 hours before; the differences between them; the peak of the last 24 hours and the hour of
day it occurred; the mean level of the other instruments within 50 km and within 150 km. The
index is a running mean, so today is the strongest predictor of tomorrow, the trend is the second,
and an episode shows at the coast a day before it shows inland.

**Group 2, fire supply by direction** (`fires.py`). From each instrument, eight 45 degree sectors
by three distance rings (0 to 300, 300 to 800, 800 to 1500 km). For each sector and ring, the
screened fire power (`coalesce(burning_mw, frp_mw)`) summed over the last 1, 3 and 7 complete UTC
days: 72 columns, plus the region's total fire power and its change over three days. Smoke comes
from upwind; the trees learn which sectors matter for which instrument without the builder naming
a place, and detected fire power is noisy under cloud, which the model must see.

The last complete UTC day for a 00:00 UTC issue is the previous calendar day, the rule the
transport model's own `emissionsFor` uses, so the two agree on what was known. Cells come from
`fire_cells`, whose `lat10` and `lon10` are integer tenths of a degree.

**Group 3, the physical model's view** (`physics.py`). Modelled smoke within 50 km at issue time,
24 and 48 hours ahead, the modelled change and a flag saying the columns are present, from the
transport model run with fires and wind as known at the issue time. The physics knows where smoke
is; its amplitude and timing are what it gets wrong, and as a feature the trees learn how far to
trust it. This group reads `smoke_hindcasts`, which the hindcast job fills; until it has run the
columns are empty and the first phase trains without them.

**Group 4, weather as forecast for the next 48 hours** (`weather.py`), at the instrument's grid
point. Mean 925/850 hPa wind as u and v over the next 24 and 48 hours; wind steadiness (vector
mean over scalar mean speed); total rain over 24 and 48 hours; the wind component along the
bearing to the heaviest fire sector; and a flag saying whether the columns came from the analysis
or from a stored forecast. A steady wind brings a plume, hourly rain is unforecastable but a daily
sum is useful, and the flag is the leak accounting.

**Group 5, calendar** (`calendar.py`). Day of year as sine and cosine, month, and a monsoon phase
flag.

**Group 6, instrument identity** (`air.py`). Instrument kind as a category; the instrument's mean
(`hist_mean`) and standard deviation (`hist_std`) over a trailing 30 day window before the issue
time (`HISTORY_DAYS`). One model serves 189 instruments without memorising each. The window is a
trailing one, not the whole training history, so a training row and a live row see the same kind
of history; the live service loads the same 30 days.

## 3. What it is taught from

Three kinds of truth, built in `model/src/hazemodel/truth/` and scored separately always. Nothing
is interpolated: a day with no data is no row.

**Reference** (`reference.py`). DOE readings converted with `apiToPm25`, and Singapore's
`pm25_24h`. Weight 1.0. DOE rows are held out of training in the first round and used only for the
live comparison, because they are one week and the untouched truth.

**Corrected sensors** (`sensors.py`). Each OpenAQ sensor is fitted with a linear correction
against a reference monitor on the hours they share. A sensor is accepted as truth only if its
correlation is 0.8 or more over at least `ACCEPT_HOURS` shared hours; otherwise it stays a feature
and is logged as dropped, with its numbers. Weight 0.6.

Two things differ from the design. The design asked for 200 shared hours, but DOE serves one week
(168 hours) and no sensor could reach 200, so `ACCEPT_HOURS` is 120, five full days. And a
sensor's reference is the nearest reference instrument that shares at least 120 hours with it,
falling back to the nearest overall when none does, because the nearest monitor is often one with
a different gap pattern. On the one-week fixture 7 of 14 sensors are accepted.

**Airports** (`visibility.py`). On dry reports only (no `RA`, `SH`, `TS`, `DZ`, `BR`, `FG`), the 24
hour mean of extinction 3.912 / visibility in km is fitted to a reference monitor's 24 hour PM2.5.
Reports under 50 m visibility are dropped first, since they would give an infinite extinction. The
proxy is clipped at 0. An airport uses its own fit when it shares at least 100 hours with its
reference, else the pooled fit. The October overlap gave a rank correlation of 0.84. The proxy is
censored below about 35 ug/m3, because the 10 km visibility cap cannot distinguish clean days; such
rows carry weight zero on the clean side. Weight 0.4. Airports teach what a hazy day looks like,
not a clean one.

Each builder writes its fit coefficients and every accept or drop decision into the run's report.

The sensor and airport corrections are fitted on the whole loaded window, including hours after a
training row's issue time; this is accepted as a static calibration, not a leak of the target, and
the fitted decisions are frozen into each artifact so that serving applies them unchanged.

## 4. How it is trained

### 4.1 Rows and weights

Each row's weight is its kind weight times a target weight that rises with the truth: a row whose
target exceeds about 55 ug/m3 (DOE's 151 band begins at 55.4) counts three times. Plain error on all days
rewards "clean", which is right most days and useless.

### 4.2 Model and loss

LightGBM, three models per target with quantile loss at 0.1, 0.5 and 0.9. The median is the
number; the band feeds the chance. Quantiles are sorted after prediction because quantile models
can cross.

### 4.3 Hyperparameters

Searched once on the first six training months only, never on test months: leaves 15 to 63,
learning rate 0.02 to 0.1, minimum rows per leaf 50 to 200, feature fraction 0.6 to 0.9, early
stopping on the following month. The chosen values are committed as `model/params.json` so a
retrain reproduces.

### 4.4 Day +2: direct against recursive

Direct: a separate model with target `peak_d2`. Recursive: the day +1 median is written into the
level and lag columns and the day +1 model runs again. Both are trained and scored. Recursive
serves day +2 only if its error is within 5% of direct's; otherwise direct serves day +2 and
recursive serves day +3 and beyond, labelled as such.

### 4.5 Retraining and promotion

Weekly, on everything stored, triggered by the jobs process. Each training writes an artifact named
by date and data hash under `model/artifacts/` and a report under `model/reports/<version>/`.
`promote.py` moves the `live` pointer only if the new walk-forward score is not worse than the live
one's. The rule is code.

### 4.6 Compute

About 60,000 instrument-days by 110 columns. One fit takes seconds on a CPU. The walk-forward
backtest (15 test months, 2 targets, 3 quantiles) is about 90 fits, under ten minutes on this
machine. Ablation multiplies that by the groups dropped, under an hour. The one slow job is the
smoke hindcast: the transport model once per issue day over the history, on the order of an hour
or two. No GPU is needed.

## 5. How it is tested

The package has a test per module, run with `.venv/bin/pytest -q` inside `model/`, on fixtures
recorded from the stored data. The tests below are the model's own, run by track D.

### 5.1 Walk-forward by month

Train on all months up to M, test on M+1, slide from July 2025 to September 2026: 15 test months
and two burning seasons, the 2025 one entirely out of sample. Never a random split. Scores are per
month and pooled, with the day-block bootstrap for the 90% interval.

### 5.2 Baselines, on identical rows

Persistence (tomorrow's peak equals today's); the current v2 forecast; climatology (the
instrument's mean for that month); the physical model alone (its change with the fitted gain). The
target is at least 15% lower MAE than the best baseline at 24 hours on hazy days, and any gain at
48 hours.

### 5.3 Scores, by instrument kind, never pooled across kinds

MAE and bias on all days and on hazy days, a hazy day being one whose truth is 35 ug/m3 or more;
hit rate and false alarm rate for crossing 150 and 200 API; lead time to onset for each episode
start; quantile calibration, where the share of truths below the 0.1 and above the 0.9 quantile
must each fall between 7% and 14%.

### 5.4 Scenario suite

Named replays, run on every model version, each with a pass line:

1. Episode onset: the first three days of each burning season. Warns before 100?
2. Episode end: the days after rain. Falls fast enough?
3. Fire dropout under cloud: the 9 October 2026 case. Holds the level?
4. Wind reversal: forecast wind veering more than 90 degrees. Band widens?
5. Clean season, January to April: stays near climatology; a false alarm rate above 2% fails.
6. Unseen instruments: five held out entirely and scored.

### 5.5 Leak tests

Shift every feature forward a day: the score must collapse to persistence. Shuffle the target
within instrument: it must collapse to climatology. Every score is labelled analysis wind or
forecast wind; the gap is the measured cost of the leak and is re-measured as `weather_forecasts`
fills.

### 5.6 Ablation

Drop each feature group in turn and retrain. A group that moves hazy-day MAE by under 1% is
removed. This is the measured answer to which parameters matter.

### 5.7 Shadow before live

With the backtest passed, the model forecasts live every cycle and nothing shows it. Forecasts are
stored in `model_forecasts` and scored as readings arrive, beside v2. After 14 days with a 24 hour
score at least 10% better than v2 on DOE stations, `MODEL_MODE` may be set to `live`. Until then a
person sees nothing from this model. Shadow is also where the issue-hour skew of section 1 is
measured.

## 6. Results

One section per version, newest first. Every number below is copied from
`model/reports/<version>/report.md` or `scores.json`; a percentage marked "derived" is arithmetic on
two copied numbers.

### 6.1 Version 2026-10-11-c88cac5a, the first walk-forward

Built from `features-2025-06-07-2026-10-08-8f571bda.parquet`: 27,544 rows by 119 columns, issue
days 2025-06-07 to 2026-10-08, built in 116 seconds with `--hindcast-model v2-analysis`. Every row
has `has_physics = 1` (DOE 340, NEA 2,440, OpenAQ 11,054, airports 13,710), because the smoke
hindcast covers every issue day of the span. Trained with the committed `model/params.json`
unchanged (section 6.1.11 says why). The backtest with ablation ran in 23 minutes 15 seconds; `train --with-backtest`, which repeats
the backtest without the ablation and fits the final artifact on every row, in 12 minutes 51 seconds.

**The phases merged.** The design ran phase 1 without the physics group and phase 2 with it once
the hindcast existed. The hindcast finished before this run, so one parquet carries the physics,
and the ablation's `physics` row below is the phase 2 answer. There is no separate phase 2 run.

**The DOE hold-out needed no code.** DOE readings begin on 3 October 2026, inside the last test
block (2026-10). No walk-forward model trains on a DOE row; only the final artifact, trained on
everything, does.

**What "reference" means here.** The model, persistence, climatology and v2 are scored on the rows
all four can forecast. Climatology needs the instrument's month in the training data, and DOE has
none before its own test block, so the DOE rows fall out of the common set: every "reference"
number in 6.1.1 to 6.1.3 is the five Singapore regions alone. DOE is scored only on the rows the
physics forecast covers, beside the physics, in 6.1.2.

#### 6.1.1 By block

Reference instruments, MAE / hazy-day MAE in ug/m3. "n/a" is a block with no hazy reference day:
the five Singapore regions had none from July 2025 to July 2026.

| Block | Train | Test | Model d1 | Persistence d1 | v2 d1 | Model d2 | Persistence d2 | v2 d2 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | 1218 | 1576 | 2.94 / n/a | 3.01 / n/a | 3.61 / n/a | 3.26 / n/a | 3.60 / n/a | 4.55 / n/a |
| 2025-08 | 2795 | 1601 | 3.73 / n/a | 4.80 / n/a | 5.22 / n/a | 4.15 / n/a | 5.58 / n/a | 6.29 / n/a |
| 2025-09 | 4393 | 1654 | 3.05 / n/a | 4.03 / n/a | 4.44 / n/a | 3.51 / n/a | 4.94 / n/a | 6.36 / n/a |
| 2025-10 | 6043 | 1625 | 2.78 / n/a | 3.54 / n/a | 3.74 / n/a | 2.97 / n/a | 4.12 / n/a | 4.60 / n/a |
| 2025-11 | 7676 | 1572 | 2.90 / n/a | 3.53 / n/a | 3.79 / n/a | 3.70 / n/a | 4.18 / n/a | 5.10 / n/a |
| 2025-12 | 9243 | 1704 | 2.75 / n/a | 2.78 / n/a | 3.00 / n/a | 3.71 / n/a | 3.45 / n/a | 3.55 / n/a |
| 2026-01 | 10947 | 1715 | 2.46 / n/a | 2.03 / n/a | 2.95 / n/a | 2.86 / n/a | 2.27 / n/a | 3.43 / n/a |
| 2026-02 | 12663 | 1527 | 3.02 / n/a | 3.94 / n/a | 4.50 / n/a | 3.25 / n/a | 4.71 / n/a | 5.63 / n/a |
| 2026-03 | 14187 | 1787 | 2.49 / n/a | 2.97 / n/a | 3.45 / n/a | 2.94 / n/a | 3.57 / n/a | 4.43 / n/a |
| 2026-04 | 15971 | 1764 | 2.68 / n/a | 3.41 / n/a | 3.53 / n/a | 2.94 / n/a | 3.61 / n/a | 4.65 / n/a |
| 2026-05 | 17738 | 1837 | 3.34 / n/a | 4.50 / n/a | 4.63 / n/a | 4.08 / n/a | 5.18 / n/a | 6.53 / n/a |
| 2026-06 | 19573 | 1765 | 3.49 / n/a | 2.71 / n/a | 3.38 / n/a | 4.50 / n/a | 3.41 / n/a | 4.14 / n/a |
| 2026-07 | 21337 | 1667 | 3.25 / n/a | 3.70 / n/a | 3.65 / n/a | 3.82 / n/a | 4.22 / n/a | 4.80 / n/a |
| 2026-08 | 23011 | 1810 | 3.49 / 6.62 | 3.71 / 5.70 | 4.44 / 6.90 | 4.63 / 9.55 | 4.28 / 7.24 | 6.08 / 10.68 |
| 2026-09 | 24816 | 1825 | 13.89 / 15.75 | 16.59 / 19.12 | 15.97 / 19.51 | 14.17 / 15.50 | 19.59 / 21.29 | 20.10 / 23.49 |
| 2026-10 | 26637 | 844 | 19.10 / 19.27 | 19.23 / 19.15 | 19.54 / 19.69 | 23.79 / 23.79 | 25.73 / 25.73 | 28.48 / 28.48 |

On all days the model beats persistence at day +1 in 14 of 16 blocks, losing in 2026-01 and
2026-06. On hazy days it wins one of the three blocks that have any: 2026-09, 15.75 against 19.12.
It loses 2026-08 (6.62 against 5.70) and, narrowly, 2026-10 (19.27 against 19.15). The whole
hazy-day judgement rests on those three blocks.

#### 6.1.2 Pooled, by kind

Common rows: 25,048 at day +1, 24,900 at day +2. MAE / hazy-day MAE in ug/m3, with the number of
hazy rows.

| Kind, day | Hazy rows | Model | Persistence | v2 | Climatology |
| --- | --- | --- | --- | --- | --- |
| Reference (NEA) d1 | 168 | 4.01 / 15.48 | 4.59 / 17.53 | 4.93 / 18.05 | 6.98 / 41.01 |
| Reference (NEA) d2 | 173 | 4.63 / 16.70 | 5.45 / 20.61 | 6.38 / 23.09 | 7.19 / 42.63 |
| OpenAQ d1 | 1191 | 5.07 / 16.35 | 5.24 / 13.71 | 5.04 / 14.49 | 10.70 / 43.56 |
| OpenAQ d2 | 1183 | 6.33 / 18.99 | 6.62 / 17.44 | 7.06 / 19.88 | 10.81 / 44.25 |
| Airport d1 | 4370 | 2.55 / 4.85 | 2.34 / 4.53 | 2.94 / 5.94 | 8.57 / 14.44 |
| Airport d2 | 4376 | 3.05 / 5.46 | 3.05 / 5.84 | 3.92 / 7.81 | 8.65 / 14.61 |

DOE, on the 340 rows the physics forecast covers (251 hazy at d1, 265 at d2):

| Day | Model | Physics alone |
| --- | --- | --- |
| d1 | 15.02 / 18.29 | 16.62 / 20.45 |
| d2 | 21.43 / 24.60 | 22.92 / 27.49 |

The model is best on the reference kind at both days. On corrected sensors it loses to persistence
on hazy days at both days, and on airports at day +1. Its bias on hazy days is negative for every
kind (reference d1 -8.94, OpenAQ d1 -13.17, DOE d1 -15.75): it under-forecasts a hazy day.

Bootstrap of the MAE difference over issue days, 90% interval, reference (all days, not hazy only):

| Day | Model minus persistence | Model minus v2 |
| --- | --- | --- |
| d1 | -1.05 to -0.35 | -1.34 to -0.67 |
| d2 | -1.32 to -0.53 | -2.20 to -1.32 |

Both intervals sit below zero at both days: on the Singapore regions the model's gain is not
resampling noise. For DOE the same intervals cross zero (d1 against persistence -2.63 to 0.52),
which is what 340 rows over one week give.

#### 6.1.3 Crossing 150 and 200 API

Hit rate / false alarm rate. DOE is on its physics rows; the others on common rows.

| Kind, day | Model 150 | Persistence 150 | v2 150 | Model 200 | Persistence 200 |
| --- | --- | --- | --- | --- | --- |
| Reference (NEA) d1 | 0.50 / 0.43 | 0.48 / 0.49 | 0.41 / 0.33 | no event | no event |
| Reference (NEA) d2 | 0.44 / 0.34 | 0.39 / 0.56 | 0.32 / 0.42 | no event | no event |
| DOE d1 | 0.79 / 0.05 | | | 0.00 / never said | |
| DOE d2 | 0.69 / 0.10 | | | 0.00 / never said | |
| OpenAQ d1 | 0.60 / 0.21 | 0.64 / 0.31 | 0.62 / 0.15 | 0.00 / never said | 0.69 / 0.25 |
| OpenAQ d2 | 0.42 / 0.24 | 0.53 / 0.40 | 0.49 / 0.30 | 0.00 / never said | 0.54 / 0.34 |
| Airport d1 | 0.55 / 0.36 | 0.59 / 0.38 | 0.59 / 0.43 | 0.00 / never said | 0.57 / 0.43 |
| Airport d2 | 0.39 / 0.33 | 0.48 / 0.49 | 0.46 / 0.55 | 0.00 / never said | 0.43 / 0.57 |

At 150 the model raises fewer false alarms than persistence on every kind. It catches slightly
more crossings on the reference kind and fewer on sensors and airports. At 200 it fails outright:
its median never reached 200 API on any row, so every 200 event was missed. A median that
under-forecasts hazy days does not reach the 150.5 ug/m3 that 200 needs.

#### 6.1.4 Band calibration

Share of truths below the 0.1 quantile / above the 0.9 quantile. The pass line is 7% to 14% each.

| Kind | d1 | d2 |
| --- | --- | --- |
| Reference (NEA) | 0.23 / 0.24 | 0.22 / 0.26 |
| DOE | 0.10 / 0.34 | 0.06 / 0.48 |
| OpenAQ | 0.24 / 0.21 | 0.24 / 0.22 |
| Airport | 0.23 / 0.10 | 0.26 / 0.11 |

The band is too narrow. Only the airports' upper tail and DOE's lower tail at day +1 sit inside
the line; every other cell fails, most by seven to twelve points. A chance derived from this band would
be overconfident.

#### 6.1.5 Onset leads

Mean lead to onset in days, as `report.md` gives it.

| Kind | Onsets | Model | Persistence | v2 |
| --- | --- | --- | --- | --- |
| Reference | 19 | 0.37 | 0.00 | 0.00 |
| NEA | 17 | 0.41 | 0.00 | 0.00 |
| DOE | 2 | 0.00 | 0.00 | 0.00 |
| OpenAQ | 78 | 0.29 | 0.00 | 0.15 |
| Airport | 73 | 0.40 | 0.00 | 0.14 |

The model warns earlier than both baselines on every kind with more than two onsets, by under half
a day on average.

#### 6.1.6 Day +2

Recursive serves day +2: hazy-day MAE 21.18 against direct's 21.48 on the reference rows, inside
the 5% rule (and slightly better). The day +2 numbers in 6.1.2 are the direct model's.

#### 6.1.7 Scenarios

Scored on reference rows. A scenario needs 20 rows to be judged.

| Scenario | Rows | Verdict | Why |
| --- | --- | --- | --- |
| Episode onset | 15 | not judged | too few rows, 15 of the 20 needed |
| Episode end | 38 | pass | bias -7.99, under the +10 line: it does not hold the level after rain |
| Fire dropout | 14 | not judged | too few rows, 14 of the 20 needed; the 9 October 2026 case is untested |
| Wind reversal | 63 | pass | band 13.45 on reversal rows against 7.41 on the rest |
| Clean season | 600 | pass | false alarm share 0.00 against the 2% line |
| Unseen instruments | 5 held out | pass | hazy MAE 18.73 held out against 17.03 seen, inside the 1.3 tolerance |

The held-out five are CA01R, CA39C, WAOO, openaq:12488751 and openaq:16868521.

#### 6.1.8 Leak tests

| Test | Model MAE | Baseline MAE | Verdict |
| --- | --- | --- | --- |
| Shift (features a day forward, against honest persistence) | 2.24 (2582 rows) | 5.92 (2582 rows) | pass: the harness sees the future when given it |
| Shuffle (targets permuted within instrument, against climatology) | 10.73 (2655 rows) | 7.53 (2315 rows) | pass: nothing encodes the target |

The shuffle comparison is not on identical rows: climatology has no DOE row, the model has 340.
The verdict should be confirmed on identical rows in the next version.

#### 6.1.9 Ablation

Reference hazy-day MAE at day +1 with all groups: 17.09. This is scored on reference rows including
DOE, which is why it differs from the 15.48 of 6.1.2.

| Group | Columns | Hazy MAE without | Change | Keep under the 1% rule |
| --- | --- | --- | --- | --- |
| air | 13 | 22.31 | +30.5% | yes |
| fires | 75 | 17.62 | +3.1% | yes |
| physics | 5 | 18.02 | +5.4% | yes |
| weather | 11 | 17.48 | +2.2% | yes |
| calendar | 4 | 16.76 | -2.0% | no |
| identity | 1 | 17.37 | +1.6% | yes |

The physics group earns its place: without it the hazy-day error rises 5.4%, the second largest
effect after the state of the air. This is the phase 2 answer. The 1% rule drops one group,
calendar, which made the model worse. This version still carries it; removing it is the next
version. The identity group as coded is `kind_code` alone; `hist_mean` and `hist_std` are counted
with air.

#### 6.1.10 Wind source and the 24 hour target

Every number here was scored on the analysis wind; the live model forecasts on forecast wind, and
`weather_forecasts` will allow a forecast-wind score from the first day it holds. On 11 October
2026 it holds no rows.

**The 24 hour target was not met.** The target is a hazy-day MAE at least 15% below the best
baseline on reference kinds. The best baseline is persistence at 17.53 ug/m3; the target is
therefore 14.90 or less (derived). The model scored 15.48, which is 11.7% below persistence
(derived) and 14.2% below v2's 18.05 (derived). The 48 hour target, any gain, was met: 16.70
against persistence's 20.61. Both rest on 168 and 173 hazy rows from five Singapore regions over
August to October 2026.

#### 6.1.11 The hyperparameter search was void

`hazemodel search --months 6 --draws 20` chooses by reference hazy-day MAE on the first six
months. The reference instruments had no hazy day before August 2026, so all 20 draws scored
"n/a" and the code took the first draw by default. That choice would have been noise, so
`params.json` was left as committed (31 leaves, learning rate 0.05, 100 rows per leaf, feature
fraction 0.8, 600 rounds). The search needs a criterion that is defined on the early months before
it can be run.

#### 6.1.12 What this version says

The model is a better day +1 and day +2 forecast than persistence and v2 on the reference kind,
with intervals clear of zero, earlier onset warnings and fewer false alarms at 150. It does not
reach the 15% target, it under-forecasts hazy days, its band is too narrow by about ten points a
tail, and it never forecast 200. Its promotion score, reference hazy-day MAE at day +1, is 15.48.
