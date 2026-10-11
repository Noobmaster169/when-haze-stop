-- The calibrated smoke at each station, PM2.5 per hour on the same indices as
-- api, so the outlook can give the learned day peaks the simulation's hourly
-- timing. Null for runs made before this migration.
alter table station_forecasts add column physics real[];

-- The learned model version whose forecast the run's future frames were
-- corrected to, null when none was (MODEL_MODE off or shadow, or no issue).
alter table forecast_runs add column learned_version text;
