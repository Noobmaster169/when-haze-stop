-- Three more outside sources that give the readings context: the ECMWF
-- composition forecast (modelled PM2.5, which DOE does not publish), airport
-- visibility reports, and Singapore's official readings across the strait.
-- All insert only, like readings: a forecast is kept as it was issued so it
-- can be scored later, and an observation is never rewritten.

-- CAMS global forecast at a DOE station, one row an hour. `fetched_at` is the
-- cycle hour that pulled it, so each issue of the forecast is kept whole.
create table cams_hours (
  station_id  text not null references stations(id),
  fetched_at  timestamptz not null,
  valid_at    timestamptz not null,
  pm25        real not null,
  pm10        real not null,
  -- Aerosol optical depth: how much the whole column of air dims sunlight. Unitless.
  aod         real not null,
  primary key (station_id, fetched_at, valid_at)
);
create index on cams_hours (station_id, fetched_at desc);

-- The airports whose weather reports are read, as the reports name them.
create table airports (
  icao        text primary key,
  name        text not null,
  lat         double precision not null,
  lon         double precision not null,
  updated_at  timestamptz not null default now()
);

-- One METAR. Visibility is the reported prevailing visibility in metres;
-- 10000 means ten kilometres or more, which is as far as a METAR says.
create table metar_obs (
  icao          text not null references airports(icao),
  observed_at   timestamptz not null,
  visibility_m  int,
  -- The present weather codes as reported: 'HZ' haze, 'FU' smoke, 'TS' thunderstorm, and so on. Null when none.
  weather       text,
  raw           text not null,
  primary key (icao, observed_at)
);
create index on metar_obs (observed_at desc);

-- Singapore NEA, one row a region and hour: the one-hour PM2.5 and the
-- 24-hour PSI and PM2.5 that NEA's advisories use.
create table nea_hours (
  region       text not null,
  observed_at  timestamptz not null,
  pm25_hourly  int,
  pm25_24h     int,
  psi_24h      int,
  primary key (region, observed_at)
);
create index on nea_hours (observed_at desc);
