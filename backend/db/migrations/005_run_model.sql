-- A run names the method that made it, as it names its grid. On 10 October
-- 2026 the forecast moved from index points to PM2.5 concentration (v2), and a
-- v1 and a v2 run of the same hour must not be scored or drawn together. What
-- is read is the current method's. The default stays 'v1' so a process still
-- running the old code labels its runs correctly.
alter table forecast_runs add column model text not null default 'v1';
alter table forecast_runs drop constraint forecast_runs_as_of_kind_grid_key;
alter table forecast_runs add constraint forecast_runs_as_of_kind_grid_model_key unique (as_of, kind, grid, model);
