-- What the government has said about the haze: one row per item fetched from
-- a ministry page, DOE, or a news search, read once by the model. Insert only,
-- never overwritten: it is the record of what was said and when.
create table statements (
  id              bigserial primary key,
  url             text not null unique,
  -- 'moe-statements', 'doe-statements' or 'news-statements'.
  channel         text not null,
  -- Who published the item: "Kementerian Pendidikan", "Astro Awani".
  outlet          text not null,
  title           text not null,
  published_at    timestamptz not null,
  fetched_at      timestamptz not null default now(),
  -- False for an item the model judged not to be an official statement, kept so it is never read again.
  is_statement    boolean not null,
  -- The quote was found word for word in the fetched text. Unverified statements are never shown.
  verified        boolean not null,
  issuer          text,
  issuer_name     text,
  kind            text,
  action          text,
  audience        text,
  states          text[] not null default '{}',
  districts       text[] not null default '{}',
  nationwide      boolean not null default false,
  threshold       int,
  sustained_days  int,
  effective_from  date,
  effective_until date,
  summary         text,
  quote           text,
  prompt_version  text not null
);
create index on statements (published_at desc);

-- An official order is an alert of its own; its threshold column holds the statement id.
alter table alert_events drop constraint alert_events_kind_check;
alter table alert_events add constraint alert_events_kind_check check (kind in ('observed', 'arriving', 'clearing', 'order'));
