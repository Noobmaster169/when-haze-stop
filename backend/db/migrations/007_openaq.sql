-- PM2.5 measured by instruments other than the two governments' own, as
-- OpenAQ gathers them: an embassy's reference monitor, and the low-cost
-- sensors people and schools have put up. DOE serves one week and no
-- concentrations, so for the months before this app first ran these are the
-- only measured PM2.5 in Malaysia. Insert only, like every observation.

-- One PM2.5 sensor. `reference` is OpenAQ's own word for a regulatory-grade
-- monitor; the rest are low-cost sensors, which follow the same rises and
-- falls but can read tens of ug/m3 high.
create table openaq_sensors (
  sensor_id    bigint primary key,
  location_id  bigint not null,
  name         text not null,
  provider     text not null,
  reference    boolean not null,
  lat          double precision not null,
  lon          double precision not null,
  updated_at   timestamptz not null default now()
);

-- One sensor's mean over one hour, stamped with the hour's end, which is how
-- `readings` and `nea_hours` stamp theirs.
create table openaq_hours (
  sensor_id    bigint not null references openaq_sensors(sensor_id),
  observed_at  timestamptz not null,
  pm25         real not null,
  primary key (sensor_id, observed_at)
);
create index on openaq_hours (observed_at);
