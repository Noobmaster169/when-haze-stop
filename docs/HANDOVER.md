# Handover

Written 10 October 2026, at commit "Add the haze map, forecast, alerts and assistant tools" on
branch `haze-product`. This is the state of the work and what to do next. For what each feature
is and how it works, read `docs/FEATURES.md`. For the code rules, read `CLAUDE.md`.

## Where things stand

All three features are written and committed: the haze map and forecast, alerts, and the
assistant's tools. Nothing has been pushed. `main` is untouched.

| Check | Result |
| --- | --- |
| Backend `pnpm type-check` | Clean |
| Backend `pnpm test` | 99 tests pass, 15 files |
| Frontend `pnpm lint`, `pnpm type-check` | Clean |
| Frontend `pnpm test` | 32 tests pass |
| Pages in a browser (dev server) | Map, station panel, search, timeline, alerts, track record and chat all render and work |

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
- `/accuracy` shows a table under "Since this app started running" after backfill.
- Ask the five starter questions in the dock. Check each answer has numbers from tools, source
  chips, and a map link. Ask something off topic and check it refuses.

## Then, in order

1. Fix whatever the first live run breaks.
2. Read real assistant answers and tune. A prompt change is a new file `prompts/chat/v3.md` and a
   bump of `CHAT_PROMPT` in `agents/chat/loop.ts`. Never edit `v2.md`.
3. Look at the heat layer with real data. Its opacity is `FAINT_ALPHA` and `FULL_ALPHA` in
   `frontend/components/map/heat.ts`.
4. Run `pnpm build` in `frontend/`.
5. Push `haze-product` and merge.

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

## Things that will surprise you

- **Two backend processes.** `pnpm dev` only serves. `pnpm haze:loop` is what fetches and runs the
  model. With only the first, the map says "No forecast has been made yet".
- **Readings cannot be refetched.** DOE serves about 7 days. Do not drop or reset the dev database
  casually; the stored history is the backtest.
- **`weather_hours` is overwritten by design.** It is the one exception to the no overwrite rule.
- **The forecast ties with "no change".** This is measured and stated in the app on purpose. Do
  not remove those sentences unless the Track record table shows the model winning.
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
- **Chances use hard-coded first test percentiles** (`haze/chance.ts`) until 300 checked forecasts
  exist per lead bucket, then switch to the database's own automatically.
- **Test data is real.** `backend/test/fixtures/recorded*.ts` are values fetched on 10 October
  2026. `steady-wind.ts` is a uniform wind test vector for the transport maths and is labelled as
  not data. Keep it that way: no synthetic data anywhere a person can see it.
- **Tests never delete.** They add to `haze_test` and are safe to rerun.
- **No em dashes, no emoji** in code, docs, UI text or prompts.
- **Frontend is Next 16.** Read `frontend/AGENTS.md` and the docs in
  `frontend/node_modules/next/dist/docs/` before writing Next code. Files stay under 200 lines
  (lint enforces it).
- **Contracts are mirrored by hand.** A change in `backend/src/contracts.haze.ts` or
  `contracts.alerts.ts` or `contracts.sources.ts` needs the same change in
  `frontend/lib/api/haze-schemas.ts`, `alert-schemas.ts` or `source-schemas.ts`.
- **The commit author** on the first commit was set to `Henson Zein <hello@upshot.cards>` because
  no git identity was configured where it was made. Amend before pushing if that is wrong.

## Where to look

| To change | Go to |
| --- | --- |
| The model | `backend/src/haze/run.ts`, then `transport.ts`, `ensemble.ts`, `calibrate.ts` |
| Thresholds and their wording | `backend/src/haze/guidelines.ts` |
| When an alert fires and what it says | `backend/src/haze/alert-rules.ts` |
| What the hourly job does | `backend/src/jobs/cycle.ts` |
| A data source | `backend/src/sources/` |
| Which hotspots count as fires | `backend/src/haze/fire-screen.ts`, `backend/src/haze/fixed-sources.ts` |
| The one-off history fetch | `backend/src/jobs/history.ts` |
| An assistant tool | `backend/src/agents/chat/tools/`, registered in `index.ts` |
| How the assistant decides | `backend/src/agents/chat/skills/haze-decision/SKILL.md` |
| The map | `frontend/components/map/haze-map.tsx` is the entry |
| Alerts UI | `frontend/components/alerts/` |
| Colours | `frontend/app/globals.css` |
