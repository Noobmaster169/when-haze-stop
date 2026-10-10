-- Every fetch the jobs process makes from an outside data source, so the
-- Sources page can say what was pulled and when. Insert only, never trimmed:
-- it is the record of where every stored number came from.
create table source_fetches (
  id           bigserial primary key,
  -- 'doe-stations', 'doe-readings', 'firms' or 'open-meteo'.
  source       text not null,
  started_at   timestamptz not null,
  finished_at  timestamptz not null,
  ok           boolean not null,
  -- What came back, as counts and a few times: {"stations": 68, "states": 16}.
  detail       jsonb not null default '{}',
  -- Why a failed fetch failed. Null when it worked.
  error        text
);
create index on source_fetches (source, started_at desc);
create index on source_fetches (started_at desc);
