/**
 * The tables a teammate's database starts from, so that everyone screens the
 * same fires and scores against the same readings.
 *
 * Each is real fetched data that cannot simply be fetched again: DOE serves
 * one week of readings, the fire archive needs a key, and the labelled fixed
 * sources take a two-year replay. The file is tab-separated, one row a line.
 *
 * `load` only ever adds: a row already in the database wins, except that a
 * fire cell takes the larger of what was seen and of what burns, the same
 * rule the hourly fetch stores by.
 */
export const SEED_TABLES = [
  {
    file: "stations.tsv.gz",
    columns: ["id", "name", "state", "state_id", "lat", "lon"],
    types: ["text", "text", "text", "int", "float8", "float8"],
    select: "select id, name, state, state_id, lat, lon from stations order by id",
    load: `insert into stations (id, name, state, state_id, lat, lon)
           select * from unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::float8[], $6::float8[])
           on conflict (id) do nothing`,
  },
  {
    file: "readings.tsv.gz",
    columns: ["station_id", "observed_at", "api"],
    types: ["text", "timestamptz", "int"],
    select: `select station_id, to_char(observed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as observed_at, api
               from readings order by observed_at, station_id`,
    load: `insert into readings (station_id, observed_at, api)
           select * from unnest($1::text[], $2::timestamptz[], $3::int[])
           on conflict do nothing`,
  },
  {
    file: "fixed_source_days.tsv.gz",
    columns: ["day", "lat100", "lon100", "kind"],
    types: ["date", "int", "int", "text"],
    select: "select to_char(day, 'YYYY-MM-DD') as day, lat100, lon100, kind from fixed_source_days order by day, lat100, lon100",
    load: `insert into fixed_source_days (day, lat100, lon100, kind)
           select * from unnest($1::date[], $2::int[], $3::int[], $4::text[])
           on conflict do nothing`,
  },
  {
    file: "fire_cells.tsv.gz",
    columns: ["day", "lat10", "lon10", "frp_mw", "burning_mw"],
    types: ["date", "int", "int", "real", "real"],
    // Only screened rows: an unscreened one would teach a new database that a gas flare burns.
    select: "select to_char(day, 'YYYY-MM-DD') as day, lat10, lon10, frp_mw, burning_mw from fire_cells where burning_mw is not null order by day, lat10, lon10",
    load: `insert into fire_cells (day, lat10, lon10, frp_mw, burning_mw)
           select * from unnest($1::date[], $2::int[], $3::int[], $4::real[], $5::real[])
           on conflict (day, lat10, lon10) do update
             set frp_mw = greatest(fire_cells.frp_mw, excluded.frp_mw),
                 burning_mw = greatest(coalesce(fire_cells.burning_mw, excluded.burning_mw), excluded.burning_mw)`,
  },
];
