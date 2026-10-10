-- Weather as it was forecast at each fetch, so the model's skill can be scored
-- on the wind it really had. weather_hours keeps only the newest analysis.
create table weather_forecasts (
  fetched_at timestamptz not null,
  valid_at   timestamptz not null,
  u_ms       real[] not null,
  v_ms       real[] not null,
  rain_mm    real[] not null,
  primary key (fetched_at, valid_at)
);
create index on weather_forecasts (valid_at);

-- The transport model's smoke near an instrument, run with fires and wind as
-- known at as_of. Filled by pnpm haze:hindcast; read by the model package.
create table smoke_hindcasts (
  as_of         timestamptz not null,
  instrument_id text not null,
  smoke_now     real not null,
  smoke_24h     real not null,
  smoke_48h     real not null,
  model         text not null,
  primary key (as_of, instrument_id, model)
);

-- A learned forecast of an instrument's peak 24 h PM2.5 (ug/m3) for a
-- Malaysian day, with its 0.1 and 0.9 quantiles. Append-only.
create table model_forecasts (
  as_of         timestamptz not null,
  instrument_id text not null,
  day           date not null,
  p10           real not null,
  p50           real not null,
  p90           real not null,
  model_version text not null,
  made_at       timestamptz not null default now(),
  primary key (as_of, instrument_id, day, model_version)
);
create index on model_forecasts (made_at desc);
