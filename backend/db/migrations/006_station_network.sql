-- Singapore's five NEA regions join the stations table beside DOE's, so the
-- map, the panel and the model treat them as stations. The network says whose
-- reading it is: DOE publishes the API, NEA the PSI, both 24 hour indices on
-- the same bands. NEA regions carry state_id 0, which DOE never uses.
alter table stations add column network text not null default 'doe' check (network in ('doe', 'nea'));
