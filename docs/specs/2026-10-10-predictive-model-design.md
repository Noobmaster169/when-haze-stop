# Predictive haze model: design

Written 10 October 2026 on branch `haze-product`. Approved in conversation the same day. This
is the design for the first learned forecast in When Haze Stop: what it predicts, what it learns
from, how it is trained and tested, where it runs, and how it reaches the app. The implementation
plan derived from it lives beside it. The model's own living document, written as the work
lands, is `docs/MODEL.md`.

## 1. Intent

The app forecasts haze so people can decide: close a school, move an event, keep workers in.
The current forecast (`docs/FORECAST.md`) beats "no change" by about a quarter up to 12 hours
ahead and ties with it beyond a day. The decisions above are made a day or two ahead. So the
first learned model predicts **each instrument's peak 24 hour PM2.5 for tomorrow and the day
after**, with a band, from which the API, the chance of crossing 150 or 200, and the alert text
are derived through the existing conversion. Nothing it outputs reaches a person until it has
beaten the current forecast out of sample and then in shadow on live data.

Two things were asked for and both are in scope:

1. The infrastructure: a model service, the tables and the seam that let a learned model
   forecast from the stored history, roll its own prediction forward (day +2 and +3 from
   day +1), be scored live, and be swapped for a better one by a measured rule.
2. The method: the parameters, the training approach and the test suite that decide whether a
   model is good, written down so each result is reproducible and every claim in the app traces
   to a number in a report.

Malaysia is the first region. The feature builder takes a bounding box, a grid and an instrument
table, and names no country, so a second region is a second config and a second training run.

Not in scope: an hourly autoregressive replacement for the station forecast, a deep sequence
model, new data sources, auth, and any change to the fire screening (evaluated separately; see
section 10).

## 2. What exists and is kept

- Four history kinds from 1 January 2025 in Postgres (`docs/FEATURES.md` 3.4): screened fires
  per 0.1 degree cell-day, wind at 925/850 hPa and rain on a 1 degree hourly grid (from June
  2025, still backfilling), airport visibility at 29 airports, and PM2.5 from 87 OpenAQ sensors
  and Singapore's 5 reference regions. DOE's 68 stations have readings from 3 October 2026 only.
- The physical transport model and its calibration in `backend/src/haze/`, with a rank
  correlation of 0.835 against readings for where smoke is. It stays as the map and becomes a
  feature of the learned model.
- The backtest tools: `haze/backtest.ts`, `haze/score.ts`, `jobs/evaluate.ts`,
  `services/simulation.ts` and the Simulation page. The learned model is scored beside the
  current forecast there, by the same rules.
- The known leak: `weather_hours` holds the analysis, not the forecast issued at the time. This
  design closes it going forward and labels every score with the wind it was scored on.

## 3. Target and unit of learning

One row is one instrument on one issue time. The issue time is 00:00 UTC (08:00 Malaysian time)
each day. Every feature is built from data at or before the issue time. An instrument is a DOE
station, a Singapore region, an OpenAQ sensor or an airport; there are about 189.

Targets, in ug/m3 of 24 hour mean PM2.5:

- `peak_d1`: the highest 24 hour mean during the next Malaysian day.
- `peak_d2`: the same for the day after.

Day +3 is produced by recursion only (section 6.4) and is labelled as such.

API, chances and alert wording are derived afterwards through `haze/api-index.ts` and
`haze/chance.ts`. The model never predicts the index: DOE's bands make it discontinuous
(`docs/FORECAST.md` section 1).

## 4. Parameters: the feature groups

About 110 columns in six groups. Ablation (section 7.6) decides which survive.

**Group 1, state of the air.** The 24 hour mean PM2.5 at issue time, in ug/m3; the same at
24, 48 and 72 hours before; the differences between them; the peak of the last 24 hours and the
hour of day it occurred; the mean level of the other instruments within 50 km and within 150 km.
Why: the index is a running mean, so today is the strongest predictor of tomorrow, the trend
is the second, and an episode shows at the coast a day before it shows inland.

**Group 2, fire supply by direction.** From each instrument, eight 45 degree sectors by three
distance rings (0 to 300, 300 to 800, 800 to 1500 km). For each sector and ring, the screened
fire power (`coalesce(burning_mw, frp_mw)`) summed over the last 1, 3 and 7 complete UTC days:
72 columns. Plus the region's total fire power and its change over three days. Why: smoke
comes from upwind, the trees learn which sectors matter for which instrument without the
builder naming a place, and detected fire power is noisy under cloud, which the model must see.

**Group 3, the physical model's view.** Modelled smoke within 50 km at issue time, 24 and 48
hours ahead, and the modelled change, from the transport model run with fires and wind as known
at the issue time. Why: the physics knows where smoke is; its amplitude and timing are what it
gets wrong. As a feature, the trees learn how far to trust it, which a hand-fitted gain could
not. Phase 1 trains without this group; the hindcast job (section 8.4) fills it for phase 2.

**Group 4, weather as forecast for the next 48 hours, at the instrument's grid point.** Mean
925/850 hPa wind as u and v over the next 24 and 48 hours; wind steadiness (vector mean over
scalar mean speed); total rain over 24 and 48 hours; the wind component along the bearing to
the heaviest fire sector; and a flag saying whether the columns came from the analysis or from a
stored forecast. Why: a steady wind brings a plume, hourly rain is unforecastable but a daily sum
is useful, and the flag is the leak accounting.

**Group 5, calendar.** Day of year as sine and cosine, month, and a monsoon phase flag.

**Group 6, instrument identity.** Instrument kind as a category; the instrument's own mean and
standard deviation over its training history. Why: one model serves 189 instruments without
memorising each.

## 5. Truth

Three kinds of truth, built in `model/src/hazemodel/truth/`, scored separately always.

- **Reference** (`reference.py`): DOE readings converted with `apiToPm25`, and Singapore's
  `pm25_24h`. Weight 1.0. DOE rows are held out of training in the first round and used only
  for the live comparison, because they are one week and the untouched truth.
- **Corrected sensors** (`sensors.py`): each OpenAQ sensor is fitted with a linear correction
  against its nearest reference monitor on the hours they share. A sensor is accepted as truth
  only if its correlation is 0.8 or more over at least 200 shared hours; otherwise it stays a
  feature and is logged as dropped, with its numbers. Weight 0.6.
- **Airports** (`visibility.py`): on dry reports only (no `RA`, `SH`, `TS`, `DZ`, `BR`, `FG`),
  the 24 hour mean of extinction 3.912 / visibility in km is fitted to the nearest reference
  monitor's 24 hour PM2.5, per airport where the overlap allows and pooled otherwise. The
  October overlap gave a rank correlation of 0.84. The proxy is censored below about 35 ug/m3,
  because the 10 km visibility cap cannot distinguish clean days; such rows carry weight zero on
  the clean side. Weight 0.4. Airports teach what a hazy day looks like, not a clean one.

Each truth builder writes its fit coefficients and every accept or drop decision into the run's
report. Nothing is interpolated: a day with no data is no row.

## 6. Training

### 6.1 Rows and weights

Each row's weight is its kind weight times a target weight that rises with the truth: a row
whose target exceeds 55 ug/m3 (the start of DOE's 151 band) counts three times. Plain error on
all days rewards "clean", which is right most days and useless.

### 6.2 Model and loss

LightGBM, three models per target with quantile loss at 0.1, 0.5 and 0.9. The median is the
number; the band feeds the chance. Quantiles are sorted after prediction because quantile
models can cross.

### 6.3 Hyperparameters

Searched once on the first six training months only, never on test months: leaves 15 to 63,
learning rate 0.02 to 0.1, minimum rows per leaf 50 to 200, feature fraction 0.6 to 0.9, early
stopping on the following month. The chosen values are committed as `model/params.json` so a
retrain reproduces.

### 6.4 Day +2: direct against recursive

Direct: a separate model with target `peak_d2`. Recursive: the day +1 median is written into the
level and lag columns and the day +1 model runs again. Both are trained and scored. Recursive
serves day +2 only if its error is within 5% of direct's; otherwise direct serves day +2 and
recursive serves day +3 and beyond, labelled as such. Recursion is what lets the forecast roll
its own prediction forward without new training.

### 6.5 Retraining and promotion

Weekly, on everything stored, triggered by the jobs process. Each training writes an artifact
named by date and data hash under `model/artifacts/` and a report under
`model/reports/<version>/`. `promote.py` moves the `live` pointer only if the new walk-forward
score is not worse than the live one's. The rule is code.

### 6.6 Compute

About 60,000 instrument-days by 110 columns. One LightGBM fit takes seconds on a CPU. The
walk-forward backtest (15 test months, 2 targets, 3 quantiles) is about 90 fits, under ten
minutes on this machine (16 cores, 11 GB). Ablation multiplies that by the number of groups
dropped, under an hour. The one slow job is the smoke hindcast (section 8.4): the transport
model once per issue day over the history, Node CPU, on the order of an hour or two. No GPU is
needed at any step of this design; a GPU would matter only for a deep sequence model, which is
out of scope.

## 7. Testing

### 7.1 Walk-forward by month

Train on all months up to M, test on M+1, slide from July 2025 to September 2026: 15 test months
and two burning seasons, the 2025 one entirely out of sample. Never a random split. Scores are
per month and pooled, with the day-block bootstrap for the 90% interval.

### 7.2 Baselines, on identical rows

Persistence (tomorrow's peak equals today's); the current v2 forecast; climatology (the
instrument's mean for that month); the physical model alone (its change with the fitted gain).
Target: at least 15% lower MAE than the best baseline at 24 hours on hazy days, and any gain at
48 hours.

### 7.3 Scores, by instrument kind, never pooled across kinds

MAE and bias on all days and on hazy days, a hazy day being one whose truth is 35 ug/m3 or more; hit rate and false alarm rate for crossing 150 and
200 API; lead time to onset for each episode start; quantile calibration, where the share of
truths below the 0.1 and above the 0.9 quantile must each fall between 7% and 14%.

### 7.4 Scenario suite

Named replays, run on every model version, each with a pass line:

1. Episode onset: the first three days of each burning season. Warns before 100?
2. Episode end: the days after rain. Falls fast enough?
3. Fire dropout under cloud: the 9 October 2026 case. Holds the level?
4. Wind reversal: forecast wind veering more than 90 degrees. Band widens?
5. Clean season, January to April: stays near climatology; false alarm rate above 2% fails.
6. Unseen instruments: five held out entirely and scored.

### 7.5 Leak tests

Shift every feature forward a day: the score must collapse to persistence. Shuffle the target
within instrument: it must collapse to climatology. Every score is labelled analysis wind or
forecast wind; the gap is the measured cost of the leak and is re-measured as
`weather_forecasts` fills.

### 7.6 Ablation

Drop each feature group in turn and retrain. A group that moves hazy-day MAE by under 1% is
removed. This is the measured answer to which parameters matter.

### 7.7 Shadow before live

With the backtest passed, the model forecasts live every cycle and nothing shows it. Forecasts
are stored and scored as readings arrive, on the Simulation page beside v2. After 14 days with a
24 hour score at least 10% better than v2 on DOE stations, `MODEL_MODE` may be set to `live`.

## 8. Components

### 8.1 `model/`, a Python package

Same shape as `proxy/`: `pyproject.toml`, `src/hazemodel/`, `tests/`, `Dockerfile`, `README.md`,
a `model` service in `compose.yaml`. Dependencies: pandas, pyarrow, lightgbm, psycopg, fastapi,
uvicorn, pydantic. Dev: pytest, ruff. Python 3.10.

| Module | Responsibility |
| --- | --- |
| `store.py` | Every SQL read the package makes. Read-only. The backend remains the only writer. |
| `region.py` | Bounding box, grid and issue hour from env, the same values as `haze/grid.ts`. |
| `instruments.py` | One table of instruments from stations, NEA regions, OpenAQ sensors, airports. |
| `truth/reference.py`, `truth/sensors.py`, `truth/visibility.py` | Section 5. |
| `features/air.py`, `fires.py`, `weather.py`, `calendar.py`, `physics.py`, `build.py` | Section 4. `build.py` writes parquet under `model/data/` (gitignored). A training run names the parquet it read. |
| `train.py` | Section 6. |
| `backtest.py`, `scenarios.py`, `leaks.py`, `ablation.py` | Section 7. |
| `report.py` | Writes `model/reports/<version>/scores.json` and `report.md`. Reports are committed; artifacts and data are not. |
| `promote.py` | Section 6.5. |
| `serve.py` | `GET /health`: live version and training date. `POST /predict`: takes `asOf`, computes features from the database, returns per instrument p10, p50, p90 for day +1, +2, +3 in ug/m3 and the model version. |

Features are computed in one place only. Node never builds a feature.

CLI: `hazemodel features`, `hazemodel backtest`, `hazemodel train`, `hazemodel scenarios`,
`hazemodel ablation`, `hazemodel promote`, `hazemodel serve`.

Tests: every module on a small recorded fixture extracted from the database (real values, as the
repo's rules require), no test reaches Postgres or the network.

### 8.2 Tables, migration `008_model.sql`

All append-only.

| Table | One row is |
| --- | --- |
| `weather_forecasts(fetched_at, valid_at, u_ms real[], v_ms real[], rain_mm real[])` | A forecast hour of one fetch, 375 values per array. Past hours are not stored here; `weather_hours` keeps the analysis. Primary key (fetched_at, valid_at). |
| `smoke_hindcasts(as_of, instrument_id, smoke_now, smoke_24h, smoke_48h, model)` | The transport model's smoke near an instrument, run with inputs as known at `as_of`. Primary key (as_of, instrument_id, model). |
| `model_forecasts(as_of, instrument_id, day, p10, p50, p90, model_version, made_at)` | One instrument-day forecast from the live service. Unique (as_of, instrument_id, day, model_version). |

`instrument_id` is the station id, NEA station id, `openaq:<sensor_id>` or the airport ICAO.

### 8.3 Backend seam and cycle

- `sources/model.ts`: `ModelClient { health(): Promise<ModelHealth>; predict(asOf: Date): Promise<ModelForecast[]> }`, a real HTTP client behind `MODEL_URL` in `config.ts`, and `__fakes__/fake.model.ts` answering from a recorded response. Exported from `sources/index.ts`.
- `repositories/model-forecasts.repo.ts`, `repositories/weather-forecasts.repo.ts`, `repositories/smoke-hindcasts.repo.ts`: the SQL.
- `jobs/ingest.ts` `ingestWeather` also writes the fetched forecast hours to `weather_forecasts`.
- `jobs/cycle.ts` gains `attempt("model", ...)` after the forecast step: call `predict(asOf)`, store the rows. A failure logs and the cycle continues, like every step.
- `config.ts`: `MODEL_URL` (default `http://127.0.0.1:4002`), `MODEL_MODE` (`off`, `shadow`, `live`; default `off`, `shadow` in compose).
- `haze/outlook.ts` `dayOutlooks` takes an optional per-day model forecast (p10, p50, p90 in ug/m3). When present, the median is the day's peak and the quantiles give the band and the chance. It stays pure. `services/outlook.ts` decides, from `MODEL_MODE` and the newest `model_forecasts`, whether to pass it. Alerts and the assistant read the outlook as they do now and do not change.
- `services/simulation.ts` scores `model_forecasts` against readings at 24 and 48 hours as daily peaks, by instrument kind, beside v2 and persistence. `contracts.haze.ts` gains a `model` block in the simulation response; `frontend/lib/api/haze-schemas.ts` mirrors it; the Simulation page shows both forecasts and the shadow rule's state.

### 8.4 The hindcast job

`jobs/hindcast.ts`, `pnpm haze:hindcast [from] [to]`. For each issue day in the stored history it
loads inputs through `loadRunInput` with the same leak controls as the backtest, runs the
transport ensemble, and writes `smoke_hindcasts` for every instrument: smoke within 50 km at the
issue time and at +24 and +48 hours. It skips days already stored for the current
`MODEL_VERSION`, so a restart costs little. It uses the analysis wind, which the `model` column
and the feature flag record.

### 8.5 Compose

A `model` service built from `model/`, port 4002 on the host, with the Postgres environment and
`MODEL_ARTIFACTS` mounted so a promoted artifact survives a rebuild. `jobs` gets `MODEL_URL`
and `MODEL_MODE`.

## 9. Data flow

Training: `hazemodel features` reads Postgres, writes parquet. `hazemodel backtest` and
`hazemodel train` read the parquet, write artifacts and reports. `hazemodel promote` moves the
`live` pointer by the rule.

Live, each hourly cycle: ingest (now also storing forecast weather), physical forecast, then
`predict(asOf)` to the model service, which reads Postgres, builds features, runs the live
artifact and answers; the jobs process stores `model_forecasts`. The Simulation page scores them
as readings arrive. In `live` mode the outlook reads the newest forecast and alerts follow.

Error handling: the service answering with a failure is one `UpstreamError`; a missing live
artifact makes `/predict` answer 503 and the cycle logs and continues; a row whose instrument is
unknown is dropped and counted in the log, never silently.

## 10. Documentation

- `docs/MODEL.md`: the model's own document in the style of `docs/FORECAST.md`: target,
  every feature and why, the truth construction with its fitted numbers, the training method,
  the backtest design, the scenario suite, the leak tests, and a results section with one table
  per model version filled from `model/reports/`. Every claim in the app about the model's
  skill traces to a row there.
- `model/reports/<version>/report.md`, generated and committed per run.
- `docs/FEATURES.md`: a short section pointing to `docs/MODEL.md`. `docs/HANDOVER.md`: the new
  commands, the shadow rule, the current state of the reports.
- The fire-spot evaluation running alongside this design lands as numbers in `docs/FEATURES.md`
  3.1.1. Any new screen it recommends is a separate bounded change, proposed with its measured
  cost before any code.

## 11. Work split

Four tracks, each an agent in its own worktree with a brief naming its files and tests.

| Track | Owns | Depends on |
| --- | --- | --- |
| A, model package | `model/` scaffold, store, region, instruments, truth, features, parquet export, tests | nothing |
| B, backend seam | migration 008, weather_forecasts write, ModelClient and fake, repositories, cycle step, config, outlook input, simulation scoring, contracts and frontend schema | nothing |
| C, hindcast | `jobs/hindcast.ts`, `smoke_hindcasts` by agreement with B, a run over the stored history | B's migration |
| D, training | backtest harness, baselines, scenarios, leak tests, ablation, the first model, reports, `docs/MODEL.md` | A's parquet |

Phase 1 of D trains without group 3. Phase 2 starts when C has filled the hindcasts.

## 12. Acceptance

The work is done when:

1. `hazemodel backtest` runs end to end on the stored history and writes a report with every
   score in section 7 for every baseline, labelled by wind source.
2. The scenario suite and both leak tests run and their pass or fail is in the report.
3. The jobs cycle stores `weather_forecasts` and, in shadow mode, `model_forecasts` from the
   service through the seam, with the fake covering the tests.
4. The Simulation page shows the model's live score beside v2.
5. `docs/MODEL.md` holds the method and the first results table.
6. Nothing a person sees comes from the model until the shadow rule in 7.7 is met and
   `MODEL_MODE` is set to `live` by hand.
