-- A run is drawn on one grid, and the grid follows the region. On 10 October
-- 2026 the region grew east from 118 to 120 to take in all of Sabah, so runs
-- made before then cannot be drawn on the new grid. Runs are never deleted, so
-- instead each run names its grid and an hour may have one run per grid. What
-- is read (the map, the outlook, the track record) is the current grid's.
alter table forecast_runs add column grid text not null default '96:118:-6:8:0.25';
alter table forecast_runs alter column grid drop default;
alter table forecast_runs drop constraint forecast_runs_as_of_kind_key;
alter table forecast_runs add constraint forecast_runs_as_of_kind_grid_key unique (as_of, kind, grid);
