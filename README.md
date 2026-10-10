# When Haze Stop

Haze over Malaysia: the official readings on a map, a forecast three and a half days ahead,
alerts on what the government will do in an area (from the forecast and from official statements), and an assistant that answers from the same data.

Three features, described in full in [docs/FEATURES.md](docs/FEATURES.md):

- **Map and forecast.** DOE readings, NASA fire detections and Open-Meteo wind drive a smoke
  transport model. The map replays the past week and shows the forecast.
- **Alerts.** Follow an area and be told once when a line is crossed, when haze is forecast to
  arrive, and when it is forecast to clear.
- **Assistant.** A chat dock with tools over the data. It recommends, names its sources and
  refuses anything that is not about haze.

Built on an AI application starter: a Next.js app with a chat dock on every page, an Express
backend that runs the agent with tools and skills, and an LLM proxy container that serves Claude
through a Claude Code OAuth token instead of an API key.

```
frontend/   Next.js 16, React 19, Tailwind 4          :3000
backend/    Express 5, TypeScript, Postgres, zod      :8091
proxy/      Python gateway to `claude -p` (container) :4001 on the host
```

## Run it

You need Docker.

```sh
cp .env.example .env
claude setup-token              # paste the token into CLAUDE_CODE_OAUTH_TOKEN in .env
docker compose up -d --build
```

Open http://localhost:3000. The map is the home page; ask the dock something about haze.

`compose.yaml` starts six services:

| Service | What it does | Host port |
| --- | --- | --- |
| `postgres` | The database | 5433 |
| `llm-proxy` | `claude -p` behind the Anthropic wire | 4001 |
| `migrate` | Applies the migrations, then exits | |
| `api` | The Express api | 8091 |
| `jobs` | One data cycle, a backfill of the stored week, then every hour | |
| `frontend` | The Next.js app, a production build | 3000 |

The first cycle fetches a week of DOE readings and takes a few minutes, and the backfill after it
takes longer. Until the cycle finishes the map says "No forecast has been made yet". Watch it with
`docker compose logs -f jobs`. `curl 127.0.0.1:8091/health` says whether Postgres and the proxy
are up. Without the token the map and alerts work and the chat does not.

Everyone starts from the same data. `backend/db/seed/` holds the readings since 3 October 2026,
the fires since 1 January 2025 already screened, the list of fixed heat sources (gas flares,
industry, volcanoes) and the PM2.5 of OpenAQ's sensors since 1 January 2025. The `migrate` service
loads it, and the `jobs` service then fetches the wind, the airport reports and Singapore's hours
for those months by itself. The History strip under the map shows any of those days.

To keep teammates in step, whoever has been running longest exports and commits the seed about
once a week: `cd backend && pnpm db:export-seed`. The two keys, `FIRMS_MAP_KEY` and
`OPENAQ_API_KEY`, are optional: with them the jobs service fetches the fires and the sensors
itself, and keeps them current, instead of relying on the seed.

### The history: four kinds of data back to 1 January 2025

A forecast is trained and checked on four things: where the fires were, the wind that carried the
smoke, how far airport observers could see, and the PM2.5 that was measured. `pnpm haze:history`
(the `jobs` service runs it on every start) fills all four back to `HISTORY_FROM`, by default
`2025-01-01`, and the History strip under the map shows every one of those days.

| Part | What it stores | From | Key |
| --- | --- | --- | --- |
| `fires` | Every day's fires, screened, and NASA's labelled fixed sources | NASA FIRMS | `FIRMS_MAP_KEY`, free |
| `wind` | Hourly wind and rain on the model's grid | Open-Meteo | none |
| `visibility` | The weather reports of 29 airports | Iowa State's METAR archive | none |
| `air` | Singapore's hourly PM2.5, and OpenAQ's sensors | data.gov.sg, OpenAQ | `OPENAQ_API_KEY`, free, for OpenAQ |

```sh
cd backend
pnpm haze:history                    # all four
pnpm haze:history wind               # or only the parts named: fires, wind, visibility, air
pnpm haze:coverage                   # what is stored of each, month by month
pnpm haze:dataset                    # the history as five CSV tables for training, into backend/dataset/
HISTORY_FROM=2024-01-01 pnpm haze:history
```

A first run is about 2,700 requests. Fires, visibility and PM2.5 take about an hour together; the
wind takes about five spread over two days, because Open-Meteo allows one address 5,000 calls an
hour and 10,000 a day: the fetch paces itself under the first, stops at the second, and the hourly
loop picks the rest up the next day by itself. It can be stopped and started again: every part records what came back in
`source_fetches` and asks only for what is missing, and a part that fails leaves the others
running. `pnpm haze:coverage` prints what is stored of each, month by month. Without a key the part that needs
it is skipped and says so. Put the two keys in the root `.env` for compose, or in `backend/.env`
for host development.

### Host development

To run the api, jobs or frontend from source with reload, start only the infrastructure and stop
the container you are replacing:

```sh
docker compose up -d postgres llm-proxy

cd backend
cp .env.example .env
pnpm install && pnpm db:migrate && pnpm db:seed
pnpm dev                        # http://127.0.0.1:8091
pnpm haze:once                  # in another terminal: fetch, run the model, raise alerts
pnpm haze:backfill              # once: replay the stored week for the timeline and the track record
pnpm haze:loop                  # keep running: refreshes every hour
pnpm haze:history               # once: fires, wind, airport visibility and PM2.5 back to 1 January 2025 (see above)

cd ../frontend
cp .env.example .env.local
pnpm install && pnpm dev        # http://localhost:3000
```

This needs Node 24 and pnpm 11. Without Docker, the proxy also runs on the host with your own
`claude` login: `cd proxy && python3 -m venv .venv && .venv/bin/pip install -e . && LLM_PROXY_PORT=4001 ./start.sh`.

## How a chat turn works

1. The dock POSTs the question to the Next route `/api/chat/:id/messages`, which forwards it to
   the backend and hands the backend's event stream back to the browser unread.
2. The backend stores the question, then runs the loop in `backend/src/agents/chat/loop.ts`.
   Each step is one model call through the proxy that returns a JSON object: either tool calls
   to run, or the final answer.
3. The stream carries `progress` events (thinking, looking, writing, with the answer so far),
   a `step` event per batch of finished tool calls, then one `answer` event with the stored turn.
4. Stop aborts the request. The abort reaches the proxy, which kills the session, and the turn
   is stored with whatever had been written.

## Extend it

- **A tool.** Copy `backend/src/agents/chat/tools/get-time.ts`, give it a name, a description
  written for the model, a zod schema and a `run`, and add it to the list in `tools/index.ts`.
  The prompt picks it up from the registry.
- **A skill.** Add `backend/src/agents/chat/skills/<name>/SKILL.md` with `name`, `version` and
  `when` in its frontmatter. The agent sees the card and loads the body with `load_skill`.
- **The system prompt.** Add `backend/src/agents/prompts/chat/v5.md` and bump `CHAT_PROMPT` in
  `loop.ts`.
- **The model.** Set `LLM_MODEL_CHAT` in `backend/.env` to `sonnet`, `opus` or `haiku`. The
  aliases are in `proxy/proxy.yaml`.
- **A page.** Add it under `frontend/app/(app)/` and a line in `frontend/components/shell/nav.ts`.
- **An endpoint.** Schema in `backend/src/contracts.ts`, SQL in `backend/src/repositories/`,
  router in `backend/src/routes/`, then mirror the schema in `frontend/lib/api/`.
- **The look.** Every colour and size is a token in `frontend/app/globals.css`.

## API

| Method | Path | What |
| --- | --- | --- |
| GET | `/health` | Postgres and proxy status. 503 only when Postgres is down. |
| GET | `/ai/models` | The proxy's model aliases. |
| POST | `/ai/chat` | One plain completion, no agent. `{ model, messages, system?, maxTokens? }` |
| POST | `/chat/conversations` | Open a conversation. |
| GET | `/chat/conversations` | List them, most recently used first. |
| GET | `/chat/:id` | One conversation with its turns. |
| POST | `/chat/:id/messages` | Ask. `{ content, sessionId? }`. JSON by default, SSE with `Accept: text/event-stream`. |
| DELETE | `/chat/:id` | Delete a conversation and its turns. |
| GET | `/haze/map` | Everything the map draws: frames, stations, fires, wind. |
| GET | `/haze/days` | The stored days of fires, for looking back. |
| GET | `/haze/days/:day` | One past day for the map: fires, wind, and the haze field where readings exist. |
| GET | `/haze/stations/:id` | One station: readings, forecast, day-by-day outlook. |
| GET | `/haze/accuracy` | Forecast error by lead time, beside "no change". |
| GET | `/haze/guidelines` | The official API thresholds. |
| GET | `/haze/places?q=` | Place search, each result with its nearest station. |
| GET | `/sources` | Every data source, its newest good and failed fetch, and the recent fetch log. |
| GET | `/alerts?session=&after=` | Alerts, newest first. |
| GET | `/alerts/areas?session=` | One card per followed area: tomorrow's forecast, four days, the order in force. |
| GET, PUT | `/alerts/push-key`, `/alerts/push` | The Web Push key; where a browser's alerts are sent. |
| GET | `/statements?status=current\|all&page=` | Official statements about the haze, once each, with their status. |
| GET, POST | `/alerts/subscriptions` | The stations a browser follows; follow one. |
| DELETE | `/alerts/subscriptions/:stationId?session=` | Stop following. |

Smoke test the proxy without spending anything, using its offline `test` alias:

```sh
curl -s 127.0.0.1:8091/ai/chat -H 'content-type: application/json' \
  -d '{"model":"test","messages":[{"role":"user","content":"ping"}]}'
```

## Security

Nothing here authenticates anyone. The api and the proxy bind to loopback, and the proxy
spends your Claude subscription for whoever can reach it. Add auth before deploying:
`backend/src/app.ts` and `frontend/lib/api/transport.ts` mark where it goes.
