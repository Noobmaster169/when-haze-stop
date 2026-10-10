# When Haze Stop: features and how they work

This is the handover document. It says what the product does, how each feature is supposed to
behave, where the code for it lives, and what is known to be weak. Read `CLAUDE.md` first for the
code rules, and `README.md` for setup.

Contents

1. What the product is
2. How the parts fit together
3. Data: what is fetched, from where, and how it is stored
4. Feature 1: the haze map and forecast
5. Feature 2: alerts
6. Feature 3: the assistant
7. The API
8. Running it
9. Tests
10. Known limits and what to build next
11. Glossary

## 1. What the product is

A web app about haze in Malaysia with three features that share one set of data.

| Feature | What a person gets |
| --- | --- |
| Haze map | The official readings now, the past week, and a forecast 3.5 days ahead, on a map of Sumatra, the peninsula and Borneo, with the fires, the wind and the airport visibility that explain it. |
| Alerts | A banner in the app when a followed area crosses an official line, when the forecast says haze is arriving, and when it says haze is clearing. |
| Assistant | A chat panel that answers haze questions and gives recommendations (school, outdoor work, events, travel) from the same data, and names its sources. |

Two rules shaped every decision:

- Real data only. Nothing in the product is made up. Every number on a screen came from DOE,
  NASA, Open-Meteo or the model run on them.
- Honest about skill. The forecast was tested and is about as accurate as assuming no change. The
  app says so on the station panel, on the Track record page and in every assistant answer that
  leans on the forecast.

"API" in this document and in the app means Malaysia's Air Pollutant Index, the number DOE
publishes. It does not mean a programming interface unless the section is called "The API".

## 2. How the parts fit together

```
DOE readings --+
NASA fires   --+--> jobs (hourly) --> Postgres --> api (Express) --> Next.js --> browser
Open-Meteo   --+        |                            |
                    smoke model                  chat agent --> llm-proxy --> claude -p
```

Two backend processes, started separately:

| Process | Command | What it does |
| --- | --- | --- |
| api | `pnpm dev` | Serves the map, alerts and chat. Only reads haze data. Never calls a data source except the geocoder. |
| jobs | `pnpm haze:loop` | Fetches the sources, runs the model, stores the result, raises alerts. Once an hour. |

They are separate on purpose: a model run takes many seconds of CPU and must not hold up a chat
answer. If the jobs process is not running, the app still works and shows the last run.

Backend folders added for this product (all under `backend/src/`):

| Folder | Role | Rule |
| --- | --- | --- |
| `haze/` | The model and every rule, as pure functions. No database, no network. | Core. Imports nothing but itself and contracts. |
| `sources/` | One client per outside service, each behind an interface with a fake in `__fakes__/`. | Adapter. No test may call a real source. |
| `repositories/` | All SQL. | Adapter. |
| `services/` | Reads that several callers share (map, station outlook, place lookup). | Composes repositories and `haze/`. Used by routes, jobs and chat tools so they cannot disagree. |
| `jobs/` | The hourly cycle and its command line. | Orchestration. |
| `routes/haze.routes.ts`, `routes/alerts.routes.ts` | HTTP. | Thin: validate, call, answer. |
| `agents/chat/tools/` | The assistant's tools, one file each. | See section 6. |

## 3. Data

### 3.1 Sources

| What | Source | Endpoint | Cadence | Client |
| --- | --- | --- | --- | --- |
| Hourly API readings, 68 stations | DOE Malaysia APIMS | `https://eqms.doe.gov.my/api3/publicportalapims/apitablehourly?stateid=N&datetime=YYYY-MM-DDTHH:00:00&` | Every hour | `sources/doe.ts` |
| Station list with coordinates | DOE Malaysia APIMS | `.../publicportalapims/mapcaqm` | Every hour | `sources/doe.ts` |
| Fire detections | NASA FIRMS, VIIRS on S-NPP, NOAA-20, NOAA-21 | Three 7-day CSV files under `https://firms.modaps.eosdis.nasa.gov/data/active_fire/` | Every 3 hours | `sources/firms.ts` |
| Wind at 925 and 850 hPa, rain | Open-Meteo forecast API | `https://api.open-meteo.com/v1/forecast` | Every hour | `sources/weather.ts` |
| Older fires, and NASA's label for hotspots that are not fires | NASA FIRMS area API (needs `FIRMS_MAP_KEY`) | `https://firms.modaps.eosdis.nasa.gov/api/area/csv/<key>/<product>/<area>/<days>/<date>` | By hand, `pnpm haze:history` | `sources/firms-archive.ts` |
| Wind and rain before the first run | Open-Meteo historical forecast API | `https://historical-forecast-api.open-meteo.com/v1/forecast` | By hand, `pnpm haze:history` | `sources/weather.ts` |
| Singapore's 24-hour PSI and one-hour PM2.5 for five regions, stored as five more stations | NEA Singapore, via data.gov.sg | `https://api.data.gov.sg/v1/environment/pm25` and `/psi` | Every hour | `sources/nea.ts` |
| Airport weather reports (visibility, haze or smoke) for 29 airports | NOAA Aviation Weather Center | `https://aviationweather.gov/api/data/metar?ids=...&format=json` | Every hour | `sources/metar.ts` |
| Place names | Open-Meteo geocoder | `https://geocoding-api.open-meteo.com/v1/search` | On search | `sources/geocoder.ts` |
| Coastlines, borders, towns | Natural Earth (public domain) | Packed once into `frontend/public/basemap.json` | Static | `frontend/components/map/basemap.ts` |

Only the FIRMS archive needs a key, and only `pnpm haze:history` uses it.

Things to know about each source, learned by using them:

- DOE answers in Malaysian time (UTC+8). The client converts to UTC. It serves the 24 hours
  before the instant asked for, one state at a time (16 state ids), and only about 7 days back.
  Older readings cannot be fetched later, which is why readings are never deleted.
- DOE returns an empty body when called faster than about once every 700 ms. The client spaces
  its calls and retries an empty answer.
- DOE publishes the index only, not PM2.5 or PM10 concentrations. WHO guideline values are
  concentrations, so they cannot be applied to this feed.
- FIRMS files are 8 to 9 MB each. Low-confidence detections are dropped. Three satellites see the
  same fire, so a cell's fire power for a day is the largest of the three satellites' sums, not
  their total.
- Open-Meteo is asked one grid row at a time (15 requests of 23 points), 1.5 s apart. Its last
  forecast hours can be empty for some variables; the grid stops at the first incomplete hour.
- NEA's regions are stations (`network = 'nea'`, ids `SGCENTRAL` to `SGWEST`, placed where NEA
  labels them). Their reading in `readings` is the 24-hour PSI, built the same way as the API and
  on the same bands, so the map, the panel, the model's station correction and the assistant
  treat them like any station. The run's hour is DOE's newest, not NEA's, because NEA posts a few
  minutes earlier. Alerts are not raised for them: the lines are Malaysian.
- A METAR writes visibility in metres in the raw report, and `9999` means ten kilometres or
  more. The JSON's statute miles are only a fallback. `HZ` is haze and `FU` is smoke, as the
  observer at the airport called it. The list of airports is in `sources/metar.ts` and reaches
  into Sumatra and Kalimantan, where visibility shows the smoke at its source.
- NEA posts the PM2.5 and PSI feeds seconds apart; a fetch between them stores what it has, and
  the next fetch fills the null in. That is the one update `nea_hours` allows.

- The FIRMS archive has two feeds. The live one (NRT) goes back about three months and has no
  label. The standard product runs about three months behind and labels every hotspot: vegetation
  fire, active volcano, other static land source, offshore. It serves 5 days per request, and a
  request for this region costs about 7 of the key's 5,000 transactions per 10 minutes.
- Open-Meteo's reanalysis archive has no wind at 925 or 850 hPa. Its historical forecast API
  does, from 2022, so that is the one used for past wind.

### 3.1.1 Screening the fires

A hotspot is not always a fire. These screens run before a detection becomes smoke in the model or
a dot on the map, in this order. `haze/burning.ts` is the one function that applies them, used by
both the hourly fetch and the archive replay:

| Screen | Takes out | How | File |
| --- | --- | --- | --- |
| Low confidence | Mostly sun glint and hot roofs | NASA's own confidence column | `sources/firms.ts` |
| Sun glint | The sun's reflection off the sea, seen as a wall of saturated pixels | A sunlit half-degree block of one pass with 50 or more detections, 90% of them at the sensor's ceiling | `haze/fire-screen.ts` |
| Open sea | Gas flares on platforms | More than 10 km from any coast | `haze/fire-screen.ts`, `haze/land.ts` |
| Fixed sources | Gas flares on land, smelters, power plants, volcanoes | Within one 0.01 degree cell of a place NASA's labelled archive marked on 3 or more days | `haze/fixed-sources.ts` |
| Unconfirmed | A single faint pixel seen once: a hot roof, a reflection, a burn-off too small to make haze | A cell-day is kept only if two or more satellite passes saw it, or its fire power is 10 MW or more | `haze/fire-confirm.ts` |

The fixed source list comes from two years of the labelled archive (`fixed_source_days`). Built on
10 October 2026 from 1 July 2024 to 30 June 2026 it held 19,423 sightings, almost all "static land
source" or "offshore" and 11 "volcano", which make 370 sites. Those sites and their neighbouring
cells cover 97.5% of NASA's own labelled sightings.

What it removed, measured on the live feed from 1 July to 10 October 2026: 15,777 of 903,230
detections (1.7%). In July, before the burning season, it was 3,223 of 33,603 (9.6%). In the week
of 3 to 10 October it was 0.4% of the fire power. So the screen removes a steady set of false
fires, and in a haze episode nearly everything left on the map is vegetation burning.

The confirmation rule is the strict one. Over 1 July to 10 October 2026 all the screens together
took out 34,553 of 99,947 cell-days (35%) and left 96.2% of the fire power. On the map of the
newest three days that was 1,473 dots before and 1,033 after. The cost is real small fires that
only one pass saw, under cloud for the rest of the day.

`fire_cells.frp_mw` stays what was fetched. `burning_mw` is what is left after the screens, zero
for a cell-day that was all taken out, and every read uses it. Nothing is deleted when a rule
changes: bump `SCREEN_VERSION` in `haze/burning.ts` and `haze:history` works the burning part out
again for every day the live archive still serves.

### 3.1.2 Shared data: the seed

Every developer runs their own Postgres, and three things in it cannot simply be fetched again:
DOE serves one week of readings, the fire archive needs a key, and the fixed sources take a two
year replay. So they are kept in the repository, in `backend/db/seed/` (four gzipped tab-separated
files, under 1 MB together): `stations`, `readings`, `fixed_source_days`, `fire_cells`.

- `node db/seed.mjs` (`pnpm db:seed`) loads them. The compose `migrate` service runs it after the
  migrations. It only adds rows, records each file's hash in `seed_files`, and loads a file again
  only when a newer one is committed.
- `pnpm db:export-seed` writes them from the local database. Run it on the machine that has been
  fetching longest and commit the result, at least once a week: a teammate who starts more than 7
  days after the last export has a gap in the readings that DOE can no longer fill.
- Wind is not in the seed (too large). The jobs service fetches it for the seeded days by itself,
  with no key, on its first start (about 7 minutes).

### 3.2 The region and the two grids

Defined in `haze/grid.ts`. Longitude 96 to 118 east, latitude 6 south to 8 north. That holds the
fires that reach Malaysia and the sea the smoke crosses. Singapore, southern Thailand and Brunei
fall inside it.

| Grid | Size | Used for |
| --- | --- | --- |
| Weather | 23 by 15 points, 1 degree | Wind and rain |
| Field | 88 by 56 cells, 0.25 degree (about 28 km) | Smoke and the API shown on the map |

Both are stored row by row from the south-west corner.

### 3.3 Tables

Migrations `backend/db/migrations/002_haze.sql` and `003_source_fetches.sql`. Never edit an applied one; add the next number for a change.

| Table | One row is | Notes |
| --- | --- | --- |
| `stations` | A DOE station | Upserted every hour. |
| `readings` | One station, one hour, one API value | Insert only. The history is the only backtest there is. |
| `fire_cells` | Fire power in one 0.1 degree cell on one UTC day | Upsert keeps the larger value. `burning_mw` is the part left after fixed sources (migration `004_fixed_sources.sql`); null on a row stored before any were known. |
| `fixed_source_days` | One 0.01 degree cell on one UTC day that NASA's archive labelled volcano, static or offshore | Insert only. A cell seen on 3 or more days is a fixed source. |
| `weather_hours` | Wind and rain over the whole weather grid for one hour | Upsert replaces an hour. See the note below. |
| `forecast_runs` | One run of the model | `as_of` is the newest reading it saw. `kind` is `live` or `backfill`. `fit` holds how well smoke matched readings. |
| `forecast_frames` | The API field at one time for one run | One byte a cell, API / 2. |
| `station_forecasts` | One station's hourly forecast for one run | 84 values, from `as_of` + 1 hour. |
| `alert_subscriptions` | A browser following a station | No login. `session_id` is made by the browser. |
| `source_fetches` | One fetch of a source by the jobs process | Migration `003_source_fetches.sql`. Insert only: when, how long, what came back or why it failed. The Sources page reads it. |
| `alert_events` | One alert | `open` stays true while its condition holds. A unique index allows only one open alert per station, kind and line. |
| `airports`, `metar_obs` | An airport; one of its weather reports | Migration `005_context_sources.sql`. Insert only. Visibility in metres, 10000 for ten kilometres or more; the present weather codes; the raw report. |
| `nea_hours` | One Singapore region for one hour | The one-hour PM2.5 and the 24-hour PSI and PM2.5. A null filled in by a later fetch is the only update. The PSI is also a row in `readings`. |
| `cams_hours` | Empty | Made by migration `005` for a composition forecast that was then dropped from the product. Nothing writes it. |

Note on `weather_hours`: this is the one table where a later fetch overwrites an earlier value. An
hour first arrives as a forecast and is later replaced by the weather model's analysis of what
happened, which is the better wind for hindcasts. The trade-off is that the wind a past forecast
actually used is not kept, so backfilled runs see better wind than a live run would have. If
forecast skill is ever to be measured strictly, store weather by fetch time instead (a new table
in a new migration).

## 4. Feature 1: the haze map and forecast

### 4.1 What the person sees

Page `/map` (also the home page).

- A map with five layers that can each be switched off: Haze (the coloured field), Stations (a
  dot per DOE station and NEA region, coloured by its value), Fires (satellite detections of the
  last two days, sized by fire power), Wind (moving streaks that follow the wind carrying the
  smoke), Visibility (a square per airport, darker the shorter its observer could see at the
  timeline's moment, the distance written under it below ten kilometres, a red ring for
  reported smoke). Visibility follows the timeline through the past week and is blank in the
  forecast half, because it is observed, never forecast.
- A timeline under the map: the past 7 days and the next 3.5 days. Play, drag, or press Now.
  Left of the Now mark the map shows what was read. Right of it the map shows the forecast, and
  the label turns blue and says how many hours ahead.
- Search by place name. A result that is not itself a station says which station is nearest and
  how far, because that station's readings are what will be shown.
- Click a station: a panel opens with its value at the timeline's moment, a chart of its week and
  forecast, and a table of the next days with the chance of passing each official line
  (100, 150, 180, 200). The panel has the "Alert me here" button.
- Click anywhere else: a small card with the model's estimate at that spot and a link to the
  nearest station.
- `/map?station=CA24N` opens on that station. Alerts and assistant answers link this way.
- The page asks for new data every 5 minutes, so a new hourly run appears without a reload. If the
  timeline is on Now, it stays on Now when new data lands.

Looking back. Between the map and the timeline is the History strip: one bar per stored UTC day,
its height the day's fire power. Pressing a bar puts that day on the map: its fires, its wind, and
the haze field where one exists. The timeline then spans that one day. Days before the first DOE
reading (3 October 2026) have fires and wind only, and the timeline says so. Stations are not
drawn on a past day. Live goes back to now. Files: `history-strip.tsx`, `use-haze-day.ts`,
`unpackDay` in `map-data.ts`; backend `services/history.ts`.

Page `/sources` lists every outside source: what it gives, the endpoint, how often it is asked, and
its newest good and failed fetch with what came back (stations, readings added, detections, weather
hours). A source is marked late when two of its cycles pass without a good fetch. Below is the log
of the newest fetches. Every fetch is a row in `source_fetches`, written by `jobs/record-fetch.ts`.

Page `/accuracy` (Track record) shows the forecast's measured error beside "no change", the
official lines with their issuers, the data sources and the limits.

### 4.2 The model

A Lagrangian particle model: it releases particles where fires burn and moves them with the wind.
All of it is in `backend/src/haze/` and is pure.

Step by step for one run at hour `asOf` (`haze/run.ts`, `runModel`):

1. Emissions (`fires.ts`). Each fire cell and day becomes a source whose strength is its fire
   power. Fires on days after the last complete UTC day are not known yet, so the mean of the last
   three known days is assumed to continue. A run for a past hour only sees fires known at that
   hour.
2. Transport (`transport.ts`). Particles are released hourly from every source and stepped hourly.
   Each step: move with the wind (bilinear between weather points), add a random walk for
   turbulence (K = 5000 m2/s), lose mass by decay (72 hour e-folding) and by rain
   (factor exp(-0.36 x P^0.8) for P mm of rain in the hour). A particle is dropped after 144 hours
   or when it leaves the region. Mass is summed on the field grid each hour.
3. Ensemble (`ensemble.ts`). Ten members with different wind speed (0.85 to 1.15), wind
   direction (normal, 10 degrees), turbulence, decay time (48 to 120 hours) and rain removal. The
   random numbers are seeded (`rng.ts`), so the same inputs always give the same run. The mean of
   the ten is used.
4. Smoke at a station (`smoke.ts`). The mass within 50 km, as a trailing 24 hour mean. DOE's index
   is itself a 24 hour average, which is why.
5. Calibration (`calibrate.ts`). Over the last 120 hours before `asOf` (skipping the first 72
   hours of the run, when smoke released earlier is missing), fit
   `API = intercept + slope x sqrt(smoke)` across all stations. With fewer than 300 pairs or a
   slope that is not positive, the first real fit is used instead: 64.0 and 6.79. The rank
   correlation of that fit is stored with the run.
6. Station forecast. `forecast(h) = latest reading + 0.4 x (model(h) - model(asOf))`. The model
   is used for the change, not the level: the level comes from the reading. The 0.4 (GAIN) is
   there because the modelled changes tested about that much too large. A station silent for more
   than 6 hours gets no forecast.
7. Map frames (`field.ts`). A frame every 3 hours from 24 hours before `asOf` to 84 hours after,
   plus one exactly at `asOf`. Each frame is the modelled field corrected by the stations: every
   station's error (reading minus model) is spread to nearby cells, full weight within 15 km and
   fading to nothing at 200 km. Past frames use the readings of their own hour. Future frames use
   the station forecasts. So the map always agrees with the dots on it.

The wind level matters. Smoke travels around a kilometre up. The mean of the 925 and 850 hPa
winds matched a week of DOE readings with a rank correlation of 0.77, against 0.66 for wind at
100 m. Do not switch to surface wind.

### 4.3 The chance of passing a line

`haze/chance.ts` and `haze/outlook.ts`.

A forecast is one number. The chance comes from how wrong forecasts have been. For each lead
bucket (24, 48, 72 hours) and for stations that were above 100 or not, the 10th, 25th, 50th, 75th
and 90th percentile of (reading minus forecast) is kept. The chance of passing a line is the share
of that spread that would lift the forecast over the line, clamped to 1% to 99%.

For each local day (UTC+8) the outlook gives: the peak read so far, the forecast peak, a low and
high (10th and 90th percentile, so the range covers 8 in 10 past errors), and the chance for each
line. A day that has already passed a line in the readings has chance 1 for that line.

Until the database holds 300 checked forecasts for a bucket, the percentiles of the first test
(6 to 10 October 2026, hard-coded in `chance.ts`) are used. After that the app's own are used
automatically (`services/outlook.ts`, `loadErrors`).

Known simplification: the day's peak is treated like a single forecast value, which understates
the chance a little.

### 4.4 Thresholds

`haze/guidelines.ts` is the only place they are written. The map, the alerts, the Track record
page and the assistant all read it.

| API | Who | What happens | Issued by |
| --- | --- | --- | --- |
| Above 100 | Schools | Outdoor activities stop | Ministry of Education |
| Above 100 | Public and employers | Limit strenuous outdoor activity; sensitive groups limit time outdoors | Ministry of Health |
| Above 150 for 3 days | Schools | Schools close (from 12 October 2026) | Ministry of Education |
| Above 180 | Schools | Schools close (from 9 October 2026) | Ministry of Education |
| Above 200 | Employers | Avoid strenuous outdoor work | Ministry of Health |

Each entry carries the link to where the rule was reported. There is no national API line for
public events, and airports decide on runway visibility, not on API. The app says both.

Bands (Malaysia's own): 0 to 50 Good, 51 to 100 Moderate, 101 to 200 Unhealthy, 201 to 300 Very
unhealthy, above 300 Hazardous.

### 4.5 Accuracy and backtesting

Every stored run is a forecast that can be checked later. `repositories/scores.repo.ts` joins each
run's station forecast at 24, 48 and 72 hours to the reading DOE later published for that hour,
and to the reading the run started from. It reports the mean absolute error of the model and of
"no change" (persistence), and the error percentiles used for the chances. Nothing is
precomputed: the page always reflects what is in the database.

`pnpm haze:backfill` replays the model every 6 hours from one day after the first stored reading
(so the haze field starts at the first reading, 3 October 2026 07:00 UTC), each run seeing only
the fires and readings known at its hour, and stores them as `backfill` runs. This gives the
Track record page checked forecasts on day one. Backfilled runs use analysed wind, not the wind
that was forecast at the time, so they flatter the model slightly.

The first test, on real data fetched 10 October 2026:

| Lead | This model | No change | Cases |
| --- | --- | --- | --- |
| 24 h | 15.2 | 14.9 | 858 |
| 48 h | 20.2 | 20.6 | 594 |
| 72 h | 29.4 | 28.6 | 330 |

Average miss in API points. Modelled smoke against readings: Spearman 0.84 over 8,184 station
hours. Reading: the model places smoke well, but as a forecast it ties with assuming no change.
The wind level, the square-root conversion and the 0.4 gain were all chosen on that same week, so
these numbers are optimistic. Report them as they are.

### 4.6 How the map is drawn

`frontend/components/map/`. A canvas, no map library.

| File | Does |
| --- | --- |
| `haze-map.tsx` | The page: holds the timeline moment, the chosen station and the layers. |
| `use-haze-map.ts` | Fetches `/api/haze/map` every 5 minutes and the basemap once. |
| `map-data.ts` | Unpacks frames (base64, one byte a cell) and samples API or wind at a point and time. |
| `map-canvas.tsx` | Three stacked canvases: chart and haze, wind, marks and names. Paints directly from refs. |
| `use-gestures.ts` | Drag, wheel, pinch, keyboard, tap. |
| `heat.ts`, `draw.ts`, `labels.ts`, `wind-particles.ts` | The layers. |
| `geo.ts`, `field.ts`, `scale.ts` | Pure arithmetic: projection, sampling, colours. Tested in `map.test.ts`. |
| `timeline.tsx`, `map-controls.tsx`, `place-search.tsx`, `probe-tip.tsx` | Controls. |
| `station-panel.tsx`, `outlook-chart.tsx`, `day-table.tsx` | The station panel. |

Between two frames the map blends linearly, so the timeline moves smoothly although frames are 3
hours apart. Every colour is a token in `frontend/app/globals.css` (`--map-*`, `--api-*`); the
canvas reads them through `theme.ts`.

## 5. Feature 2: alerts

### 5.1 What the person sees

- Follow an area three ways: the "Alert me here" button on a station panel, the search on
  `/alerts`, or by asking the assistant ("alert me about Klang").
- An area is a DOE station. A town without a station follows its nearest one. This is the whole
  of "choosing an area": one tap, no settings.
- When a followed station has a new alert, a bar appears across the top of every page with the
  message, its time, "Show on map" and a dismiss button. Dismissing hides everything up to that
  alert, remembered in the browser.
- `/alerts` lists followed areas, recent alerts (mine, or all Malaysia), and what the three kinds
  mean.
- There is no login. The browser makes an id on first use and keeps it in local storage
  (`frontend/components/alerts/session.ts`). Clearing site data forgets the followed areas.

### 5.2 The rules

`backend/src/haze/alert-rules.ts`, pure and tested. After every model run the job
(`jobs/alerts.ts`) asks, for each station, which conditions hold now.

| Kind | Label | Holds when | Example message |
| --- | --- | --- | --- |
| `observed` | Now | The reading is above an official line. Only the highest such line. | "Seremban: API 182, above 180. Schools close under the Education Ministry rule." |
| `arriving` | Forecast | Tomorrow has at least a 60% chance of passing a line the reading is not yet above. Only the highest such line. | "Klang: 73% chance of API above 150 tomorrow. Three days in a row above 150 closes schools." |
| `clearing` | Clearing | The reading is above 100 and a later forecast day has at most a 40% chance of passing 100. | "Klang: likely to drop below 100 by Monday. Outdoor activities could resume then." |

Every message is one or two sentences: what happened, then what it means. English only.

One alert per event:

- A condition that newly holds opens an alert. A unique database index makes a second identical
  open alert impossible, so running the job twice says nothing twice.
- While the condition holds, nothing more is said.
- When it stops holding the alert is closed, and only then can it open again.
- A reading hovering at a line does not flap: an open "Now" alert stays open until the reading is
  5 points under its line.
- A station moving up from above 150 to above 180 gets a new alert, because that is a new line.

The forecast alert is the point of the feature, and also the one that can be wrong. The 60% bar
keeps wrong ones rare. Do not lower it without looking at how often it would have fired.

### 5.3 Delivery

In-app only: the bar polls `/api/alerts?session=...` every minute. Browser push (alerts while the
tab is closed) was cut from this version. The table already has a `push` column for a Web Push
subscription and the contract has the type. To add it: a service worker in the frontend, VAPID
keys in `config.ts`, and a send step in `jobs/alerts.ts` for each newly opened alert.

## 6. Feature 3: the assistant

### 6.1 What the person sees

The chat dock on the right of every page. Before the first question it shows five example
questions. An answer has the recommendation first, the numbers it rests on, a link to the station
on the map, a row of source chips (DOE, NASA FIRMS, Open-Meteo, Haze model, Ministry guidance),
and a collapsed "Tools used" block with every call it made. Conversations are kept and listed
under History. There is no login and no memory between conversations.

### 6.2 How a turn works

The starter's loop is unchanged (`agents/chat/loop.ts`): each step is one model call through the
proxy to `claude -p` that returns JSON, either up to four tool calls or the final answer. Calls in
one step run together, so the prompt tells the model to ask for everything in one step. A typical
question is two model calls.

The model is given no data in its prompt. Everything it states must come from a tool result.

### 6.3 Tools

`backend/src/agents/chat/tools/`, one file each, registered in `index.ts`. Each returns text for
the model, a one-line preview for the page, and a `source` shown as a chip.

| Tool | Arguments | Returns | Source chip |
| --- | --- | --- | --- |
| `get_air_quality` | `place` | Reading now and the last 24 hour range, with the station it came from. For a Singapore region, NEA's PSI and its measured one-hour PM2.5. | DOE, or NEA Singapore |
| `get_forecast` | `place` | Each day's forecast peak, range and chance of passing 100, 150, 180, 200; a value every 6 hours | Haze model |
| `get_guidelines` | none | The official lines, and that there is none for events or flights | Ministry guidance |
| `get_track_record` | none | Measured error at 24, 48, 72 hours beside "no change" | Haze model |
| `get_fires` | `place` optional | Burning cells and fire power by region for three days; distance and direction of the strongest from the place | NASA FIRMS |
| `get_wind` | `place` | Direction, speed and rain every 12 hours for three days | Open-Meteo |
| `get_visibility` | `place` | Visibility at the nearest airport now and the lowest in a day, what the observer reported in the air, and every airport in the region under 5 km | METAR |
| `create_alert` | `place` | Follows the nearest station for this browser | none |
| `get_time`, `load_skill` | | From the starter | none |

`place` can be a station id, a station name or any place name. `services/places.ts`
(`resolveStation`) tries the station names first, then the geocoder and the nearest station. If
the geocoder is down, station names still work. A tool that cannot find a place refuses, and the
model is told to say so rather than guess. `get_visibility` uses `resolvePoint` from the same
file, which gives the spot itself rather than a station, trying airport codes and usual names
("KLIA", "Changi", the list is `AIRPORT_ALIASES` in `sources/metar.ts`) before the geocoder,
because the geocoder reads "KLIA" as a village in Sabah.

`create_alert` needs to know which browser asked. The frontend sends its session id with each
question (`sessionId` on `POST /chat/:id/messages`), and the route passes it to the tools.

### 6.4 The prompt and the skill

- `agents/prompts/chat/v4.md` is the system prompt. It sets the scope (haze and air quality in
  Malaysia), tells the model to refuse anything else in one sentence, forbids stating a fact that
  did not come from a tool, says that Singapore's regions are stations on NEA's PSI and that a
  METAR is what an observer saw and not whether flights run, lists what the app has no data for
  (PM2.5 in Malaysia, flight delays, traffic, hospitals), and fixes the answer format. `v1.md`
  is the starter's; `v2.md` and `v3.md` are earlier versions and are kept, because prompts are
  never edited: a change is `v5.md` and a bump of `CHAT_PROMPT` in `loop.ts`.
- `agents/chat/skills/haze-decision/SKILL.md` is the procedure for "should we" questions: what to
  gather, how to turn a chance into go ahead, go ahead with a fallback, or do not go ahead
  (under 30%, 30 to 60%, over 60%), and which line applies to which activity. For events it says
  there is no official line and that using 100 and 200 is its own reading of the school and
  workplace rules. For flights it says to give the visibility the nearest airport reported and
  that airlines decide against their own minima, which the app does not know.

### 6.5 What it should and should not do

| Question | Expected behaviour |
| --- | --- |
| "How is the air in Shah Alam?" | Reading from the nearest station, named, with the time. |
| "Will schools in Seremban close tomorrow?" | Forecast peak, chance of passing 180, the rule and its issuer, one sentence on trust. |
| "Should the Sepang event go ahead on Sunday?" | A recommendation with a fallback, says there is no official event line. |
| "Is it safe to fly from KLIA?" | Gives the visibility KLIA reported and whether haze or smoke was in the report, the reading and forecast, says airlines decide on their own minima, says to check the airline. |
| "How is the air in Singapore?" | The nearest NEA region's PSI and measured PM2.5, named as NEA's. |
| "What is the PM2.5 in Klang?" | Says DOE publishes no concentration, gives the index. |
| "What about next month?" | Says the forecast reaches 3.5 days. |
| "Write me a poem" | One sentence refusal. |
| "Alert me about Klang" | Calls `create_alert`, confirms the station. |

### 6.6 The model behind it

Calls go to the `llm-proxy` container, which runs `claude -p` logged in with the developer's
Claude subscription (`CLAUDE_CODE_OAUTH_TOKEN`). That suits a local demo. Before serving other
people, switch the proxy to an Anthropic API key and check the terms: a personal subscription is
not meant to serve other users.

## 7. The API

Backend, on `127.0.0.1:8091`. The browser never calls it; it calls the Next routes under
`/api/...`, which forward; the Track record and Sources pages read it from the Next server. Contracts
are zod schemas in `backend/src/contracts.haze.ts`, `contracts.alerts.ts` and `contracts.sources.ts`,
mirrored by hand in `frontend/lib/api/haze-schemas.ts`, `alert-schemas.ts` and `source-schemas.ts`.
Change both together.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/haze/map` | `HazeMap`: latest run, both grids, stations with newest reading, frames for 7 days back and 84 hours ahead, wind at each frame, strongest 1500 fire cells of 2 days |
| GET | `/haze/days` | `HazeDays`: every stored UTC day with its burning cells and fire power, and the first hour a haze field exists for |
| GET | `/haze/days/:day` | `HazeDay`: one past day for the map: strongest 1500 fire cells, wind every 3 hours, and the frames of that day (empty before the first readings) |
| GET | `/haze/stations/:id` | `StationOutlook`: station, a week of readings, 84 hours of forecast, the day outlooks |
| GET | `/haze/accuracy` | `Accuracy`: error by lead for model and persistence |
| GET | `/haze/guidelines` | `GuidelineList` |
| GET | `/haze/places?q=` | `PlaceList`: stations by name first, then geocoded places, each with its nearest station |
| GET | `/sources` | `SourceReport`: each source from `sources/catalog.ts` with its newest good and failed fetch and the last 24 hours' tally, and the 60 newest fetches |
| GET | `/alerts?session=&after=` | `AlertFeed`: newest first; with a session only followed stations |
| GET | `/alerts/subscriptions?session=` | `SubscriptionList` |
| POST | `/alerts/subscriptions` | Body `{ sessionId, stationId }`. Following twice is following once. |
| DELETE | `/alerts/subscriptions/:stationId?session=` | 204 |
| POST | `/chat/:id/messages` | Body `{ content, sessionId? }`. Unchanged otherwise. |

Packed fields: a frame's `field` is base64 of one unsigned byte a cell, value API / 2. A wind
frame's `uv` is base64 of signed bytes, eastward then northward for each weather point, in
metres a second times 8.

There is no authentication. The api binds to loopback.

## 8. Running it

Everything at once, from the root (see README for the token):

```sh
docker compose up -d --build   # postgres, llm-proxy, migrate, api, jobs, frontend
docker compose logs -f jobs    # the first cycle, then the backfill, then hourly
```

The `jobs` service runs `once`, then `backfill`, then `loop`, the same three commands as below.
Backfill skips hours already run, so restarting the container costs little.

From source, with only the infrastructure in Docker:

```sh
# infra and api
docker compose up -d postgres llm-proxy
cd backend
pnpm install && pnpm db:migrate
pnpm dev                 # api on :8091

# data, in a second terminal
pnpm haze:once           # fetch everything, run the model once, raise alerts (a few minutes)
pnpm haze:backfill       # once, on day one: replay the stored week (fills the timeline's past and the Track record)
pnpm haze:loop           # then keep running: once now, then at 20 past every hour

# frontend, in a third terminal
cd ../frontend && pnpm install && pnpm dev    # http://localhost:3000
```

`pnpm haze:history` (`jobs/history.ts`) runs in the compose jobs service on every start, after the
first cycle. Without `FIRMS_MAP_KEY` it does only step 3, and the fires of the past are what the
seed loaded. With the key it does all three:

1. Stores two years of labelled fixed sources (about 290 requests).
2. Stores the live feed's fires from its first day (1 July 2026 on the first run) to today,
   screened, and works out `burning_mw` again for days already stored.
3. Stores wind and rain from that same day up to the first hour already stored, newest first.

The first run took 16 minutes. Each 30 day span that came back is a row in `source_fetches`, so a
run that is stopped can be started again and asks only for what is missing, plus the newest days,
which are still filling in. The map's History strip shows these days (section 4.1). The model does
not read the fires and wind before the first DOE reading yet: they are there for tuning it once
there are readings to score it against.

What the loop does each hour (`jobs/cycle.ts`): fetch readings (as many days back as needed to
join up with what is stored, up to 7), fetch fires on every third turn, fetch weather, run the
model on the newest reading, evaluate alerts. A step that fails is logged and the rest still run:
a forecast on an hour-old wind is worth more than none. Twenty past the hour is used because DOE
posts an hour's reading a few minutes into the next.

A run stores map frames from 24 hours before its own hour, so right after the first `haze:once`
the timeline reaches back one day. `haze:backfill` adds runs for earlier hours and the timeline
then covers the week. After that the hourly loop keeps it full.

The first `haze:once` on an empty database fetches 7 days of readings (16 states x 7 calls) and
takes a few minutes. A model run takes tens of seconds.

If the map says "No forecast has been made yet", the jobs have not run. If it shows old data,
check the jobs terminal (or `docker compose logs jobs`) for a failed source.

## 9. Tests

Backend: `cd backend && pnpm test` (needs `docker compose up -d postgres`; uses database `haze_test`).
Frontend: `cd frontend && pnpm test`.

| File | Covers |
| --- | --- |
| `test/haze/sources.test.ts` | Parsing real recorded DOE, FIRMS and Open-Meteo answers |
| `test/haze/model.test.ts` | Transport, calibration, chances, frames |
| `test/haze/alert-rules.test.ts` | Each alert rule, including not repeating |
| `test/haze/fire-confirm.test.ts` | The two-pass or 10 MW rule on recorded detections |
| `test/haze/fixed-sources.test.ts` | Reading the archive, and the fixed source screen on recorded rows of the Kerteh gas complex |
| `test/jobs/history.test.ts` | The history job into the database: sites, screened fires, picking up where it stopped, wind with no hole |
| `test/jobs/cycle.test.ts` | One whole cycle into the database, then every haze and alert endpoint |
| `test/agents/haze-tools.test.ts` | Every assistant tool over that cycle |
| `frontend/components/map/map.test.ts` | Frame decoding, colour scale, projection, Malaysian time |

Test data is real: `test/fixtures/recorded.ts` and `recorded-weather.ts` hold values fetched from
the sources on 10 October 2026 (5 stations, 36 hours, 24 fire cell-days, one weather row). The
one exception is `steady-wind.ts`, a uniform wind used as a physics test vector for the transport
maths; it is labelled as such and is not data. No test calls a real source or the proxy. Tests add
rows and never delete, so they can be run repeatedly.

## 10. Known limits and what to build next

Limits, in the order they matter:

1. Forecast skill ties with "no change". The model adds the picture (where smoke is, where it is
   heading) and the chances, not a more accurate number.
2. The live source clients were verified against real responses for shape, and their parsers are
   tested on recorded real answers, but the first full run from a developer machine is the first
   time all three are fetched from Node end to end. Watch the first `pnpm haze:once`.
3. Chances come from few past errors until the app has run for some weeks.
4. Fires under cloud are missed, and future fires are assumed to continue as they were. A fixed
   heat source that started up after June 2026 is not in NASA's labelled archive yet and still
   counts as a fire. Runs stored before 10 October 2026 16:30 UTC burned the unscreened fires.
5. Stations are sparse in Sabah, Sarawak and the east coast. Away from stations the map is the
   model with little correction.
6. Alerts only reach an open tab.
7. The "150 for three days" rule is shown as the chance of passing 150 on each day; the app does
   not yet count consecutive days.
8. No auth, no rate limiting. Loopback only.

Next, roughly in value order:

- Web Push, so alerts arrive with the tab closed (section 5.3).
- Count consecutive days above 150 and alert on the third.
- Store weather by fetch time so skill can be measured against the wind that was really forecast.
- Try to beat persistence: fit the gain per lead time, add fire growth, or blend with a simple
  statistical model. Judge only by the Track record table.
- Bahasa Malaysia for alerts and the assistant.
- An API key for the model and auth, before any public launch.

## 11. Glossary

| Term | Meaning |
| --- | --- |
| API | Air Pollutant Index, the number DOE Malaysia publishes hourly per station. A 24 hour index, not a concentration. |
| DOE | Department of Environment Malaysia. |
| FRP | Fire radiative power in megawatts: how strongly a detected fire burns. |
| VIIRS | The satellite instrument that detects the fires. |
| 925 / 850 hPa | Pressure levels about 750 m and 1500 m up, where smoke travels. |
| Run | One execution of the model. `as_of` is the newest reading it saw. |
| Lead | Hours between a run's `as_of` and the hour being forecast. |
| Persistence | The forecast "nothing changes": the reading at `as_of` carried forward. The baseline to beat. |
| Hindcast, backfill | Running the model for a past hour with only what was known then, to check it. |
| Outlook | A station's next days against the official lines. |
| Session | The id a browser makes for itself so it can follow stations without a login. |
