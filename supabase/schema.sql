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

-- Trade journal: log both bot and manual trades
create table if not exists trade_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticket_id text,
  symbol text not null,
  side text not null, -- BUY/SELL
  lot_size numeric not null,
  entry_price numeric not null,
  exit_price numeric,
  profit numeric,
  reason text,
  source text not null default 'BOT', -- BOT/MANUAL
  opened_at timestamp with time zone not null default now(),
  closed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Watchlist: symbols the user tracks with notes
create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  symbol text not null,
  note text,
  created_at timestamp with time zone default now()
);

