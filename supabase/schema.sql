-- Economic calendar minimal schema
create table if not exists economic_calendar (
  id uuid primary key default gen_random_uuid(),
  event_time timestamp with time zone not null,
  currency text not null,
  impact text not null, -- LOW/MEDIUM/HIGH
  title text,
  created_at timestamp with time zone default now()
);

-- Bot settings toggle for blackout
alter table bot_settings
  add column if not exists news_blackout_enabled boolean default true;

