# Haze

An AI application starter. A Next.js app with a chat dock on the right of every page, an
Express backend that runs the agent with tools and skills, and an LLM proxy container that
serves Claude through a Claude Code OAuth token instead of an API key.

```
frontend/   Next.js 16, React 19, Tailwind 4          :3000
backend/    Express 5, TypeScript, Postgres, zod      :8091
proxy/      Python gateway to `claude -p` (container) :4001 on the host
```

## Run it

You need Node 24, pnpm 11 and Docker.

```sh
# 1. backend config, with your Claude login
cd backend
cp .env.example .env
claude setup-token          # paste the token into CLAUDE_CODE_OAUTH_TOKEN in .env

# 2. postgres and the llm-proxy
docker compose -f compose.local.yaml up -d

# 3. the api
pnpm install
pnpm db:migrate
pnpm dev                    # http://127.0.0.1:8091

# 4. the frontend, in another terminal
cd ../frontend
cp .env.example .env.local
pnpm install
pnpm dev                    # http://localhost:3000
```

Open http://localhost:3000 and ask the dock something. `curl 127.0.0.1:8091/health` says
whether Postgres and the proxy are up.

Without Docker, the proxy also runs on the host with your own `claude` login:
`cd proxy && python3 -m venv .venv && .venv/bin/pip install -e . && LLM_PROXY_PORT=4001 ./start.sh`.

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
- **The system prompt.** Add `backend/src/agents/prompts/chat/v2.md` and bump `CHAT_PROMPT` in
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
| POST | `/chat/:id/messages` | Ask. `{ content }`. JSON by default, SSE with `Accept: text/event-stream`. |
| DELETE | `/chat/:id` | Delete a conversation and its turns. |

Smoke test the proxy without spending anything, using its offline `test` alias:

```sh
curl -s 127.0.0.1:8091/ai/chat -H 'content-type: application/json' \
  -d '{"model":"test","messages":[{"role":"user","content":"ping"}]}'
```

## Security

Nothing here authenticates anyone. The api and the proxy bind to loopback, and the proxy
spends your Claude subscription for whoever can reach it. Add auth before deploying:
`backend/src/app.ts` and `frontend/lib/api/transport.ts` mark where it goes.
