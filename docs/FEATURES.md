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
| Haze map | The official readings now, the past week, and a forecast 3.5 days ahead, on a map of Sumatra, the peninsula and Borneo, with the fires and the wind that explain it. |
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
| Place names | Open-Meteo geocoder | `https://geocoding-api.open-meteo.com/v1/search` | On search | `sources/geocoder.ts` |
| Official statements | Education Ministry press page, DOE posts, Google News search | See section 5.2 | Every hour | `sources/moe-statements.ts`, `doe-statements.ts`, `news-statements.ts` |
| Coastlines, borders, towns | Natural Earth (public domain) | Packed once into `frontend/public/basemap.json` | Static | `frontend/components/map/basemap.ts` |
| Buildings, parks, water, roads of central KL | OpenStreetMap (ODbL), via the Overpass API | Packed once by `frontend/scripts/bake-city.mjs` into `frontend/public/city/kl.json` | Static, re-bake by hand | `frontend/components/city/city-data.ts` |

None of these needs a key.

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
| `fire_cells` | Fire power in one 0.1 degree cell on one UTC day | Upsert keeps the larger value. |
| `weather_hours` | Wind and rain over the whole weather grid for one hour | Upsert replaces an hour. See the note below. |
| `forecast_runs` | One run of the model | `as_of` is the newest reading it saw. `kind` is `live` or `backfill`. `fit` holds how well smoke matched readings. |
| `forecast_frames` | The API field at one time for one run | One byte a cell, API / 2. |
| `station_forecasts` | One station's hourly forecast for one run | 84 values, from `as_of` + 1 hour. |
| `alert_subscriptions` | A browser following a station | No login. `session_id` is made by the browser. |
| `source_fetches` | One fetch of a source by the jobs process | Migration `003_source_fetches.sql`. Insert only: when, how long, what came back or why it failed. The Sources page reads it. |
| `alert_events` | One alert | `open` stays true while its condition holds. A unique index allows only one open alert per station, kind and line; an `order` alert's line is the statement id. |
| `statements` | One fetched item about the haze, as the model read it | Migration `006_statements.sql`. Insert only, one row per URL, never read twice. Only rows with `is_statement` and `verified` are shown. |

Note on `weather_hours`: this is the one table where a later fetch overwrites an earlier value. An
hour first arrives as a forecast and is later replaced by the weather model's analysis of what
happened, which is the better wind for hindcasts. The trade-off is that the wind a past forecast
actually used is not kept, so backfilled runs see better wind than a live run would have. If
forecast skill is ever to be measured strictly, store weather by fetch time instead (a new table
in a new migration).

## 4. Feature 1: the haze map and forecast

### 4.1 What the person sees

Page `/map` (also the home page).

- A map with four layers that can each be switched off: Haze (the coloured field), Stations (a
  dot per DOE station, coloured by its value), Fires (satellite detections of the last two days,
  sized by fire power), Wind (moving streaks that follow the wind carrying the smoke).
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

`pnpm haze:backfill` replays the model every 6 hours over the stored week, each run seeing only
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
  `agents/prompts/statement/v3.md` turns it into one flat object: issuer, kind (`rule`, `order`,
  `lift`, `advice`), action, states (the 16 station state names), districts, the line and days
  for a rule, start and end dates, an English summary and a verbatim quote. Every call is a row in
  `llm_calls`.
- The quote must be found word for word in the fetched text (case, spacing, punctuation and a
  PDF's page numbers set aside). A statement whose quote is not found is stored and never shown.
- A district's own state is dropped from `states` (`services/statements.ts`, `tidyAreas`).
- `haze/statements.ts` decides what is in force, at read time:
  - Reports of one decision are one statement: a rule by its issuer, action and line; an order by
    its issuer, action and start day, with every report's areas joined. The ministry's own copy
    is the link when there is one.
  - A later rule of the same issuer, action and length replaces an earlier one (180 replaced 200).
  - An order ends on its stated last day, on a later lift or reopening for its areas, or a week
    after it began when nothing more is said (closures run "until further notice").
- An order covers a station by its state, by a district of the station's name, or by a gazetteer
  district within 40 km.
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
| `get_air_quality` | `place` | Reading now and the last 24 hour range, with the station it came from | DOE |
| `get_forecast` | `place` | Each day's forecast peak, range and chance of passing 100, 150, 180, 200; a value every 6 hours | Haze model |
| `get_statements` | `place` optional | Official statements with status, areas, quote and link; with a place, the orders covering it and the rules in force | Official statements |
| `get_guidelines` | none | The official lines, and that there is none for events or flights | Ministry guidance |
| `get_track_record` | none | Measured error at 24, 48, 72 hours beside "no change" | Haze model |
| `get_fires` | `place` optional | Burning cells and fire power by region for three days; distance and direction of the strongest from the place | NASA FIRMS |
| `get_wind` | `place` | Direction, speed and rain every 12 hours for three days | Open-Meteo |
| `create_alert` | `place` | Follows the nearest station for this browser | none |
| `get_time`, `load_skill` | | From the starter | none |

`place` can be a station id, a station name or any place name. `services/places.ts`
(`resolveStation`) tries the station names first, then the geocoder and the nearest station. If
the geocoder is down, station names still work. A tool that cannot find a place refuses, and the
model is told to say so rather than guess.

`create_alert` needs to know which browser asked. The frontend sends its session id with each
question (`sessionId` on `POST /chat/:id/messages`), and the route passes it to the tools.

### 6.4 The prompt and the skill

- `agents/prompts/chat/v2.md` is the system prompt. It sets the scope (haze and air quality in
  Malaysia), tells the model to refuse anything else in one sentence, forbids stating a fact that
  did not come from a tool, lists what the app has no data for (visibility, flights, PM2.5,
  hospitals), and fixes the answer format. `v1.md` is the starter's and is kept, because prompts
  are never edited: a change is `v3.md` and a bump of `CHAT_PROMPT` in `loop.ts`.
- `agents/chat/skills/haze-decision/SKILL.md` is the procedure for "should we" questions: what to
  gather, how to turn a chance into go ahead, go ahead with a fallback, or do not go ahead
  (under 30%, 30 to 60%, over 60%), and which line applies to which activity. For events it says
  there is no official line and that using 100 and 200 is its own reading of the school and
  workplace rules. For flights it says the decision is about visibility, which the app does not
  have.

### 6.5 What it should and should not do

| Question | Expected behaviour |
| --- | --- |
| "How is the air in Shah Alam?" | Reading from the nearest station, named, with the time. |
| "Will schools in Seremban close tomorrow?" | Forecast peak, chance of passing 180, the rule and its issuer, one sentence on trust. |
| "Should the Sepang event go ahead on Sunday?" | A recommendation with a fallback, says there is no official event line. |
| "Is it safe to fly from KLIA?" | Says it has no visibility data, gives reading and forecast, says to check the airline. |
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
| GET | `/haze/map` | `HazeMap`: latest run, both grids, stations with newest reading, frames for 7 days back and 84 hours ahead, wind at each frame, strongest 1500 fire cells of 2 days |
| GET | `/haze/stations/:id` | `StationOutlook`: station, a week of readings, 84 hours of forecast, the day outlooks |
| GET | `/haze/accuracy` | `Accuracy`: error by lead for model and persistence, current method's runs |
| GET | `/haze/simulation` | `Simulation`: newest run's inputs, readings histogram, the readings-only backtest by lead and by day, replayed haze arrivals |
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
4. Fires under cloud are missed, and future fires are assumed to continue as they were.
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
- Store weather by fetch time so skill can be measured against the wind that was really forecast.
- Beat persistence beyond a day: store weather by fetch time, test a faster ensemble wind (the
  stored wind runs 20% slow against radiosondes), slower decay of assumed fires. Judge only by
  `pnpm haze:evaluate` and the Simulation page. See `docs/FORECAST.md` section 9.
- A visibility source (airport METAR) so flight questions can be answered.
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
