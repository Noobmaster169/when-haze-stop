-- Heat the satellites see that is not vegetation burning: gas flares, smelters,
-- power plants, volcanoes. NASA labels these in its archive (the standard
-- product, months behind the live feed), and the live feed carries no label,
-- so the labelled past is kept here and used to screen the unlabelled present.

-- One row per 0.01 degree cell (about 1 km) and UTC day that the labelled
-- archive marked as a fixed source. Insert only. A cell seen on enough days is
-- a fixed source; that rule lives in haze/fixed-sources.ts, not here.
create table fixed_source_days (
  day     date not null,
  lat100  int not null,
  lon100  int not null,
  -- NASA's own label: 'volcano', 'static' (other static land source) or 'offshore'.
  kind    text not null check (kind in ('volcano', 'static', 'offshore')),
  primary key (day, lat100, lon100)
);
create index on fixed_source_days (lat100, lon100);

-- What is left of a cell-day's fire power once the fixed sources are taken
-- out. frp_mw stays as fetched. Null on a row stored before any fixed source
-- was known, where frp_mw is the best there is.
alter table fire_cells add column burning_mw real;
