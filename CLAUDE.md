# When Haze Stop

A haze map, forecast, alerts and assistant for Malaysia, built on an AI application starter: a
Next.js frontend with a chat dock on every page, an Express backend that runs the agent, and a
proxy that puts the Claude subscription behind the Anthropic wire. Read this file fully before
touching code. What each feature does and how is in `docs/FEATURES.md`. Where the work stands and
what to do next is in `docs/HANDOVER.md`.

Four independent packages. Run commands inside a package, never at the root. The one exception
is `compose.yaml` at the root, which runs the whole stack with `docker compose up -d --build`.

- `frontend/` Next.js 16. Read `frontend/AGENTS.md` before writing Next code.
- `backend/` Express + Postgres. Owns the chat agent, its tools and its skills.
- `proxy/` Python. Anthropic-wire gateway to `claude -p`, run as the `llm-proxy` container of
  the compose stack, logged in by `CLAUDE_CODE_OAUTH_TOKEN`.
- `model/` Python. The learned forecast: truth, features, training, backtest and the `/predict`
  service, run as the `model` container. Method and results in `docs/MODEL.md`.

Setup, ports and the API are in `README.md`.

## Commands

```bash
# everything, from the root: postgres, llm-proxy, migrate, api, jobs, frontend
docker compose up -d --build

# only the local infra for host development (postgres :5433, llm-proxy :4001)
docker compose up -d postgres llm-proxy
docker compose up -d --build llm-proxy   # after changing proxy/

# backend, inside backend/
pnpm install && pnpm db:migrate
pnpm db:seed                        # load the shared data in db/seed/ (only adds; compose does it for you)
pnpm db:export-seed                 # write db/seed/ from this database, to commit for the team
pnpm dev                            # api on :8091
pnpm test                           # vitest; needs postgres up (uses database haze_test)
pnpm type-check
pnpm haze:once                      # fetch the sources, run the model, raise alerts
pnpm haze:backfill                  # replay the model over the stored week
pnpm haze:loop                      # haze:once now, then every hour
pnpm haze:history                   # fires, wind, airport visibility and PM2.5 back to HISTORY_FROM (2025-01-01); name parts to run only those
pnpm haze:coverage                  # what is stored of those four, month by month; writes nothing
pnpm haze:dataset                   # the history as five CSV tables for training, into backend/dataset/
pnpm haze:hindcast                  # replay the smoke model at 00:00 UTC of each stored day into smoke_hindcasts; name a first and last day to limit it

# frontend, inside frontend/
pnpm dev                            # :3000
pnpm type-check && pnpm lint && pnpm test

# model, inside model/
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/pytest -q && .venv/bin/ruff check .
.venv/bin/hazemodel features --from 2025-06-07 --to 2026-10-08   # training rows to model/data/
.venv/bin/hazemodel serve                                         # :4002

# proxy, inside proxy/
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/pytest -q && .venv/bin/ruff check .
```

## Architecture in ten lines

- `routes/` receive HTTP, validate, call, answer. No agent logic.
- `agents/` owns every LLM call: prompt files, structured output, the chat tool loop.
- `agents/chat/loop.ts` runs a turn as steps. Each step is one model call that returns either
  up to four tool calls or the final answer. Tool use is a JSON protocol over structured
  output, because the proxy refuses the Messages API `tools` field for `claude -p`.
- `agents/chat/tools/` is one file per tool plus `index.ts`, the registry.
- `agents/chat/skills/<name>/SKILL.md` is one folder per skill, found on disk.
- `repositories/` owns all SQL. Nothing else writes SQL.
- `haze/` is the smoke model and every haze rule (thresholds, chances, alerts) as pure
  functions: no database, no network. `sources/` is one client per outside data service, each
  with a fake. `services/` holds the reads that routes, jobs and chat tools share. `jobs/` is the
  hourly fetch, model run and alert pass, a separate process from the api.
- `llm.ts` wraps the proxy. `agents/llm-client.ts` is the seam tests fake.
- `frontend/lib/api-client.ts` is the only door from the frontend to the backend: a barrel
  over `frontend/lib/api/`, one file per resource plus `transport.ts`. The browser calls
  the Next `/api/*` route handlers, which forward to `BACKEND_URL`.
- Contracts (request and response types) live in `backend/src/contracts*.ts` and are mirrored
  by hand as zod schemas in `frontend/lib/api/`. Every response is parsed, so a drift fails at
  the boundary naming the field instead of reaching a component as undefined.
- Every model call is a row in `llm_calls`: model, prompt version, tokens, cost, latency.

There is no auth. The api binds to loopback and its only caller is the Next server. Add a
check in `backend/src/app.ts` and the credential in `frontend/lib/api/transport.ts` before
exposing either.

## Module rules

**Deep modules.** A module exposes a small interface and hides a lot. If a caller needs to
know how a module works to use it, the interface is wrong.

**One responsibility per file.** The file name states it. If a file needs "and" in its
description, split it.

**Dependencies point inward.**

```
routes, jobs                        (orchestration, allowed to import everything below)
  -> services                       (shared reads: compose repositories and haze)
  -> repositories, sources, llm     (adapters)
  -> agents, haze, contracts        (core)
```

Adapters never import each other. Orchestration is thin: load, call, save.

**Explicit seams.** Every external system sits behind one interface with one real
implementation and one fake for tests. `LlmClient` is the first; the data sources in `sources/`
are the others. Fakes live next to the interface in `__fakes__/`. No test may reach the proxy or
a data source.

**No premature abstraction.** Two similar lines are fine. Three similar blocks earn a function.

## Code style

- TypeScript strict. No `any`. `unknown` at boundaries, narrowed with zod.
- Functions over classes. Classes only for stateful clients and errors.
- Named exports. No default exports except Next.js pages and config files.
- Files kebab-case. Types and schemas PascalCase. Database columns snake_case; repositories map
  to camelCase at the boundary and nowhere else.
- Zod schema at every boundary: HTTP bodies, LLM outputs, env. Derive TS types from schemas.
- Errors: throw `RetryableError` or `TerminalError` from `lib/errors.ts`. A dependency that
  answered with a failure is one `UpstreamError`. Never swallow an error; never `catch {}`.
- Comments say why, never what. No banner comments, no commented-out code.
- No emoji in code, logs, or docs.
- Logging: pino, one logger per module.
- Config only from `config.ts`. No `process.env` anywhere else in the backend.
- Async everywhere; no `.then` chains; no fire-and-forget promises.
- Prefer early return over nested `if`.
- Keep files under 200 lines. A longer file is usually two modules.

## Data rules

- Never delete, truncate, drop or overwrite anything in any database unless the user asked or
  approved first.
- Real data only. Nothing shown to a person is invented, and test fixtures are values recorded
  from the sources (`backend/test/fixtures/`).
- Readings, fires and runs are never trimmed: DOE serves one week and the stored history is the
  only backtest. `weather_hours` is the one table a later fetch overwrites, by design.
- Migrations are forward-only SQL in `backend/db/migrations/NNN_name.sql`, applied by
  `db/migrate.mjs`. Never edit an applied one.

## Prompts and skills

- A prompt is `backend/src/agents/prompts/<step>/v<N>.md`. Changing one is a new version file
  and a bump of the constant that names it, never an edit, so `llm_calls.prompt_version` says
  what the model read.
- A structured output schema is one flat object. The provider refuses a top-level union.
