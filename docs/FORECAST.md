# How the forecast works, how it was checked, and what changed

Written 10 October 2026. This is the forecast's own document: what the number is, how the
simulation runs, how each part was checked, the backtest that chose the method, and what was
tried and dropped. `docs/FEATURES.md` section 4 describes the feature around it.

## 1. What DOE's number is

The API on APIMS is, in a haze episode, the PM2.5 sub-index of the **24 hour running mean**
PM2.5 concentration, recomputed every hour (DOE, "Air Pollutant Index Calculation", APIMS,
January 2025, https://eqms.doe.gov.my/Documents/APIMS/API_Calculation.pdf). Each sub-index is
linear inside a band, and the bands are very unequal:

| API | 24 h PM2.5, ug/m3 | ug/m3 per API point |
| --- | --- | --- |
| 0 to 50 | 0 to 12.0 | 0.24 |
| 51 to 100 | 12.1 to 50.4 | 0.78 |
| **101 to 150** | **50.5 to 55.4** | **0.10** |
| 151 to 200 | 55.5 to 150.4 | 1.94 |
| 201 to 300 | 150.5 to 250.4 | 1.00 |

An older DOE deck (doe.gov.my, 2021) has a single 101 to 200 band over 75.5 to 150.4. Our own
readings rule it out: in the stored week, values 52 to 100 and 151 to 190 occur 100 to 200 times
each, values 101 to 150 about 10 times each, and 151 alone 107 times. The 2025 table turns the
same readings into a smooth concentration histogram.

Two consequences shaped everything below:

- **A reading crosses 101 to 150 in an hour or two.** 99, 115, 151 at Kuantan on 10 October is a
  24 h mean of 49.6, 51.9, 55.5 ug/m3: an ordinary change. Smoke adds concentration, not index
  points, so the model now works in ug/m3 and converts at the edges (`haze/api-index.ts`).
- **The index is a running mean.** Over one hour it moves by (this hour's PM2.5 minus the same
  hour yesterday) / 24. In the readings, hour-to-hour changes are most negatively correlated
  exactly 24 hours apart: r = -0.13 in index points, -0.30 once converted to concentration,
  the signature of an hour entering the window and leaving it a day later.

## 2. How the simulation runs

All of it is pure code in `backend/src/haze/`, run once an hour by `jobs/forecast.ts`.

1. **Load what was known** (`jobs/forecast.ts`, `loadRunInput`). Weather from 8 days before the
   run to 84 hours after, fire cells, and every station's readings up to the run's hour. The run's
   hour is the newest hour most stations have posted (`haze/complete-hour.ts`).
2. **Fires** (`fires.ts`, `fire-screen.ts`). NASA FIRMS VIIRS detections from three satellites,
   sun glint and offshore flares removed, summed per 0.1 degree cell and UTC day, taking the
   largest satellite's sum. Days after the last complete UTC day are not known, so each cell
   burns at its mean of the last three known days.
3. **Wind and rain** (`sources/weather.ts`). Open-Meteo's forecast model, not ours: the mean of
   the 925 and 850 hPa winds (smoke travels about 0.5 to 2 km up) and surface rain, on a one
   degree grid. Past hours are its analysis; future hours its forecast.
4. **Transport** (`transport.ts`). Each fire cell releases 6 particles a day, carrying its fire
   power as mass. Every hour each particle moves with the wind where it is (bilinear between grid
   points), takes a random step for turbulence (K = 5000 m2/s), loses mass with a 72 hour
   e-folding and to rain (x exp(-0.36 P^0.8) for P mm in the hour), and adds its mass to the
   quarter-degree cell it is in. Particles live at most 144 hours.
5. **Ensemble** (`ensemble.ts`). Ten runs with wind speed x0.85 to 1.15, direction +/-10
   degrees, turbulence, decay 48 to 120 hours and rain removal varied, averaged. Seeded, so the
   same inputs give the same run.
6. **Smoke at a station** (`smoke.ts`). The mass within 50 km, as a trailing 24 hour mean,
   because that is what the index is.
7. **Calibration** (`calibrate.ts`). Each reading is turned back into 24 h PM2.5 and
   `PM2.5 = intercept + slope x smoke` is fitted over the 120 hours before the run, across all
   stations. A straight line, because smoke adds mass; the square root it replaced was standing in
   for the bends in DOE's table.
8. **Station forecast** (`station-forecast.ts`, section 4). From the reading and its recent slope.
9. **Map frames** (`field.ts`). Model PM2.5 plus each station's error (reading minus model),
   spread to nearby cells and fading to nothing 200 km from every station. Forecast frames start
   from the frame at the run's hour and add the stations' slope near them and the model's change
   far from them. Converted to API cell by cell.
10. **Chances** (`chance.ts`, `outlook.ts`). The spread of past errors by lead, applied to the
    forecast peak of each Malaysian day.

## 3. The jump between Now and the forecast

On the map, run 18 (as of 07:00 UTC, 10 October) moved by a mean of 38 API points over the
peninsula, and up to 68 at one cell, between its 06:00 and 07:00 frames; neighbouring frames
moved 1 to 7. At stations, Balok Baru Kuantan read 151 at 07:00 but its forecast for 08:00 was
115. Two causes:

1. The run was made at 07:07, from an hour DOE had posted for 3 stations of 68. Kuantan's
   forecast was anchored on its 06:00 reading (115), while the panel later showed 151. Fixed by
   starting each run from the newest complete hour (`complete-hour.ts`, commit ae90912).
2. The frame at the run's hour spread errors only from stations with a reading at that exact
   hour, while station forecasts accepted one up to 6 hours old. Fixed in `run.ts`: one anchor per
   station, used alike by its forecast and by the map, and forecast frames that start from the
   frame at the run's hour, so the first forecast frame follows on from Now. A test now holds the
   mean change between the two under 3 points.

Runs now carry `model` (`v2`), migration `005_run_model.sql`, so a v1 and a v2 run of the same
hour are never drawn or scored together.

## 4. The station forecast, v2

```
pm25(h) = pm25(now) + slope x (0.9 + 0.9^2 + ... + 0.9^h)
slope   = (pm25(now) - pm25(now - 3 h)) / 3          ug/m3 per hour of the 24 h mean
API(h)  = DOE sub-index of pm25(h)
```

Why: the slope of a 24 h mean is (this hour - the same hour yesterday) / 24, so it measures how
much dirtier today's air is than yesterday's at the same time of day. The hours still to roll out
of the window mostly carry that same difference, fading with an e-folding of about 9.5 hours.
After haze arrives the index keeps rising for most of a day; after it clears it keeps falling.
"No change" cannot see either.

The smoke model's change is **not** added. Section 5.3 shows why. The model still draws the map
away from stations, where it is the only information there is.

## 5. The backtest

### 5.1 Leak controls

| Leak | How it is closed |
| --- | --- |
| Readings after the run | `loadRunInput` reads readings up to the run's hour only; the scorer alone sees later ones |
| Fire days not complete at the run | `emissionsFor` drops days after the last complete UTC day |
| Calibration | fitted on readings up to the run's hour; runs too early to fit fall back to `FIRST_FIT`, and those runs were left out of every comparison |
| Settings chosen on the test period | every setting was chosen walk-forward (only from forecasts already checked at the time) or on a split before 7 October 18:00 and tested after |
| Future wind | `weather_hours` keeps the analysis for past hours. Measured, not removed: section 5.3. The final station forecast uses no weather at all |

### 5.2 Result: readings only, every hour of 3 to 10 October

85,000 forecasts, each from readings up to its own hour. Mean absolute error in API points on
identical cases. Walk-forward re-chooses the slope hours (3 or 6) and fade (0.8 to 0.95) at each
run from forecasts already checked; it settled on 3 and 0.9.

| Lead | Cases | No change | v2 | Change | Walk-forward: no change | v2 | Change |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 h | 11,356 | 1.08 | 0.82 | -24% | 1.08 | 0.81 | -25% |
| 3 h | 11,220 | 2.99 | 2.09 | -30% | 2.99 | 2.10 | -30% |
| 6 h | 11,016 | 5.61 | 4.20 | -25% | 5.61 | 4.27 | -24% |
| 12 h | 10,608 | 10.23 | 8.56 | -16% | 10.27 | 8.89 | -14% |
| 24 h | 9,792 | 16.84 | 16.57 | -2% | 17.68 | 17.06 | -4% |
| 48 h | 8,160 | 26.22 | 25.37 | -3% | 22.15 | 22.27 | +1% |
| 72 h | 6,528 | 37.02 | 35.55 | -4% | 22.75 | 26.23 | +15% |

By period, the 6 hour gain holds every time (-24%, -30%, -20% for runs on 3 to 5, 6 to 7 and 8 to
10 October). From 24 hours on it depends on the period: it helped while haze built (-2% to -6%)
and cost 6% to 10% on 8 to 10 October. **Read it as: clearly better than no change up to about
12 hours, level with it beyond a day.** Resampling whole days (a day's forecasts are not
independent), the 90% interval of v2 minus no change is -0.36 to -0.17 points at 1 hour, -1.85 to
-1.00 at 6, -2.30 to -1.04 at 12, and -0.98 to +0.47 at 24 hours, over 7 to 8 days of runs.

### 5.3 The smoke model's change, and the wind leak

21 runs every 6 hours, 5 to 10 October, rerun from frozen inputs with five weather settings. The
correlation of the model's predicted change in a station's 24 h PM2.5 with the change that
happened, and the old v1 forecast's error:

| Wind | Rain removal | Corr. 24 h | Corr. 48 h | Model's mean change 24 h (actual +5.3) | v1 error 24 h | v1 error 48 h |
| --- | --- | --- | --- | --- | --- | --- |
| 925/850 hPa analysis (stored) | as is | 0.53 | 0.54 | +2.5 | 14.56 | 20.23 |
| 925/850 hPa analysis | x0.25 | 0.52 | 0.51 | +4.2 | 14.04 | 19.58 |
| 180 m, best known now | as is | 0.40 | 0.45 | -2.3 | 15.63 | 21.06 |
| 180 m, **as forecast at the time** | as is | **0.20** | **0.26** | -4.8 | 16.51 | 23.55 |
| 180 m, as forecast at the time | x0.25 | 0.26 | 0.24 | -2.7 | 16.20 | 24.06 |

Open-Meteo keeps its old forecasts for winds at fixed heights (its previous-runs API), not at
925/850 hPa, so the leak was measured at 180 m: knowing the real wind doubles the model's skill
at predicting change. On the same runs "no change" scored 14.59 and 19.41. Adding any share of
the modelled change to the station forecast, chosen walk-forward, made 24 to 72 hour forecasts
worse than no change: +1% to +31% with the leaky wind, +10% to +61% with the wind as forecast.
So v2 adds none of it. The v1 "ties with no change" figures in FEATURES.md 4.5 were measured
with the leaky wind and with settings chosen on the same week.

The model still earns its place on the map: it says where smoke is. Its fit to readings across
stations is a rank correlation of 0.835 with the 925/850 hPa wind against 0.69 at 180 m, which
confirms the wind level; weaker rain removal lowered it to 0.821, so rain removal was left alone.

### 5.4 Tried and dropped

- **Recovering hourly PM2.5 from the 24 h means** (regularised deconvolution) and carrying the
  latest hour forward. Worse than no change at every lead (2.14 against 1.06 at 1 hour), because
  it carries the time of day forward too: haze builds overnight and mixes out by afternoon, and
  "no change" in a 24 h mean is in effect "same as this hour yesterday".
- **The smoke model's change in PM2.5 with a fitted gain.** In-sample it looked best beyond a day
  (19.0 against 24.5 at 48 hours); out of sample it lost (section 5.3). From 7 October the model
  predicted the 24 h mean would fall 11 to 19 ug/m3 in a day or two while it held or rose.
- **Weaker rain removal.** Less biased change, worse spatial fit; not adopted.

## 6. Component checks

| Part | Check | Result |
| --- | --- | --- |
| DOE readings | Coverage, stuck values | 68 stations x 170 hours, 100% present. Longest run of one value 18 hours, normal for a 24 h mean on a plateau |
| DOE posting | Stations reporting the newest hour at 7 minutes past | 3 of 68: the cause of the Now jump; runs wait for 80% |
| Index table | Readings against both DOE decks | The 2025 table fits; the 2021 one cannot make the 101 to 150 hole |
| Wind, stored | Against 95 radiosonde ascents at 925/850 hPa (NOAA IGRA2: Sepang, Kota Bharu, Kuching, Bintulu, Kota Kinabalu, Medan, Tarakan, Singapore), 3 to 10 October | Direction error median 6 degrees (p75 11) where wind > 3 m/s. Vector error 1.4 m/s on a mean 3.3 m/s. Runs 0.7 m/s slow |
| Wind, forecast | Open-Meteo forecasts issued 1 to 4 days earlier against its later best estimate, 180 m, whole grid | Direction error median 9 to 12 degrees; vector error 2.0 to 2.4 m/s on a mean 4.0 |
| Rain, forecast | Same comparison, hours over 0.5 mm | A day ahead it catches 33% of wet hours, and 70% of its wet hours stay dry. Hourly rain at a grid point is close to unforecastable |
| Transport and calibration | Rank correlation of modelled smoke with readings, per run | 0.835 mean (0.63 to 0.92) across 21 runs |
| Station forecast | Section 5 | Better than no change to 12 hours, level beyond a day |

## 7. Claude as a forecaster

Tested, not adopted. Claude (Opus, through the proxy) was given, for each run hour, only what a
forecaster would have had then: every station's readings up to that hour, fire power by region for
complete UTC days, the 180 m wind and rain as Open-Meteo forecast them before that hour, the
statistical forecast and the smoke model's predicted change, and published domain knowledge (the
DOE table, plume heights, monsoon timing, rain washout), with nothing learned from this week's
backtest. It returned each station's API at +24, +48 and +72 hours, scored like everything else.
Its training data ends before October 2026, so it cannot know the outcome. Results are added below
when the replay of 5 to 9 October finishes; until it beats "no change" out of sample, no number on
the map or in an alert comes from a language model.

## 8. Rerunning it

```sh
cd backend
pnpm haze:evaluate            # replay the stored week every 6 hours, score against no change; writes nothing
pnpm haze:evaluate 3 2026-10-07T18:00:00Z   # every 3 hours, only runs from that instant
```

It loads each run through `loadRunInput`, so it sees what a live run would have seen, except the
weather (section 5.3). The Track record page scores the stored runs the same way at 24, 48 and
72 hours, for v2 runs only.

## 9. What would help next

1. **Store weather by fetch time** (a new table) so the model's change can be judged on the wind
   it really had. Until then no claim about it beyond section 5.3 can be made.
2. **Wind speed.** The stored wind runs 20% slower than the radiosondes. Test the ensemble's
   speed range centred on 1.2 instead of 1.0 against readings.
3. **Fire persistence.** The model's change went wrong when detected fire power fell on 9
   October while the readings held: peat smoulders under cloud and smoke, unseen. A slower decay
   of assumed fires, or GFAS emissions from CAMS, are the candidates.
4. **More weeks.** Every number here is one haze week. Rerun `pnpm haze:evaluate` as the stored
   history grows; the chances switch to the app's own errors at 300 checked cases per lead.
