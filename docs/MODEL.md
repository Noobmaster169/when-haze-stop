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

Filled by track D from model/reports/.
