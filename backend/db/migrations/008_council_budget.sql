-- The money a council run is given to spend, in ringgit: the government's limit the plans must
-- fit inside. Null on runs made before budgets existed.
alter table council_runs add column budget_rm bigint;
