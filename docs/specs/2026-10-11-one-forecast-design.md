# One forecast: design

Written 11 October 2026 on branch `haze-product`. This is the design that makes the learned
model the forecast a person sees, with the smoke simulation as its explanation, and the proof
beside the claim. It is phase 1 of the plan agreed in conversation: no retraining, no new data,
no change to what the model predicts. The predictive model itself is
`docs/specs/2026-10-10-predictive-model-design.md`; its results are `docs/MODEL.md`.

## 1. Intent

The app exists to show that haze can be predicted. Today the main panel shows three forecasts
that were never reconciled:

| What a person sees | Where it comes from | Reaches how far |
| --- | --- | --- |
| The haze field past Now on the map | The smoke simulation (fires, wind, rain), corrected to readings at the run hour; near a station the station's 3 hour slope, far from one the simulation's change | 84 hours |
| The dashed line in the station panel | The 3 hour slope of the 24 hour mean, decayed; no fires, no wind | 84 hours |
| The day rows in the station panel | The learned model, when `MODEL_MODE` is `live` | 3 Malaysian days |

The line and the rows contradict each other (Jerantut tonight: line at 60 for Monday, row at
92), nothing says which forecast any number is, and the learned model, the one thing with a 15
month backtest, is invisible. The dashed line was measured at level with "no change" beyond a day
(`docs/FORECAST.md` 5.2); the learned model was measured 12% closer than "no change" on hazy days
at a day ahead (`docs/MODEL.md` 6.1.2). The app shows the weaker one.

After this design:

- Every number about a day ahead or more, everywhere (panel, map, alerts, assistant), is the
  learned model's. There is one forecast.
- The smoke simulation stops being shown as a forecast of air quality. It supplies the hourly
  timing and the spatial pattern inside the learned model's day peaks, and it is named as the
  reason ("smoke from the north-east arrives by afternoon").
- Every forecast number carries its source and the model's record. A person can get from any
  forecast to its proof in one click.

Not in scope: hourly issue of the learned model (phase 2), any change to features, training or
the shadow rule, Bahasa, auth.

## 2. What exists and is kept

- `haze/run.ts` builds a run hourly: calibration of smoke to readings, station forecasts
  (`station-forecast.ts`), frames (`field.ts`). `smoke.near(cells, hour)` gives the trailing 24
  hour smoke mass within 50 km of any point for every hour of the run, past and future; it is
  used only for calibration today.
- `services/outlook.ts` composes a station's outlook: readings, the hourly `forecast` array from
  `station_forecasts`, and `days` from `haze/outlook.ts`, which takes a learned day where one
  exists for tomorrow onwards and the hourly peak otherwise.
- `jobs/model-forecast.ts` asks the model service once per 00:00 UTC issue; rows for 189
  instruments (DOE, NEA, OpenAQ sensors, airports) land in `model_forecasts`.
- `services/model-skill.ts` scores the learned model live against "no change" and the hourly
  forecast on DOE stations and states the shadow rule.
- The alerts, the area cards and the assistant's `get_forecast` read `StationOutlook.days`
  (`chance`, `forecastPeak`, `observedPeak`); `get_forecast` also samples the hourly line.
- `model/reports/<version>/scores.json` is committed and holds the backtest.

All of it stays. The change is in how the pieces are joined and labelled.

## 3. The rule that joins them

For a station and a Malaysian day D later than today, where the learned model has a row
(p10, p50, p90 in ug/m3 of 24 hour mean PM2.5):

1. **The day's peak is the learned median.** The hourly line's maximum over D equals `p50`,
   converted to API at the edge as everything is.
2. **The hours inside the day follow the simulation's timing.** The calibrated smoke series at
   the station, `s(h) = intercept + slope * smoke.near(h)`, gives the shape. Its within-day
   variation is scaled so the dip goes no lower than `p10`:

   ```
   r      = clamp((p50 - p10) / (s_peak - s_min), 0, 1)     0 when the series is flat
   pm25(h) = p50 - (s_peak - s(h)) * r
   ```

   A flat series gives a flat line at `p50`. A series with a clear afternoon peak gives a line
   that peaks then.
3. **Today stays the hourly forecast.** A day half over is best described by what it has read
   and the next 12 hours, which the hourly forecast is proven at. Between today's last hour and
   the first learned day the line ramps linearly over up to 3 hours, never touching the day's
   peak hour: if the peak falls inside those hours the ramp ends there.
4. **A later day with no learned row keeps the hourly value**, ramped the same way, and is
   labelled `hourly`. This happens for the fourth day after midnight Malaysian time, until the
   08:00 issue. Phase 2 removes it.
5. **The map's future frames are corrected to the same values.** At every instrument with a
   learned row (all 189, not only stations), the difference between the frame's value at the
   instrument and the instrument's `pm25(h)` from rule 2 is spread over the grid with the same
   inverse distance weight and 200 km fade the run already uses for station errors. At a
   station the frame and the panel line then agree to the frame's 2 point resolution. Airports
   and sensors have no hourly forecast of their own, so for them rule 2 is applied alone, with
   no today part.
6. **Alerts and the assistant change nothing in code**, because they read `days`, and `days`
   already carries the learned peak. They become consistent with the line by rules 1 to 4.

In `MODEL_MODE` `shadow` or `off`, none of this applies and the app behaves exactly as today,
except that every forecast is labelled `hourly`.

Why not the other way round, adding the simulation's change to the hourly line? It was tried
and it made 24 to 72 hour forecasts worse than "no change" (`docs/FORECAST.md` 5.3). The
simulation knows where smoke is and when, not how much. The learned model learned how much,
with the simulation as its second most useful input (`docs/MODEL.md` 6.1.9). So the amplitude is
the model's and the timing is the simulation's.

## 4. What a person sees

### 4.1 The map

- A row of chips beside the Now button: **Now, Tonight, Tomorrow, Day after**. They seek the
  timeline to the latest reading, today 20:00, tomorrow 14:00 and the day after 14:00 Malaysian
  time. The timeline keeps its slider and play.
- One caption under the map whenever the shown moment is past Now:
  "Forecast for Mon 12 Oct 14:00 by the learned model (trial), issued Sun 08:00. Checked on 0
  days so far. In the 15 month backtest it was 12% closer than no change on hazy days."
  The word "trial" stays until the shadow rule passes. When the moment falls on a day with no
  learned row, the caption says "by the hourly forecast, level with no change beyond a day".
- Station dots keep sampling the field, which is now corrected to the learned forecast.

### 4.2 The station panel

- The chart's dashed line is the reshaped series of section 3, so it rises to the day rows'
  peaks. The shaded ranges stay `p10` to `p90`.
- Each day row gains a second line, the reason, built from the simulation at that station:
  "Simulated smoke peaks around 15:00 on a north-east wind" or "Little simulated smoke reaches
  here; the forecast rests on the current level and trend". No fire place names are invented;
  the sentence uses only the wind direction at the station at the peak hour and whether the
  calibrated smoke adds more than 5 ug/m3 that day.
- The footer replaces "Ranges cover 8 in 10 past forecasts" with the source line: "Forecast by
  the learned model 2026-10-11-c88cac5a, issued Sun 08:00. Hourly shape from the smoke
  simulation. Checked on 0 days so far." and a link "How good is this?" to `/model`.

### 4.3 The assistant

`get_forecast` returns the source with each station: the kind, the version, the issue time, the
days checked and the live gain. The decision skill and the prompt tell the model to say, when it
leans on a day ahead or more, "by the learned model, which in its backtest was 12% closer than
no change on hazy days, and has been checked on N live days". This is a new prompt file
`prompts/chat/v5.md` and version 4 of `haze-decision`.

### 4.4 The Model page

A new destination `/model`, "Model" in the nav, built from the database and the committed
report on each visit:

1. Three tiles: the backtest (model, no change, hourly forecast, hazy-day miss at a day
   ahead), the live record (days checked, running miss against both baselines, and the hour
   the next check lands), and the status (mode, trial or not, the rule's two conditions).
2. Watching it now: for the six stations with the highest learned peak tomorrow, plus any the
   browser follows, the last 48 hours of readings against the learned bands for today,
   tomorrow and the day after, the hourly line and the no-change line.
3. The ledger: every scored learned forecast once its day has passed, newest first: station,
   day, forecast and band, what happened, miss, and the two baselines' misses. Running miss by
   lead above it. This is the table the shadow rule reads.
4. The backtest: hazy-day miss by month for the model, no change and the hourly forecast over
   the 16 blocks; the pooled table by instrument kind; hit and false alarm rates at 150 and 200;
   band calibration; the scenario and leak verdicts. All read from `scores.json` through the
   model service.

## 5. Components

### 5.1 Contracts, `backend/src/contracts.haze.ts` and `contracts.model.ts`

Fixed here so the tracks can build in parallel. Mirrored by hand in
`frontend/lib/api/haze-schemas.ts` and a new `model-schemas.ts`.

```ts
export const ForecastSource = z.object({
  kind: z.enum(["learned", "hourly"]),
  modelVersion: z.string().nullable(),
  issuedAt: z.string().nullable(),
  /** True while the shadow rule has not passed. */
  trial: z.boolean(),
  record: z.object({
    checkedDays: z.number().int(),
    /** Live gain over the hourly forecast on DOE stations, as model-skill computes it; null before any day is checked. */
    gain: z.number().nullable(),
    /** The committed backtest's hazy-day MAE at a day ahead on reference instruments. */
    backtest: z.object({ model: z.number(), persistence: z.number(), v2: z.number() }).nullable(),
  }),
});

DayOutlook += { source: z.enum(["learned", "hourly"]), why: z.string().nullable() }
StationOutlook += { source: ForecastSource }
HazeMap += { source: ForecastSource | null, learnedFrom: z.string().nullable() }  // first corrected validAt
```

`contracts.model.ts` holds the Model page's response: `verdict` (the three tiles), `watch`
(stations with readings and bands), `ledger` (rows and running misses), `backtest` (the trimmed
report). Its exact shape is in the plan for track D; the three other tracks do not depend on it.

### 5.2 Migration `009_learned_frames.sql`

```sql
alter table station_forecasts add column physics real[];
alter table forecast_runs add column learned_version text;
```

`physics` is the calibrated smoke series at the station, PM2.5 per hour, same indices as `api`.
`learned_version` is the model version whose forecast corrected the run's future frames, null
when none did. Both nullable, so old runs read as before.

### 5.3 `haze/reshape.ts`, pure

`reshapeToLearned(asOf, hourly, physics, learned)` implements rules 1 to 4 in ug/m3 and returns
the hourly series. Tested on recorded station series: the maximum of each learned day equals
`p50` to 0.01, the dip never passes `p10`, a flat physics series gives a flat day, the ramp never
moves the peak hour, a day without a learned row is unchanged, and `shadow` input (empty map)
returns the input.

### 5.4 `haze/why.ts`, pure

`whyFor(day, physics hours of that day, windAtPeak)` returns the sentence of 4.2 or null when
there is no learned row. Tested on the two templates and the 5 ug/m3 line.

### 5.5 `haze/field.ts`, one new function

`correctToPoints(frame, points: {lat, lon, pm25}[])` samples the frame bilinearly at each point,
spreads the differences with the existing `spread` (inverse distance, 15 km near scale, 200 km
fade) and adds them. Tested: a single point moves its own cell to its target within 0.5 ug/m3
and leaves cells 400 km away unchanged; a frame with no points is returned as is.

### 5.6 `haze/run.ts` and `jobs/forecast.ts`

The run takes two new optional inputs: `instruments` (id, lat, lon for all 189) and `learned`
(instrument id to a map of day to p10, p50, p90). It computes `physics` for every station and
every instrument, stores `physics` with each station forecast, and for every future frame on a
Malaysian day later than today's applies `correctToPoints` with each instrument's rule 2 value
at that hour. `forecast_runs.learned_version` records the version. `jobs/forecast.ts` loads the
newest non-stale issue through a new `modelForecasts.latestIssue(db, notBefore)` and
`listInstruments(db)` when `MODEL_MODE` is `live`, else passes nothing. The cycle asks the model
service before the forecast run instead of after, so the 08:00 run already carries the day's
issue.

`run.ts` is 120 lines today; the learned correction goes in its own `haze/learned-frames.ts`
so neither passes 200.

### 5.7 `services/outlook.ts` and `services/forecast-source.ts`

`outlookFor` reshapes the hourly series with `physics` and the learned days, labels each day's
source, builds the why from `physics` and the wind at the station at the peak hour (read from
`weather_hours` through the repository), and attaches `source`. `forecast-source.ts` builds the
`ForecastSource` from `model-skill` and the model service's report, memoised for five minutes
in the api process because the map, every panel and every tool ask for it.

### 5.8 Model service, `GET /report`

Returns the live version's `scores.json` trimmed to what the page draws: version, trained at,
promotion score, pooled by kind for d1 and d2 (model, persistence, v2, climatology: MAE,
hazy MAE, hit and false alarm at 150 and 200, below p10, above p90), intervals, by block (block,
model, persistence, v2 hazy and all-day MAE for d1 and d2), onset, scenarios, leaks, ablation.
`compose.yaml` mounts `./model/reports` read-only at `/app/reports` for the `model` service.
`sources/model.ts` gains `report()` with a zod schema and a fake.

### 5.9 Backend route and service for the page

`GET /haze/model` in `haze.routes.ts`, `services/model-page.ts` composing `model-skill`, the
report, `modelForecasts.latestIssue`, readings for the watched stations, and the ledger from
`modelForecasts.scorable`. The watched stations are the six with the highest learned `p50`
tomorrow among DOE stations, plus the ids in `?follow=` from the browser's subscriptions.

### 5.10 Frontend

- `components/map/timeline.tsx`: the chips, calling `seek` from `use-time-travel.ts`.
- `components/map/forecast-caption.tsx`: the caption of 4.1, shown when `at > asOf`.
- `components/map/station-panel.tsx`, `day-rows.tsx`: the why line, the footer source line,
  the link to `/model`. The chart needs no change: it draws whatever `forecast` holds.
- `app/(app)/model/page.tsx` and `components/model/`: `verdict.tsx`, `watch-chart.tsx`,
  `ledger.tsx`, `block-chart.tsx`, `kind-table.tsx`, `checks.tsx`. One line in `nav.ts`.
- `lib/api/model-schemas.ts`, `model-client.ts`, and the additions to `haze-schemas.ts`.

### 5.11 Assistant

`get-forecast.ts` adds `source` to its result and its `source` chip reads "Learned model
2026-10-11-c88cac5a" or "Hourly forecast". `prompts/chat/v5.md` and `haze-decision` version 4
carry the trust sentence of 4.3. `CHAT_PROMPT` bumps.

## 6. Data flow, one cycle at 00:xx UTC

```
ingest (readings, fires, weather)
  -> model ask for the 00:00 issue -> model_forecasts (189 rows x 3 days)
  -> run: calibrate -> station forecasts + physics -> frames
       -> future frames corrected to the learned values at 189 points -> forecast_frames
  -> alerts, from the outlook (days already learned)

a request for /haze/stations/:id
  -> readings, station_forecasts (api, physics), newest learned issue
  -> reshape -> forecast line; days with source and why; ForecastSource (memoised)

a request for /haze/map
  -> frames as stored (already corrected), ForecastSource, learnedFrom
```

## 7. Testing

- Pure functions: `reshape`, `why`, `correctToPoints`, `learned-frames` on recorded fixtures
  from `backend/test/fixtures/`, with the invariants in 5.3 to 5.5.
- `services/outlook.test.ts`: for the 5 station sample with a recorded learned issue, every
  learned day's line peak equals its row peak; in `shadow` the output is byte-identical to
  today's; sources are labelled.
- `services/map.test.ts`: a corrected run's future frame at a station's cell is within 2 API
  points of that station's outlook line at the same hour.
- `services/model-page.test.ts` on fakes; `sources/model.test.ts` for `report()`.
- Frontend: schema mirror tests for the three changed schemas; `timeline` chip instants in
  Malaysian time across midnight; `forecast-caption` wording for learned, hourly and trial.
- Acceptance on the live stack, written into `docs/HANDOVER.md`: open Jerantut, the line and
  the rows agree for Mon and Tue; "Tomorrow" seeks the map and the caption names the model;
  `/model` shows the three tiles and the backtest chart; the assistant's answer about Tuesday
  names the learned model and its record; set `MODEL_MODE=shadow`, restart, and every forecast
  reads "hourly" with the line as before.
- Both suites green, `type-check` and `lint` clean, `pnpm build` in `frontend/`.

## 8. Work split

Four tracks, in parallel after the contracts and the migration are committed first:

| Track | Owns | Depends on |
| --- | --- | --- |
| A, outlook | 5.3, 5.4, 5.7 outlook part, `get-forecast`, prompt v5 | contracts |
| B, frames | 5.5, 5.6, `latestIssue`, cycle order | contracts, migration |
| C, map and panel | 5.10 map and panel parts, `haze-schemas` mirror | contracts |
| D, proof | 5.8, 5.9, 5.10 page parts, `forecast-source.ts`, `model-schemas` | contracts |

A and C meet on `StationOutlook`; B and C on `HazeMap`; D supplies `ForecastSource` to A and B
through `forecast-source.ts`, so D commits that file first.

## 9. Documentation

`docs/FEATURES.md` section 4 gets a subsection "One forecast" stating section 3's rule and the
labels; section 3.5 points to the Model page; section 10's limit 1 is rewritten to say the
hourly forecast is used for today only. `docs/HANDOVER.md` records the acceptance list and the
phase 2 item: hourly issue. `README.md` adds `/haze/model` and `GET /report` to the tables.

## 10. Acceptance

1. On a DOE station with a learned issue, the panel line's maximum on each learned day equals
   the day row's peak, and the map's future frame at the station agrees within 2 points.
2. Every forecast number on the map, in the panel, in an alert card and in an assistant answer
   can be traced to its source label, and the label is right in `live`, `shadow` and `off`.
3. `/model` answers "how good is it" in three tiles without a file being opened.
4. `MODEL_MODE=shadow` reproduces today's behaviour exactly, with labels.
5. Nothing about the model, its training or its rule changes. `docs/MODEL.md` needs no edit.
