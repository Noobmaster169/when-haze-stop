# Handover

Written 10 October 2026, at commit "Add the haze map, forecast, alerts and assistant tools" on
branch `haze-product`. This is the state of the work and what to do next. For what each feature
is and how it works, read `docs/FEATURES.md`. For the code rules, read `CLAUDE.md`.

## One forecast (11 October 2026, later)

The learned model is now the forecast a person sees past today, with the smoke simulation as its
hourly shape and its reason; the design is `docs/specs/2026-10-11-one-forecast-design.md`, the
plan `docs/specs/plans/2026-10-11-one-forecast.md`, the feature `docs/FEATURES.md` 4.1.1. Built
in four tracks on top of foundation commit ad3b58c: the outlook reshaped to the learned peaks
with a why line (A), the run's future frames corrected to the learned values at every instrument
(B), the map's jump chips, caption and panel labels (C), and the live record at `/haze/model` as
the first chapter of the Model page (D). Migration `009_learned_frames.sql`. The model service
answers `GET /report` from the committed `model/reports`, mounted read-only in compose.

Checked on the compose stack with `MODEL_MODE=live` after `docker compose up -d --build`:

| Check | Result |
| --- | --- |
| Backend `pnpm test`, frontend `pnpm test`, model `pytest` | 265, 115 and 138 pass; type-checks, lint and `pnpm build` clean |
| Jerantut panel, line against rows | Mon 12 Oct line peak 92 = row 92; Tue 13 Oct 103 = 103; today and Thu labelled hourly |
| Why line under a learned day | "Little simulated smoke reaches here", because the run on screen predates migration 009 and stored no `physics`; the next run stores it and the sentence can name the peak hour and wind |
| Map source, caption | learned, version 2026-10-11-c88cac5a, trial, backtest 15.48 against 17.53 |
| Map frames corrected (`learnedFrom`) | Confirmed at the next cycle: run 64 (23:00 UTC 10 Oct) carries `learned_version`, the map's `learnedFrom` is 2026-10-11T18:00Z (02:00 Monday Malaysian time). Measured at Jerantut for Monday 14:00: uncorrected run 26.8 ug/m3, corrected 51.1, target 44.3. The correction overshoots because the inverse-distance average at a station mixes in its many neighbours' deltas; the fix (solve for point corrections so the spread field hits every target exactly) is in hand, see the git log after b9806a3 |
| `/haze/model` | source learned, 0 days checked, next check 2026-10-11T16:00Z, six watched DOE stations, empty ledger |
| `/model` page | Renders the live record first, then the published figures |

So `MODEL_MODE=live` works end to end on the compose stack for the panel, the alerts, the
assistant, the Model page and, from run 64 on, the map's future frames. The chat was
not exercised against a real model call here; prompt `v5.md` and `haze-decision` version 5 are
what it reads.

Decisions to revisit: today's line stays the hourly forecast even when the issue's day +1 is
today (between midnight and 08:00 Malaysian time the freshest learned day is unused); and the
model is live on trial rather than back in shadow. Next phase: issue the learned model hourly
(training rows at several issue hours), so every day is learned and the frames follow every run.

Git history note: two `commit --amend` races between the parallel tracks rewrote one commit
each; the tree is right and nothing is lost, but `0a8b54a` carries a one-file test fix that
belongs to track A and `aa95bce` is track B's fix committed separately.

## Where things stand

All three features are written and committed: the haze map and forecast, alerts, and the
assistant's tools. Nothing has been pushed. `main` is untouched.

| Check | Result |
| --- | --- |
| Backend `pnpm type-check` | Clean |
| Backend `pnpm test` | 158 tests pass, 21 files |
| Frontend `pnpm lint`, `pnpm type-check` | Clean |
| Frontend `pnpm test` | 59 tests pass |
| Pages in a browser (dev server) | Map, station panel, search, timeline, alerts, simulation and chat all render and work |

## What has not been verified

The code was written in a sandbox that could not reach the data sources or a Claude login. These
four things have never been run and are the first jobs:

1. **Live fetch from Node.** `pnpm haze:once` has never run against the real DOE, NASA FIRMS and
   Open-Meteo. Each client's parser is tested on real recorded answers, and the request URLs were
   checked from a browser, but the end to end fetch is untested.
2. **The real model in chat.** The chat was driven by a scripted stand-in for the proxy. The tools
   are tested directly. Prompt `v2.md` and the `haze-decision` skill have never been read by
   Claude, so the quality of real answers is unknown.
3. **The full map.** Screens were checked with the 5 station test sample. 68 stations and a full
   week of frames have not been looked at.
4. **`pnpm build`.** Only the dev server was run.

## Do this first

```sh
cp .env.example .env            # at the root; put the token from `claude setup-token` in it
docker compose up -d --build    # the whole stack: the jobs service runs once, backfill, then hourly
docker compose logs -f jobs     # watch the first cycle

cd backend && pnpm install && pnpm test   # expect 63 passing, against the compose postgres
```

To run a step by hand from source instead, see "Host development" in the README.

What a good first cycle looks like, in order: `readings stored` (days 7, added in the
thousands), `fire cells stored`, `weather stored` (hours around 300), a forecast run, then
`alerts evaluated`. A failed step logs `a step of the cycle failed` with `what` naming the source,
and the rest still run.

If a source fails, start here:

| Source | File | Likely cause |
| --- | --- | --- |
| DOE | `backend/src/sources/doe.ts` | Empty body from calling too fast (spacing is 700 ms, raise it), or a certificate or header the site wants from Node that a browser sends by default |
| FIRMS | `backend/src/sources/firms.ts` | Three files of 8 to 9 MB; a timeout. Raise the timeout |
| Open-Meteo | `backend/src/sources/weather.ts` | Rate limit (15 requests, 1.5 s apart, raise the spacing), or a shape change, which fails with "a shape this client does not know" |

After the first cycle the jobs service backfills the stored week (the timeline's past and the track
record) and then runs hourly. A source fix is picked up with `docker compose up -d --build jobs`.

Open http://localhost:3000 and go through this list:

- The map shows 68 station dots and a haze field. The timeline reaches a week back after backfill.
- Play the timeline. The label turns blue past Now.
- Search "Shah Alam". The panel opens on the nearest station and says so.
- Press "Alert me here". `/alerts` lists the station.
- `/simulation` shows the backtest and, after backfill, the live runs' scores. `/accuracy` redirects there.
- Ask the five starter questions in the dock. Check each answer has numbers from tools, source
  chips, and a map link. Ask something off topic and check it refuses.

## Then, in order

1. Fix whatever the first live run breaks.
2. Read real assistant answers and tune. A prompt change is a new file `prompts/chat/v3.md` and a
   bump of `CHAT_PROMPT` in `agents/chat/loop.ts`. Never edit `v2.md`.
3. Look at the heat layer with real data. The field is painted solid at `ALPHA` in
   `frontend/components/map/heat.ts`; its colours are the `--api-*` tokens in `globals.css`.
4. Run `pnpm build` in `frontend/`.
5. Push `haze-product` and merge.

The learned forecast (11 October 2026, track D). The package is `model/`; its document is
`docs/MODEL.md`, whose section 6 holds the first results. Inside `model/`, with the compose
database's `PG_*` variables set:

```sh
.venv/bin/hazemodel features --from 2025-06-07 --to <yesterday> --hindcast-model v2-analysis
.venv/bin/hazemodel backtest data/features-<span>-<hash>.parquet --freq M --min-train-blocks 1 --ablation
.venv/bin/hazemodel train data/features-<span>-<hash>.parquet --with-backtest
.venv/bin/hazemodel promote <version>   # moves `live` only if not worse than the live score
```

Under compose, retraining runs on request, never from `up`, because it takes 15 to 40 minutes. From
the repository root:

```sh
docker compose --profile train run --rm --user "$(id -u):$(id -g)" model-train           # skips if a report is under a week old
docker compose --profile train run --rm --user "$(id -u):$(id -g)" model-train --force   # retrains anyway
```

The `model-artifacts` volume starts empty, so `/predict` has no live model under compose until a
model is in it. Copy the host's published version and its `live` file in once, before any retrain:

```sh
docker compose --profile train run --rm --no-deps -v "$PWD/model/artifacts:/seed:ro" \
  --entrypoint sh model-train -c 'cp -R /seed/. /app/artifacts/'
```

Without that step the first retrain becomes live unconditionally, because there is no live score to
compare against. Hyperparameters: c88cac5a was trained with the then-committed defaults (31 leaves,
learning rate 0.05, 100 rows per leaf, feature fraction 0.8, 600 rounds). `params.json` now holds
the searched values (28 leaves, learning rate 0.0298, 125 rows per leaf, feature fraction 0.604, 299
rounds), chosen with the all-day fallback criterion and never backtested; the draws table of that
search was not kept. The next retrain evaluates them under the promotion rule. Day +2: the rule
chose recursive (21.18 against 21.48, on the reference rows including DOE's week), but c88cac5a
serves direct because the choice was not wired when it was saved; later artifacts carry it.

The `model-train` compose job retrains on request, as above. The live version is
`2026-10-11-c88cac5a` (reference hazy-day MAE 15.48 at day +1), promoted into the local
`model/artifacts/`, which is not committed. It missed the 24 hour target (15% below persistence's
17.53) and its band is too narrow. The shadow rule stands: the model forecasts every cycle and
nothing shows it; `MODEL_MODE=live` only after 14 days with a 24 hour score at least 10% better
than v2 on DOE stations. Next, in order:

1. Run the smoke hindcast of the live issue day before any promotion to live. Every training row
   carries the physics group, so a live row without `smoke_hindcasts` for its day is a row the
   model has never seen.
2. After 14 days of shadow data, read the model block of the Simulation page before considering
   `MODEL_MODE=live`.

After that, the backlog is section 10 of `docs/FEATURES.md`: Web Push, counting three days above
150, storing weather by fetch time, trying to beat persistence.

Two sources were added after the first handover (10 October 2026, later the same day). Singapore's
five NEA regions are stations now (migration `006_station_network.sql` adds `network` to
`stations`; their PSI is a reading like DOE's API), so they are on the map, in the panel and in
the model's correction, with no alerts because the lines are Malaysian. Airport weather reports
from 29 airports are a fifth map layer, Visibility, and the `get_visibility` assistant tool.
Both are fetched in the hourly cycle and shown on the Sources page. A CAMS composition forecast
was tried the same day and dropped as a model rather than a measurement; its empty table
`cams_hours` from migration `005` remains. Prompt `v4.md` and version 3 of the `haze-decision`
skill describe the two sources.

The history was added last (10 October 2026, evening). `pnpm haze:history` now fills four kinds of
data back to 1 January 2025: fires (the standard FIRMS product before the live feed's first day),
wind, the 29 airports' weather reports from Iowa State's METAR archive, and measured PM2.5 from
Singapore's past days and from OpenAQ's sensors (migration `007_openaq.sql`, key `OPENAQ_API_KEY`).
OpenAQ is also fetched in the hourly cycle. The History strip under the map shows every day with
one mark for each of the four, and a past day draws its airports and its PM2.5 instruments, with a
panel for each instrument. `pnpm haze:coverage` prints what is stored by month, and
`pnpm haze:dataset` writes it as five CSV tables for training. The model does not
read any of it yet: `docs/FEATURES.md` section 3.4 says what the data is and what to know before
training on it. What that leaves to do:

1. Fit visibility to PM2.5 on the hours airports and DOE stations share, so the forecast can be
   scored against visibility for the months with no readings.
2. Correct each low-cost sensor against its nearest DOE station.
3. Extend `haze:backfill` and `haze:evaluate` to replay the model over 2025 and score it against
   those two, separately. The past PSI of Singapore was kept out of `readings` on purpose, because
   `backfill` starts at the oldest reading and would otherwise replay 650 days on five stations.
The seed was exported again with the history in it: the stations carry their network, the fires
go back to 1 January 2025, and OpenAQ's sensors and hours are two new files. Export it weekly as
before.
4. Export the seed again (`pnpm db:export-seed`) once the stations file carries `network`: today a
   Singapore region loaded from the seed would arrive as a DOE station until the first cycle.
5. Run `pnpm haze:hindcast` once over the stored history (about an hour or two: one ensemble run per day from `HISTORY_FROM`, 2025-01-01, where the days before the stored wind count as without enough wind). It resumes where it stopped. The learned model's phase 2 training reads the result.

## Things that will surprise you

- **Two backend processes.** `pnpm dev` only serves. `pnpm haze:loop` is what fetches and runs the
  model. With only the first, the map says "No forecast has been made yet".
- **The wind history is slow on purpose, and takes two days.** Open-Meteo allows one address
  5,000 calls an hour and 10,000 a day and counts each row of the grid as 25, so a first
  `pnpm haze:history wind` runs about five hours and stops once at the daily limit. The loop asks
  for the history again every 24 hours, so it finishes without anyone starting it.
- **A slow link fails every source at once.** Node gives each address of a host a quarter of a
  second to connect. `sources/http.ts` raises that to five seconds; without it every fetch dies
  in under a second with a timeout that the request's own timeout never explains.
- **Readings cannot be refetched.** DOE serves about 7 days. Do not drop or reset the dev database
  casually; the stored history is the backtest.
- **`weather_hours` is overwritten by design.** It is the one exception to the no overwrite rule.
- **The forecast beats "no change" only up to about 12 hours.** Beyond a day it ties. This is
  measured (`docs/FORECAST.md`) and stated in the app on purpose; change the wording only when
  `pnpm haze:evaluate` and the Simulation page show otherwise.
- **The backtest has one known leak: the wind.** `weather_hours` keeps the analysis, so a replayed
  run knows the real future wind. The station forecast uses no weather, so its proof is clean; any
  claim about the smoke model's own change needs weather stored by fetch time first.
- **Runs carry `model`.** Migration 005. A method change is a new `MODEL_VERSION` in
  `haze/run.ts`; the map, outlook and scores read only the current one, so deploy jobs with it.
- **A hotspot is not always a fire.** Detections on NASA's labelled fixed sources (370 sites:
  flares, industry, volcanoes) are dropped, and so is any cell-day that only one satellite pass saw
  at under 10 MW. That is 35% of cell-days and 4% of the fire power. `fire_cells.frp_mw` is what
  was fetched and `burning_mw` is what the model burns and the map draws. See section 3.1.1 of
  `docs/FEATURES.md`.
- **The data teammates share is in the repo.** `backend/db/seed/` is loaded by the migrate service.
  Export and commit it about once a week (`pnpm db:export-seed`), or a teammate who starts later
  has a hole in the readings that DOE cannot fill. See section 3.1.2.
- **The months before 3 October have fires and wind but no readings.** DOE cannot serve them, so
  the model cannot be scored there. Tuning on more than one week needs a readings history first.
- **Chances use hard-coded replay percentiles** (`haze/chance.ts`) until 300 checked forecasts
  exist per lead bucket, then switch to the database's own automatically.
- **Test data is real.** `backend/test/fixtures/recorded*.ts` are values fetched on 10 October
  2026. `steady-wind.ts` is a uniform wind test vector for the transport maths and is labelled as
  not data. Keep it that way: no synthetic data anywhere a person can see it.
- **Tests never delete.** They add to `haze_test` and are safe to rerun.
- **No em dashes, no emoji** in code, docs, UI text or prompts.
- **Frontend is Next 16.** Read `frontend/AGENTS.md` and the docs in
  `frontend/node_modules/next/dist/docs/` before writing Next code. Files stay under 200 lines
  (lint enforces it).
- **Contracts are mirrored by hand.** A change in `backend/src/contracts.haze.ts`,
  `contracts.alerts.ts`, `contracts.sources.ts` or `contracts.statements.ts` needs the same change
  in `frontend/lib/api/haze-schemas.ts`, `alert-schemas.ts`, `source-schemas.ts` or
  `statement-schemas.ts`.
- **Statements cost model calls.** The jobs process reads each new haze item once through the
  proxy (up to 20 per channel per cycle). Without the Claude token no statement is read and
  alerts fall back to the forecast. Push needs `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in
  `.env` (see `.env.example`).
- **The model service is checked every cycle in compose and asked once a day, for the 00:00 UTC issue.** `MODEL_MODE` defaults to `shadow` there and `off` for a host process. In shadow the cycle logs "a step of the cycle failed" with `what: model` until `model/` (plan A) is built and an artifact promoted; everything else runs. The Simulation page's last chapter shows the shadow rule's state. Set `MODEL_MODE=live` only when it says the rule has passed.
- **Three tables are append-only by contract**: `weather_forecasts`, `smoke_hindcasts`, `model_forecasts`. A method change is a new version string, never an update.
- **Promoting a new model version restarts the shadow-day count**: the Simulation page scores the newest version alone, so it needs its own 14 days.
- **`weather_forecasts` grows about 13 MB a day**, append-only by contract, so watch the disk the compose volume sits on.
- **The commit author** on the first commit was set to `Henson Zein <hello@upshot.cards>` because
  no git identity was configured where it was made. Amend before pushing if that is wrong.

## Where to look

| To change | Go to |
| --- | --- |
| The model | `backend/src/haze/run.ts`, then `transport.ts`, `ensemble.ts`, `calibrate.ts` |
| Thresholds and their wording | `backend/src/haze/guidelines.ts` |
| When an alert fires and what it says | `backend/src/haze/alert-rules.ts`, `closing.ts`, `headline.ts` |
| How statements are read and which are in force | `backend/src/agents/prompts/statement/`, `backend/src/haze/statements.ts` |
| What the hourly job does | `backend/src/jobs/cycle.ts` |
| A data source | `backend/src/sources/` |
| Which hotspots count as fires | `backend/src/haze/fire-screen.ts`, `backend/src/haze/fixed-sources.ts` |
| The one-off history fetch | `backend/src/jobs/history.ts` |
| The model seam | `backend/src/sources/model.ts`, the step `backend/src/jobs/model-forecast.ts`, the score `backend/src/services/model-skill.ts` |
| An assistant tool | `backend/src/agents/chat/tools/`, registered in `index.ts` |
| How the assistant decides | `backend/src/agents/chat/skills/haze-decision/SKILL.md` |
| The map | `frontend/components/map/haze-map.tsx` is the entry |
| Alerts UI | `frontend/components/alerts/` |
| Colours | `frontend/app/globals.css` |
