-- The conversations, every turn of them, and what each model call cost.
--
-- A turn is a row whether a person wrote it or the agent answered it. An
-- assistant turn carries the tool calls it made on the way, because what the
-- agent looked at is part of the answer and the page draws it under the prose.

create table chat_conversations (
  id          uuid primary key,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on chat_conversations (updated_at desc);

create table chat_turns (
  id               bigserial primary key,
  conversation_id  uuid not null references chat_conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  -- The calls an assistant turn made, in order, as ChatToolCall objects.
  tool_calls       jsonb not null default '[]',
  -- The skills that were in front of the agent when it answered.
  skills_used      text[] not null default '{}',
  -- True where the person stopped the turn, so `content` is what had been
  -- written by then and not a finished answer.
  stopped          boolean not null default false,
  created_at       timestamptz not null default now()
);
create index on chat_turns (conversation_id, id);

-- The ledger: one row per model call, ok or not. Append-only; a retry is a
-- new row, never an update.
create table llm_calls (
  id               bigserial primary key,
  conversation_id  uuid references chat_conversations(id) on delete set null,
  step             text not null,
  model            text not null,
  prompt_version   text not null,
  attempt          int not null,
  request          jsonb not null,
  response         jsonb,
  parsed           jsonb,
  input_tokens     int,
  output_tokens    int,
  cost_usd         numeric(12, 6),
  latency_ms       int not null,
  ok               boolean not null,
  error            text,
  created_at       timestamptz not null default now()
);
create index on llm_calls (conversation_id, id);
create index on llm_calls (created_at desc);
