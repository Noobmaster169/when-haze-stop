-- The Suppression Council (docs/council/): one row per run, and the event log
-- each run writes as it goes, which the page replays. Insert only: a run's
-- events are never rewritten, and a failed run keeps the events it wrote.
create table council_runs (
  id           bigserial primary key,
  -- Which area the council was asked to clear: 'klang-valley'.
  target       text not null,
  -- queued, running, done or failed. A queued run is taken by the council worker.
  status       text not null check (status in ('queued', 'running', 'done', 'failed')),
  -- The hour of data the council reasoned over, set when the run starts.
  as_of        timestamptz,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  verdict      jsonb,
  error        text
);

-- At most one run is queued or running at a time: a run takes minutes and many model calls.
create unique index council_runs_one_active on council_runs ((true)) where status in ('queued', 'running');

create table council_events (
  run_id   bigint not null references council_runs(id),
  -- 0, 1, 2 ... in the order they happened within the run.
  seq      integer not null,
  at       timestamptz not null default now(),
  kind     text not null,
  -- An agent id, 'engine' or 'system'.
  actor    text not null,
  payload  jsonb not null,
  primary key (run_id, seq)
);
