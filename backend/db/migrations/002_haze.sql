-- What the haze model reads, what it writes, and who asked to be told.
--
-- Everything measured is kept: readings, fires and weather are upserted by
-- their natural key and never trimmed, because the history is the only
-- backtest this project has. DOE serves seven days and nothing older.

create table stations (
  id          text primary key,
  name        text not null,
  state       text not null,
  -- DOE's own id for the state, which is what its hourly table is asked by.
  state_id    int not null,
  lat         double precision not null,
  lon         double precision not null,
  updated_at  timestamptz not null default now()
);

-- One DOE reading. `api` is Malaysia's Air Pollutant Index, not a concentration.
create table readings (
  station_id   text not null references stations(id),
  observed_at  timestamptz not null,
  api          int not null,
  primary key (station_id, observed_at)
);
create index on readings (observed_at desc);

-- Fire radiative power per 0.1 degree cell and UTC day. Three satellites see
-- the same fire, so a cell-day holds the largest of their sums, not the total.
create table fire_cells (
  day     date not null,
  lat10   int not null,
  lon10   int not null,
  frp_mw  real not null,
  primary key (day, lat10, lon10)
);

-- Transport wind and rain for one hour over the whole 1 degree grid, row-major
-- from the south-west corner. An hour is overwritten as a forecast becomes an
-- analysis, which is the one place a later fetch replaces an earlier one.
create table weather_hours (
  valid_at    timestamptz primary key,
  u_ms        real[] not null,
  v_ms        real[] not null,
  rain_mm     real[] not null,
  fetched_at  timestamptz not null default now()
);

-- One run of the model. `as_of` is the newest reading it was allowed to see,
-- so a backfilled run and a live one are scored the same way.
create table forecast_runs (
  id           bigserial primary key,
  as_of        timestamptz not null,
  made_at      timestamptz not null default now(),
  -- 'live' runs see everything fetched; 'backfill' runs replay an earlier hour.
  kind         text not null check (kind in ('live', 'backfill')),
  intercept    real not null,
  slope        real not null,
  -- How well modelled smoke ranked against readings before as_of.
  fit          jsonb not null,
  unique (as_of, kind)
);
create index on forecast_runs (as_of desc);

-- The map: API over the 0.25 degree grid at one hour, one byte a cell holding
-- API / 2. At or before the run's as_of it is pulled to the readings; after,
-- it is a forecast.
create table forecast_frames (
  run_id    bigint not null references forecast_runs(id) on delete cascade,
  valid_at  timestamptz not null,
  field     bytea not null,
  primary key (run_id, valid_at)
);
create index on forecast_frames (valid_at, run_id desc);

-- A station's hourly forecast from as_of + 1 hour onward.
create table station_forecasts (
  run_id      bigint not null references forecast_runs(id) on delete cascade,
  station_id  text not null references stations(id),
  api         real[] not null,
  primary key (run_id, station_id)
);

-- Who wants to hear about a station. No login: `session_id` is whatever the
-- browser made up and kept. `push` is a Web Push subscription when it gave one.
create table alert_subscriptions (
  id          uuid primary key,
  session_id  text not null,
  station_id  text not null references stations(id),
  push        jsonb,
  created_at  timestamptz not null default now(),
  unique (session_id, station_id)
);
create index on alert_subscriptions (station_id);

-- Something worth saying about a station, said once. `open` stays true while
-- the condition holds, which is what stops the next cycle saying it again.
create table alert_events (
  id          bigserial primary key,
  station_id  text not null references stations(id),
  kind        text not null check (kind in ('observed', 'arriving', 'clearing')),
  threshold   int not null,
  message     text not null,
  -- The reading or forecast behind it, for the page and the assistant.
  detail      jsonb not null,
  open        boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on alert_events (created_at desc);
create unique index alert_events_one_open on alert_events (station_id, kind, threshold) where open;
