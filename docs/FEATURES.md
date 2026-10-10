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
| Alerts | For each followed area, what the government will do and when: an official order in force, a forecast that a school-closing line will be passed, or clearing. On screen and as a notification on the device, beside a list of the official statements. |
| Assistant | A chat panel that answers haze questions and gives recommendations (school, outdoor work, events, travel) from the same data, and names its sources. |

Two rules shaped every decision:

- Real data only. Nothing in the product is made up. Every number on a screen came from DOE,
  NASA, Open-Meteo or the model run on them.
- Honest about skill. The forecast was replayed at every stored hour, leak-free: about a fifth
  closer than assuming no change up to 12 hours ahead, level with it beyond a day. The app says so
  on the Simulation page and in every assistant answer that leans on the forecast.

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
| The fires of every day back to `HISTORY_FROM`, and NASA's label for hotspots that are not fires | NASA FIRMS area API (needs `FIRMS_MAP_KEY`) | `https://firms.modaps.eosdis.nasa.gov/api/area/csv/<key>/<product>/<area>/<days>/<date>` | `pnpm haze:history` | `sources/firms-archive.ts` |
| Wind and rain back to `HISTORY_FROM` | Open-Meteo historical forecast API | `https://historical-forecast-api.open-meteo.com/v1/forecast` | `pnpm haze:history` | `sources/weather.ts` |
| Airport weather reports back to `HISTORY_FROM`, the same 29 airports | Iowa State University's METAR archive (IEM) | `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=...&data=metar` | `pnpm haze:history` | `sources/metar-archive.ts` |
| Hourly PM2.5 of the region's other fixed sensors: an embassy reference monitor, Thai government stations near the border, low-cost AirGradient and Clarity sensors | OpenAQ v3 (needs `OPENAQ_API_KEY`) | `https://api.openaq.org/v3/locations?bbox=...` and `/v3/sensors/<id>/hours` | Every hour, and the past with `pnpm haze:history` | `sources/openaq.ts` |
| Singapore's 24-hour PSI and one-hour PM2.5 for five regions, stored as five more stations | NEA Singapore, via data.gov.sg | `https://api.data.gov.sg/v1/environment/pm25` and `/psi` | Every hour | `sources/nea.ts` |
| Airport weather reports (visibility, haze or smoke) for 29 airports | NOAA Aviation Weather Center | `https://aviationweather.gov/api/data/metar?ids=...&format=json` | Every hour | `sources/metar.ts` |
| Place names | Open-Meteo geocoder | `https://geocoding-api.open-meteo.com/v1/search` | On search | `sources/geocoder.ts` |
| Official statements | Education Ministry press page, DOE posts, Google News search | See section 5.2 | Every hour | `sources/moe-statements.ts`, `doe-statements.ts`, `news-statements.ts` |
| Coastlines, borders, towns | Natural Earth (public domain) | Packed once into `frontend/public/basemap.json` | Static | `frontend/components/map/basemap.ts` |
| Buildings, parks, water, roads of central KL | OpenStreetMap (ODbL), via the Overpass API | Packed once by `frontend/scripts/bake-city.mjs` into `frontend/public/city/kl.json` | Static, re-bake by hand | `frontend/components/city/city-data.ts` |

Two sources need a free key: the FIRMS archive (`FIRMS_MAP_KEY`, read only by `pnpm haze:history`)
and OpenAQ (`OPENAQ_API_KEY`). Without a key that source is skipped and the log says so.

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
- Open-Meteo is asked one grid row at a time (15 requests of 25 points), 1.5 s apart. Its last
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
  does, from about mid-2021, so that is the one used for past wind and the reason the history
  cannot usefully start earlier. It now and then answers 200 with a sentence where the JSON should
  be; the client asks again.
- The FIRMS standard product is also the only record of the fires before the live feed's first
  day (1 July 2026 when this was written). It has the same columns, so `parseFirmsCsv` reads both.
  For each satellite and day the history takes the live feed where it reaches and the standard
  product before (`feedsFor` in `jobs/history-fires.ts`): Suomi NPP and NOAA-20 from the standard
  product, NOAA-21 from its live feed, which goes back to January 2024.
- The METAR archive serves every listed airport in one request, as CSV with the raw report, so
  the same `visibilityOf` parser reads the past and the present. It names no airport: one the
  live feed has not described yet is stored under its code. The end day of a request is left out.
- OpenAQ has no DOE station. In Malaysia it holds one reference monitor (the US embassy in Kuala
  Lumpur, November 2022 to October 2024, before the history's first day) and low-cost sensors,
  most around Kuala Lumpur. Against the nearest DOE station over the week of 3 to 10 October 2026
  the sensors within 10 km ranked the same hours high and low (0.90 to 0.99) but several read tens
  of ug/m3 high, so a sensor needs its own correction before its level is trusted. OpenAQ's copy
  of Singapore's regions stopped in January 2025 and is left out; NEA is read directly.
- OpenAQ answers 500 for a few sensors every time. When this was written they were the second
  PM2.5 channel OpenAQ lists for each Thai station, whose first channel answers normally. The job
  logs the sensor, counts it in `sensorsFailed` and goes on to the rest.

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

Every developer runs their own Postgres, and some things in it cannot simply be fetched again:
DOE serves one week of readings, the fire archive and OpenAQ need a key, and the fixed sources take
a two year replay. So they are kept in the repository, in `backend/db/seed/` (six gzipped
tab-separated files, about 3 MB together): `stations` (with the network each belongs to),
`readings`, `fixed_source_days`, `fire_cells` from 1 January 2025, `openaq_sensors` and
`openaq_hours`. A teammate with no key therefore starts with the fires and the sensors' PM2.5 of
the whole history, and `pnpm haze:history` fetches the three kinds that need none: airport
reports, Singapore's hours and the wind.

- `node db/seed.mjs` (`pnpm db:seed`) loads them. The compose `migrate` service runs it after the
  migrations. It only adds rows, records each file's hash in `seed_files`, and loads a file again
  only when a newer one is committed.
- `pnpm db:export-seed` writes them from the local database. Run it on the machine that has been
  fetching longest and commit the result, at least once a week: a teammate who starts more than 7
  days after the last export has a gap in the readings that DOE can no longer fill.
- Wind is not in the seed (too large). The jobs service fetches it for the whole history by
  itself, with no key, from its first start (section 8 says how long that takes and why).

### 3.2 The region and the two grids

Defined in `haze/grid.ts`. Longitude 96 to 120 east, latitude 6 south to 8 north. That holds the
fires that reach Malaysia and the sea the smoke crosses, and all of Malaysia including eastern
Sabah. Singapore, southern Thailand and Brunei fall inside it.

| Grid | Size | Used for |
| --- | --- | --- |
| Weather | 25 by 15 points, 1 degree | Wind and rain |
| Field | 96 by 56 cells, 0.25 degree (about 28 km) | Smoke and the API shown on the map |

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
| `alert_events` | One alert | `open` stays true while its condition holds. A unique index allows only one open alert per station, kind and line; an `order` alert's line is the statement id. |
| `airports`, `metar_obs` | An airport; one of its weather reports | Migration `005_context_sources.sql`. Insert only. Visibility in metres, 10000 for ten kilometres or more; the present weather codes; the raw report. |
| `nea_hours` | One Singapore region for one hour | The one-hour PM2.5 and the 24-hour PSI and PM2.5. A null filled in by a later fetch is the only update. The PSI of an hour the cycle fetched is also a row in `readings`; the PSI of the history is not, because `readings` is what the forecast is run and scored from. |
| `openaq_sensors`, `openaq_hours` | A PM2.5 sensor OpenAQ gathers; its mean over one hour | Migration `007_openaq.sql`. Insert only. `reference` is OpenAQ's word for a regulatory-grade monitor; the rest are low-cost sensors. An hour is stamped with its end, like `readings`. Hours over 2,000 ug/m3 are stored and left out of what is read (`PM25_CEILING`). |
| `cams_hours` | Empty | Made by migration `005` for a composition forecast that was then dropped from the product. Nothing writes it. |
| `statements` | One fetched item about the haze, as the model read it | Migration `006_statements.sql`. Insert only, one row per URL, never read twice. Only rows with `is_statement` and `verified` are shown. |
| `weather_forecasts` | A forecast hour of one fetch, by fetch time | Append-only: the leak-free record of what the wind forecast said. |
| `smoke_hindcasts` | The transport model's smoke near an instrument as of an issue time | Written by `pnpm haze:hindcast`. |
| `model_forecasts` | The learned model's band for an instrument-day | Append-only, one issue a day at 00:00 UTC, scored on the Simulation page. The shadow rule: 14 days of DOE forecasts and a day-ahead error 10% below the hourly forecast's, computed over the DOE day-ahead cases both have. |

Note on `weather_hours`: this is the one table where a later fetch overwrites an earlier value. An
hour first arrives as a forecast and is later replaced by the weather model's analysis of what
happened, which is the better wind for hindcasts. The trade-off is that the wind a past forecast
actually used is not kept, so backfilled runs see better wind than a live run would have. If
forecast skill is ever to be measured strictly, store weather by fetch time instead (a new table
in a new migration).

### 3.4 The history as training data

From 1 January 2025 the database holds the two inputs of a smoke forecast and two independent
measurements of its result. `pnpm haze:coverage` prints what is stored of each, month by month, and
writes nothing. Check it before training on a span.

| Kind | Role | Table | Key and time | Where |
| --- | --- | --- | --- | --- |
| Fires | Input | `fire_cells` | `(day, lat10, lon10)`, a UTC day. Use `coalesce(burning_mw, frp_mw)`, as every read in `fires.repo.ts` does. | 0.1 degree cells over the region |
| Wind and rain | Input | `weather_hours` | `valid_at`, the hour. Arrays of 375 values, row-major from the south-west corner (`haze/grid.ts`). | 1 degree grid, 96 to 120 E, 6 S to 8 N |
| Airport visibility | Ground truth | `metar_obs` with `airports` | `(icao, observed_at)`, the report's own time, mostly every 30 or 60 minutes | 29 airports: 19 in Malaysia, Changi, Brunei, 8 in Sumatra and Kalimantan |
| PM2.5 | Ground truth | `openaq_hours` with `openaq_sensors`; `nea_hours`; `readings` with `stations` | `observed_at`, the end of the hour measured | OpenAQ's sensors, Singapore's 5 regions, DOE's 68 stations |
| Modelled smoke | Input (feature group 3) | `smoke_hindcasts` | `(as_of, instrument_id, model)`, the issue time 00:00 UTC. `smoke_now`, `smoke_24h`, `smoke_48h` are the ensemble-mean smoke within 50 km as a trailing day mean, uncalibrated, in the model's units. `model` names the method and the wind: `v2-analysis` is the stored analysis wind, the known leak. | Every instrument of `services/instruments.ts` |

What to know before fitting anything to it:

- **The two ground truths are not the same quantity.** Visibility says when and where haze
  arrived and roughly how thick; it stops at "ten kilometres or more" (10000), so it cannot tell
  one clean day from another, and rain and mist shorten it too. Drop reports whose `weather` has
  rain, showers, thunder, drizzle, mist or fog (`RA`, `SH`, `TS`, `DZ`, `BR`, `FG`) before reading
  it as smoke. PM2.5 is the quantity the app forecasts. Score a model against each separately.
- **Visibility tracks PM2.5 where there is haze.** Over 3 to 10 October 2026, the 24 hour mean of
  3.912 / visibility in km at 20 airports against the nearest DOE station's 24 hour PM2.5 (all
  within 22 km) had a rank correlation of 0.84 over 3,413 station-hours: 0.7 to 0.94 at the hazy
  west-coast airports and none at the clean ones, where the report sat at the ten kilometre cap.
  That is one week, about seven independent days an airport.
- **Measured PM2.5 is thin in Malaysia before October 2026.** DOE's readings start on 3 October
  2026 and are a 24 hour index, turned back into concentration by `apiToPm25`. Before that the
  country has only OpenAQ's low-cost sensors, most around Kuala Lumpur, plus one each in Perlis
  and Sabah. Singapore's five regions are reference-grade and complete for the whole span.
- **A low-cost sensor needs its own correction.** It ranks hours as a reference monitor does but
  can read tens of ug/m3 high. Fit each against the nearest DOE station on the hours they share.
- **The wind is what the weather model analysed, not what it forecast.** A model trained on it
  will look better in hindsight than it would live (see the note on `weather_hours` above).
- **Fires before July 2026 come from two feeds.** Suomi NPP and NOAA-20 are the standard product
  and NOAA-21 its live feed, screened by the same rules and the same list of fixed sources. A
  cell-day is the largest satellite's sum either way.
- **Nothing here is interpolated or filled.** A day with no row had no data from that source.
- **The smoke hindcast is uncalibrated and on the analysis wind.** It is the physics' own view of where smoke was and would be, in its own units; the learned model fits the gain. A hindcast on the forecast wind needs `weather_forecasts` to have filled first, and will carry a different `model` name.

### 3.5 The learned forecast

A LightGBM model trained on the history of 3.4 predicts each instrument's peak 24 hour PM2.5 for
the next two days. Its method, tests and results are in `docs/MODEL.md`; its code is `model/`;
it reaches the app through `backend/src/sources/model.ts` and the `model_forecasts` table, and
shows nothing to a person until the shadow rule in `docs/MODEL.md` is met.

`pnpm haze:dataset [folder]` (`jobs/dataset.ts`) writes the history as five gzipped CSV tables,
into `backend/dataset/` unless a folder is named, for training outside this codebase. It reads
only; the folder is not committed. From 1 January 2025 to 10 October 2026 it took 15 seconds and
wrote 2 MB:

| File | One row is | Columns | Rows on 10 October 2026 |
| --- | --- | --- | --- |
| `instruments.csv.gz` | An instrument: a DOE station, a Singapore region, an OpenAQ sensor or an airport | `instrument_id, kind, name, provider, reference, averaging, lat, lon` | 181 |
| `pm25_daily.csv.gz` | Ground truth: an instrument's PM2.5 over one UTC day | `instrument_id, day, pm25_mean, pm25_max, hours` | 21,099 |
| `visibility_daily.csv.gz` | Ground truth: an airport's reports over one UTC day | `instrument_id, day, reports, dry_reports, min_m, median_m, haze_reports` | 18,712 |
| `fires_daily.csv.gz` | Input: fire power in one 0.1 degree cell on one UTC day, at the cell's centre | `day, lat, lon, frp_mw` | 106,887 |
| `wind_daily.csv.gz` | Input: the transport wind and rain at each instrument over one UTC day | `instrument_id, day, u_ms, v_ms, rain_mm, hours` | 117,288 |

`instrument_id` joins the tables: `doe:CA01R`, `nea:east`, `openaq:11760952`, `airport:WMKK`. The
visibility columns are over dry reports only (no rain, showers, thunder, drizzle, mist or fog), and
`haze_reports` counts the reports in which the observer called it haze or smoke. The wind is the
same bilinear blend of the grid the transport model moves its particles by (`haze/wind-at.ts`).

That the tables train was checked once, on 11 October 2026, with a deliberately plain fit: a
linear model of the next day's value from today's value, the fire power the day's wind carries
toward the instrument, the wind speed and the rain, trained on the days before 1 July 2026 and
tested on the days from it.

| Target | Training rows | Test rows | Upwind fire against next day, rank correlation | MAE, the fit | MAE, no change |
| --- | --- | --- | --- | --- | --- |
| Mean PM2.5, 151 instruments | 16,657 | 4,056 | 0.65 | 10.3 ug/m3 | 9.3 ug/m3 |
| Airport extinction (3.912 / median dry visibility in km), 29 airports | 15,222 | 2,881 | 0.42 | 0.1 | 0.1 |

So the four kinds join into a frame of tens of thousands of rows and the fire and wind carry real
signal out of sample, and a plain linear fit does not beat "no change": on hazy days (35 ug/m3 or
more, 1,525 test rows) it was off by 19.9 ug/m3 against 15.8. Beating it is the work of the
learned model designed in `docs/specs/2026-10-10-predictive-model-design.md`, not of this check.

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

Looking back. Between the map and the timeline is the History strip: one column per UTC day from
the first day of the history (1 January 2025) to today, with four marks, one for each kind of data
a forecast is trained and checked on:

| Row | Mark | Read from |
| --- | --- | --- |
| Fires | A bar, its height the day's fire power (square root) | `fire_cells` |
| Wind | Dark where all 24 hours are stored, pale where some are, empty where none | `weather_hours` |
| Visibility | Darker the larger the share of reporting airports whose observer called it haze or smoke | `metar_obs` |
| PM2.5 | The band of the median of every instrument's mean that day, in the index's colours | `readings`, `nea_hours`, `openaq_hours` |

The strip is a calendar: a day with nothing stored is an empty column, so a gap in any of the four
shows as a gap. It scrolls, five pixels a day, and opens on the newest days. Month names run along
the top. Pressing a column puts that day on the map:

- its fires and its wind, as on the live map;
- the airports that reported, on the Visibility layer, following the timeline through the day;
- every instrument that measured PM2.5, as a dot in the colour of the index its value would give:
  DOE stations (the 24 hour mean behind the reading), Singapore's regions and OpenAQ's sensors.
  A reference monitor is a full dot, a low-cost sensor a smaller one, an instrument silent in that
  hour an empty ring. The Stations toggle hides them. Pressing a dot opens its panel: the value in
  the hour the timeline is on, the day's 24 hours as bars, and what kind of instrument it is;
- the haze field, where one exists. Days before the first DOE reading (3 October 2026) have none,
  and the timeline says "Past day, as measured".

One timeline reaches all of it. While looking back the timeline spans a week of the past with the
chosen day in the middle, and the day on the map is the one the timeline's moment falls in, so
dragging through the week walks through its days and every layer follows. Letting the slider go at
an end of the week moves the week on, and playing runs from one week into the next and stops at
the newest reading. Letting it go at the left end of the live timeline goes into the past the same
way, and at the newest reading of a past week it goes back to live. The strip marks the day the
timeline is in and scrolls to keep it in view; a mouse held down and drawn along the strip runs
through the days, keeping the hour. The days either side of the one shown are fetched ahead, and
the last day stays on the map until the next has loaded. Live goes back to now.

On the live map the fires follow the timeline too: `/haze/map` gives each fire cell its UTC day,
and a moment shows the cells seen that day and the two before, each at its strongest. A forecast
hour shows the fires the run knew of.

Files: `history-strip.tsx`, `history-days.ts` (how a day is read, pure), `use-time-travel.ts` (the
moment, live or looking back), `time-window.ts` (the week, pure), `fires.ts` (the fires at a
moment, pure), `monitors.ts`, `monitor-panel.tsx`, `pick.ts`, `use-haze-day.ts`, `unpackDay` and
`pm25At` in `map-data.ts`; backend `services/history.ts` and `services/day-air.ts`.

Page `/sources` lists every outside source: what it gives, the endpoint, how often it is asked, and
its newest good and failed fetch with what came back (stations, readings added, detections, weather
hours). A source is marked late when two of its cycles pass without a good fetch. Below is the log
of the newest fetches. Every fetch is a row in `source_fetches`, written by `jobs/record-fetch.ts`.

Page `/simulation` explains the simulation in numbered chapters with a table of contents: the
answer, how one run works, what DOE's index is, the backtest, replayed haze arrivals, the checks
on each part, the limits with the live runs' own scores, and the official lines and sources. Every
figure comes from `GET /haze/simulation`, worked out from the database on each visit
(`services/simulation.ts`, `haze/backtest.ts`). `/accuracy`, the old Track record, redirects there.
The method and every test behind it are in `docs/FORECAST.md`.

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
5. Calibration (`calibrate.ts`). DOE's API is the PM2.5 sub-index of the 24 hour mean
   (`api-index.ts`, DOE's January 2025 table), so each reading is turned back into PM2.5 and
   `PM2.5 = intercept + slope x smoke` is fitted over the last 120 hours before `asOf` (skipping
   the first 72 hours of the run, when smoke released earlier is missing). With fewer than 300
   pairs or a slope that is not positive, `FIRST_FIT` stands in. The rank correlation is stored.
6. Station forecast (`station-forecast.ts`). `PM2.5(h) = PM2.5(now) + slope x (0.9 + ... +
   0.9^h)`, the slope being the last 3 hours' change of the 24 hour mean: today's air against the
   same hours yesterday, carried on and fading. The smoke model's change is not added: replayed
   with the wind as forecast at the time it made forecasts beyond a day worse. A station silent for
   more than 6 hours gets no forecast. See `docs/FORECAST.md` section 4.
7. Map frames (`field.ts`). A frame every 3 hours from 24 hours before `asOf` to 84 hours after,
   plus one exactly at `asOf`, in PM2.5 and converted to API cell by cell. Each frame is the
   modelled field plus every station's error, spread to nearby cells and fading to nothing at 200
   km. The frame at `asOf` uses the same anchor reading as each station's forecast, and forecast
   frames start from it, adding the stations' slope near them and the model's change far from
   them. So the map agrees with the dots, and Now runs into the forecast without a jump.
   Runs record `model` (`v2`); only the current method's runs are drawn or scored.

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
With `MODEL_MODE=live` the day peaks and bands for days +1 to +3 come from the learned model while its newest issue is under 30 hours old; the hourly curve stays v2.

Until the database holds 300 checked forecasts for a bucket, the percentiles of the v2 forecast
replayed on every hour of 3 to 10 October 2026 (hard-coded in `chance.ts`) are used. After that the app's own are used
automatically (`services/outlook.ts`, `loadErrors`).

Known simplification: the day's peak is treated like a single forecast value, which understates
the chance a little.

### 4.4 Thresholds

`haze/guidelines.ts` is the only place they are written. The map, the alerts, the Simulation
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
the fires and readings known at its hour, and stores them as `backfill` runs, so the live scores
start on day one. `pnpm haze:evaluate` replays the week without storing anything and prints the
table. The Simulation page replays the station forecast at every stored hour on each visit.

Leak-free, readings only, every hour of 3 to 10 October 2026 (85,000 forecasts):

| Lead | No change | v2 | Change |
| --- | --- | --- | --- |
| 1 h | 1.08 | 0.82 | -24% |
| 6 h | 5.61 | 4.20 | -25% |
| 12 h | 10.23 | 8.56 | -16% |
| 24 h | 16.84 | 16.57 | -2% |
| 72 h | 37.02 | 35.55 | -4% |

The first test's figures (v1, a tie at 24 to 72 hours) were made with analysed wind and settings
chosen on the same week; `docs/FORECAST.md` section 5 measures that leak and supersedes them.

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

### 4.7 Kuala Lumpur in 3D

`/city`, "KL in 3D" in the island. A three.js model of central Kuala Lumpur, about 4.9 by 3.9 km
around the Petronas Twin Towers, seen through the haze of any hour in the stored week or the
forecast. The timeline is the map's. Three places to stand: the skyline, which circles the towers
slowly until touched; street level in Bukit Bintang; and Menara KL's deck at 300 m. "Light it at
midday" keeps the sun at 13:00 local so a night hour's haze can still be seen.

The city. `bake-city.mjs` fetches OSM once and packs footprints as decimetres on a flat plane
around the towers. Where OSM models a building as `building:part`s (the towers, Merdeka 118) the
parts are drawn instead of the outline. About 79% of buildings have no height in OSM and get a
guess by kind (houses 7 m, sheds 4 m, others 10 m); the page says so. Menara KL is only a point
in OSM, so its shape is drawn by hand from its published height. Tunnels are left out. Merdeka 118
tops out at 635 m, not 679 m, because OSM tags its spire that way. Run
`node frontend/scripts/bake-city.mjs` to re-bake; it makes one Overpass request.

The air. `GET /haze/cities/kl` (`services/city.ts`) takes the stations within 10 km (Cheras and
Batu Muda), blends them by inverse squared distance in PM2.5, not in index points, and for each
hour gives the API, the PM2.5, an estimated visibility and the smoke's optical depth. The pure
rules are in `haze/city-air.ts` and `haze/visibility.ts`:

1. API to PM2.5 with DOE's breakpoints (`haze/api-index.ts`).
2. Extinction = PM2.5 x 6.4 m2/g + 0.0132 per km. The 6.4 is aged smoke's dry scattering of
   4.2 m2/g (Reid et al. 2005) grown by humidity, f = (1 - RH)^-0.31 fitted to Indonesian smoke's
   f(80%) = 1.65 (Gras et al. 1999), at an assumed 70% RH, plus 0.3 m2/g absorption. The 0.0132 is
   clean air.
3. Visibility = 3.912 / extinction (Koschmieder, 2% contrast).
4. Optical depth = smoke extinction x 1.25 km of mixed layer (Chew et al. 2013).

This is an upper bound. In 2019, reported visibilities were two to five times shorter than it gives
at the same API, probably because the API is a 24 hour mean and humidity adds mist. The page says
so beside the number.

The scene (`frontend/components/city/`). The fog is exp(-extinction x distance), so a building at
the visibility distance keeps 2% of its contrast; three's own exponential fog squares the
distance, so `haze-fog.ts` swaps the formula. The sun's position is computed for the hour
(`sun.ts`). Its beam is dimmed per colour by Rayleigh and the smoke along its slant path, which
turns it orange (`haze-look.ts`; the smoke's wavelength exponent of 1 is assumed). What the beam
loses comes back as diffuse sky light, since peat smoke scatters 97% of what it stops. At night
the smoke glows with the city's light, more the thicker it is. Drifting sheets of smoke
(`haze-motes.ts`) follow the hour's optical depth; their motion is for the eye and is not the wind.

| File | Does |
| --- | --- |
| `city-view.tsx` | The page: the timeline moment, the view, the card. |
| `city-scene.ts` | Renderer, lights, sky, fog and the frame loop. The page calls `setLook` and `setView`. |
| `city-geometry.ts`, `mesh-builder.ts` | The baked city as two merged geometries: solids and surfaces. |
| `camera-rig.ts`, `city-views.ts` | Orbit and look-around, and the three places to stand. |
| `haze-look.ts`, `sun.ts`, `air-at.ts` | Pure: what an hour looks like, where the sun is, the air between hours. Tested in `city.test.ts`. |
| `haze-fog.ts`, `haze-motes.ts` | The fog formula, the sky dome, the drifting smoke. |

Colours are `--city-*` tokens in `globals.css`, read by `city-theme.ts`.

## 5. Feature 2: alerts

Alerts say what the government will do in a followed area, and when. The forecast is the
headline; official statements are fetched, read and listed so the app keeps track of what was
said.

### 5.1 What the person sees

- On the first visit the map asks "See haze where you are". "Use my location" brings up the
  browser's prompt, flies the map there and opens that spot's forecast; the answer stays in the
  browser (`components/map/my-location.ts`) and the map opens there on later visits. The alerts
  page then offers to follow the nearest station.
- `/alerts` has two sections:
  1. **My areas.** A search to follow an area (its nearest DOE station), then one card per area:
     the reading now; a headline that is always tomorrow's forecast against the closing lines,
     also on a calm day ("No action expected tomorrow"); one sentence; four days of peaks coloured
     by band; and any official order in force there, linked to its source. An open alert gives
     the card a coloured left edge. "Notify this device" turns on Web Push.
  2. **Official statements.** In force (default) or all, five a page. Each row: date, issuer
     badge (KPM, JAS, NADMA, KKM, State, Ruler), a one-line English summary, a status pill (In
     force, Coming, Replaced, Ended), the areas, the outlets that reported it with a link, and the
     original wording on demand.
- A new alert hangs under the island as one line on screens 900px and wider; below that the
  island's Alerts icon carries a dot. Closing it marks it seen, remembered in the browser.
- There is no login. The browser makes an id on first use (`components/alerts/session.ts`).

### 5.2 Official statements

Fetched by the jobs process every cycle (`jobs/statements.ts`), from three channels:

| Channel | Source | What is read |
| --- | --- | --- |
| `moe-statements` | Education Ministry press page, `moe.gov.my/kenyataan-media` | Haze titles; the statement PDF's text (`unpdf`) |
| `doe-statements` | DOE WordPress API, posts of 30 days matching "jerebu" | The post text |
| `news-statements` | Google News RSS, "jerebu" (ms) and "haze Malaysia" (en), 7 days | The headline only, and only one that announces something (`haze/statement-text.ts`) |

- An item is read once, by URL, newest first, at most 20 per channel per cycle. Prompt
  `agents/prompts/statement/v5.md` turns it into one flat object: issuer, kind (`rule`, `order`,
  `lift`, `advice`), action, states (the 16 station state names), districts, the line and days
  for a rule, start and end dates, an English summary and a verbatim quote. Every call is a row in
  `llm_calls`.
- The quote must be found word for word in the fetched text (case, spacing, punctuation and a
  PDF's page numbers set aside). A statement whose quote is not found is stored and never shown.
- A district's own state is dropped from `states` (`services/statements.ts`, `tidyAreas`).
- An order or lift that names no area is not shown and covers nothing, and an order is nationwide
  only from a ministry or DOE original: foreign headlines call a closure in six states
  "nationwide" (`usable` in `haze/statements.ts`).
- `haze/statements.ts` decides what is in force, at read time:
  - Reports of one decision are one statement: a rule by its issuer, action and line; an order by
    its issuer, action and start day where the reports share a place, with every report's areas
    joined. Johor closing its schools the evening the ministry closed Selangor's stays a second
    decision; a later report naming places from both of two groups joins them. The ministry's own copy
    is the link when there is one.
  - A later rule of the same issuer, action and length replaces an earlier one (180 replaced 200).
  - An order ends on its stated last day, on a later lift or reopening for its areas, or a week
    after it began when nothing more is said (closures run "until further notice").
- An order covers a station (`haze/statement-areas.ts`) by its state, by a district of the
  station's name, or by a gazetteer district within 20 km. Of several orders covering a station,
  an emergency comes first, then a national body's, then the most reported.
- An order with no start date that a dated order of the same body and day covers is that
  decision told less fully, and is marked replaced.
- The thresholds alerts use stay hand-checked in `haze/guidelines.ts`. A fetched rule never
  changes who is alerted; when one differs, update the file by hand.

### 5.3 The rules

`haze/alert-rules.ts` and `haze/closing.ts`, pure and tested. After every model run the job
(`jobs/alerts.ts`) works out, for each station, the one alert worth raising, most impactful first:

| Kind | Label | Holds when | Example message |
| --- | --- | --- | --- |
| `order` | Official | An order in force or about to be covers the station and closes schools, stops outdoor activity, declares an emergency or sends people home to work. | "Ministry of Education: All education institutions in Negeri Sembilan close from 9 October." |
| `arriving` | Forecast | Tomorrow has a 60% chance of passing 180, or yesterday and today were above 150 and tomorrow has a 60% chance of being the third day (from 12 October 2026). | "Klang: schools may close tomorrow. 72% chance of API above 180, the Education Ministry's closing line." |
| `clearing` | Clearing | The reading is above 100 and a later day has at most a 40% chance of passing 100. | "Klang: likely below 100 tomorrow. Outdoor activities can resume then." |

- A reading above a line is not an alert (`observed` is kept only for old rows): the map and the
  card show it.
- One open alert per station. When a higher one holds, the lower one closes.
- An open forecast alert holds down to a 50% chance, so one hovering at 60% is said once.
- A day counts as above 150 when its peak hour is. The message says "may close".
- The card's headline (`haze/headline.ts`) reads the same numbers, so card and alert agree.

### 5.4 Delivery

- In the app: the island line, polled every minute.
- On the device: Web Push. "Notify this device" registers `public/sw.js`, subscribes with the
  server's VAPID public key (`GET /alerts/push-key`) and stores the subscription with every area
  the session follows (`PUT /alerts/push`). After each alert pass the jobs process sends each newly
  opened alert to the devices following that station (`sources/push.ts`, `web-push`). A
  subscription the push service says is gone is cleared. Without `VAPID_PUBLIC_KEY` and
  `VAPID_PRIVATE_KEY` alerts stay in the app.

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
| `get_statements` | `place` optional | Official statements with status, areas, quote and link; with a place, the orders covering it and the rules in force | Official statements |
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
`/api/...`, which forward; the Simulation and Sources pages read it from the Next server. Contracts
are zod schemas in `backend/src/contracts.haze.ts`, `contracts.alerts.ts`, `contracts.sources.ts`
and `contracts.statements.ts`, mirrored by hand in `frontend/lib/api/haze-schemas.ts`,
`alert-schemas.ts`, `source-schemas.ts` and `statement-schemas.ts`
(the `CityAir` part of `contracts.haze.ts` in `city-schemas.ts`).
Change both together.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/haze/map` | `HazeMap`: latest run, both grids, stations with newest reading, frames for 7 days back and 84 hours ahead, wind at each frame, each day's strongest 1500 fire cells, dated, from 9 days back |
| GET | `/haze/days` | `HazeDays`: every UTC day from the first with anything stored, and no earlier than `HISTORY_FROM`, to today, each with what it holds of the four kinds of data (burning cells and fire power, hours of wind, airports reporting and reporting haze, PM2.5 instruments and their median), and the first hour a haze field exists for |
| GET | `/haze/days/:day` | `HazeDay`: one past day for the map: strongest 1500 fire cells, wind every 3 hours, the airports' reports, every PM2.5 instrument's 24 hours, and the frames of that day (empty before the first readings) |
| GET | `/haze/stations/:id` | `StationOutlook`: station, a week of readings, 84 hours of forecast, the day outlooks |
| GET | `/haze/accuracy` | `Accuracy`: error by lead for model and persistence, current method's runs |
| GET | `/haze/simulation` | `Simulation`: newest run's inputs, readings histogram, the readings-only backtest by lead and by day, replayed haze arrivals, and `model`, the learned model's DOE record beside no change and the hourly forecast with the shadow rule's state |
| GET | `/haze/guidelines` | `GuidelineList` |
| GET | `/haze/places?q=` | `PlaceList`: stations by name first, then geocoded places, each with its nearest station |
| GET | `/haze/cities/:key` | `CityAir`: a city (only `kl`) blended from its stations, hour by hour with API, PM2.5, estimated visibility and optical depth; 404 for an unknown city |
| GET | `/sources` | `SourceReport`: each source from `sources/catalog.ts` with its newest good and failed fetch and the last 24 hours' tally, and the 60 newest fetches |
| GET | `/alerts?session=&after=` | `AlertFeed`: newest first; with a session only followed stations |
| GET | `/alerts/areas?session=` | `AreaList`: one card per followed station with headline, day outlooks, open alert and orders in force |
| GET | `/alerts/push-key` | `PushKey`: the VAPID public key, or null when push is off |
| PUT | `/alerts/push` | Body `{ sessionId, push }`, a browser push subscription or null. 204 |
| GET | `/statements?status=current\|all&page=` | `StatementPage`: statements once each with status, five a page |
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

The `jobs` service runs `loop`: one cycle now, then the backfill, then a cycle at 20 past every
hour. Backfill skips hours already run, so restarting the container costs one cycle.

From source, with only the infrastructure in Docker:

```sh
# infra and api
docker compose up -d postgres llm-proxy
cd backend
pnpm install && pnpm db:migrate
pnpm dev                 # api on :8091

# data, in a second terminal
pnpm haze:once           # fetch everything, run the model once, raise alerts (a few minutes)
pnpm haze:backfill       # once, on day one: replay the stored week (fills the timeline's past and the live scores)
pnpm haze:loop           # then keep running: once now, the backfill, then at 20 past every hour

# frontend, in a third terminal
cd ../frontend && pnpm install && pnpm dev    # http://localhost:3000
```

`pnpm haze:history` (`jobs/history.ts`) runs in the compose jobs service on every start, after the
first cycle. It fills the four kinds of data back to `HISTORY_FROM` (default `2025-01-01`), each
part in its own file and each able to run alone (`pnpm haze:history wind`, or several names):

| Part | Does | File | Needs |
| --- | --- | --- | --- |
| `fires` | Stores two years of labelled fixed sources, then every day's fires from the first day to today, screened, and works out `burning_mw` again for days already stored | `jobs/history-fires.ts` | `FIRMS_MAP_KEY`. Without it the fires of the past are what the seed loaded. |
| `visibility` | Stores the 29 airports' reports, ten days a request | `jobs/history-observations.ts` | |
| `air` | Stores Singapore's hours a day at a time, then every OpenAQ sensor's hours | `jobs/history-observations.ts`, `jobs/ingest-openaq.ts` | `OPENAQ_API_KEY` for OpenAQ |
| `wind` | Stores wind and rain from the first day up to the first hour already stored, newest first | `jobs/history-weather.ts` | |

How each picks up where it stopped:

- Fires, visibility and Singapore record every 30 day span that came back as a row in
  `source_fetches`. A later run asks only for spans with no such row, plus the newest, which is
  still filling in. The fire rows also name the screen and the region, so a changed rule, a new
  list of fixed sources or a wider region is fetched again.
- Wind goes backward from the oldest stored hour, so the stored hours are always one unbroken run.
- OpenAQ works from both ends of what is stored for each sensor. The hourly cycle asks forward
  from the sensor's newest hour (the last three days for a sensor with nothing stored); the
  history asks backward from its oldest hour to the first day. A sensor whose history reached the
  first day is recorded as done in `source_fetches`, so the months it measured nothing in are not
  asked for again.

A part that fails is logged and the others still run; the command then exits non-zero and names
what to run again. Every request waits and retries through a dropped connection (six tries over
about five minutes) and through a "too many requests" (65 seconds), in `fetchPatiently`
(`sources/http.ts`).

A first run from 1 January 2025 is about 2,700 requests: some 400 for the fires and 290 for the
fixed sources, 65 for the airports, 1,300 for Singapore, a few hundred for OpenAQ and 700 for the
wind. Fires, visibility and PM2.5 take about an hour together. The wind takes about five: Open-Meteo
counts two weeks of one 25 point row as 25 calls and allows one address 5,000 an hour, so the
history spaces its requests to use about 3,750 and leave the rest to the hourly fetch, and waits
out the limit if it is reached anyway. There is also a limit of 10,000 a day, which the whole wind
history (about 17,600) cannot fit under: on the day it is reached the wind part stops with
"Daily API request limit exceeded" and the rest is fetched the next day. Nobody has to remember
to: while `pnpm haze:loop` runs, it asks for the whole history again every 24 hours, which costs a
minute when nothing is missing. The live wind is a different service with its own count and is not
affected. A run that is stopped can be started again. The model does not read the data before the first DOE reading yet: it is there to train and
check a forecast against, which section 3.4 describes.

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
| `test/jobs/history.test.ts` | The fire and wind history into the database: sites, screened fires, the standard product before the live feed, picking up where it stopped, wind with no hole |
| `test/jobs/dataset.test.ts`, `test/jobs/coverage.test.ts` | The wind at one place; the five training tables read back from disk; the coverage table |
| `test/jobs/history-observations.test.ts` | Reading the METAR archive and OpenAQ; the airport, Singapore and OpenAQ history into the database; a past day served with all four kinds of data |
| `frontend/components/map/history.test.ts` | How the History strip reads a day, PM2.5 as an index, an instrument's hour |
| `frontend/components/map/time.test.ts` | The fires at a moment of the timeline; the week the timeline spans while looking back |
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

1. The forecast beats "no change" up to about 12 hours and ties with it beyond a day. The smoke
   model adds the picture (where smoke is, where it is heading), not a better number past a day.
2. The live source clients were verified against real responses for shape, and their parsers are
   tested on recorded real answers, but the first full run from a developer machine is the first
   time all three are fetched from Node end to end. Watch the first `pnpm haze:once`.
3. Chances come from few past errors until the app has run for some weeks.
4. Fires under cloud are missed, and future fires are assumed to continue as they were. A fixed
   heat source that started up after June 2026 is not in NASA's labelled archive yet and still
   counts as a fire. Runs stored before 10 October 2026 16:30 UTC burned the unscreened fires.
5. Stations are sparse in Sabah, Sarawak and the east coast. Away from stations the map is the
   model with little correction.
6. Statements from news headlines carry only the headline, and orders that are never lifted in
   the news are assumed over a week after they began.
7. The "150 for three days" rule counts a day by its peak hour; the ministry may count it
   differently.
8. No auth, no rate limiting. Loopback only.
9. The 3D visibility is an optics estimate at a fixed 70% humidity, and has run long against
   reported haze visibility. Humidity from Open-Meteo and a METAR visibility source would fix both.

Next, roughly in value order:

- Read NADMA, the Health Ministry and state government channels directly once they can be
  fetched (the Health Ministry site refuses scripted requests today).
- Stored by fetch time in `weather_forecasts` since migration 008; the backtest still reads the analysis until the hindcast job and the model package read it (plans C and D).
- Beat persistence beyond a day: store weather by fetch time, test a faster ensemble wind (the
  stored wind runs 20% slow against radiosondes), slower decay of assumed fires. Judge only by
  `pnpm haze:evaluate` and the Simulation page. See `docs/FORECAST.md` section 9.
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
