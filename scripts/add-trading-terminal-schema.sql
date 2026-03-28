-- ─────────────────────────────────────────────────────────────────
-- Trading Terminal Schema Extension
-- Run once in Supabase SQL Editor (schema: api)
-- ─────────────────────────────────────────────────────────────────

-- Normalized game registry (cross-sport, referenced by all downstream tables)
create table if not exists api.games (
  id            text        primary key,
  sport         text        not null,
  home_team     text        not null,
  away_team     text        not null,
  commence_time timestamptz not null,
  status        text        not null default 'scheduled', -- scheduled | live | final
  created_at    timestamptz not null default now()
);

create index if not exists games_sport_commence
  on api.games (sport, commence_time);

create index if not exists games_status
  on api.games (status, commence_time desc);

-- ─────────────────────────────────────────────────────────────────
-- Full odds snapshot log
-- Populated by the /api/cron/odds worker every ~60 seconds.
-- Used for: line movement detection, steam alerts, CLV calculation.
-- ─────────────────────────────────────────────────────────────────
create table if not exists api.odds_snapshots (
  id          uuid        primary key default gen_random_uuid(),
  game_id     text        references api.games (id) on delete cascade,
  bookmaker   text        not null,
  market      text        not null,   -- h2h | spreads | totals | batter_home_runs | …
  outcome     text        not null,   -- team name or Over/Under
  price       integer     not null,   -- American odds  e.g. -110, +175
  point       numeric,                -- spread / total line  e.g. -3.5, 47.5
  captured_at timestamptz not null default now()
);

create index if not exists odds_snapshots_game_market_time
  on api.odds_snapshots (game_id, market, captured_at desc);

create index if not exists odds_snapshots_captured_at
  on api.odds_snapshots (captured_at desc);

-- ─────────────────────────────────────────────────────────────────
-- Closing lines
-- Snapshot written when game.commence_time passes.
-- Used for: closing line value (CLV) tracking.
-- ─────────────────────────────────────────────────────────────────
create table if not exists api.closing_lines (
  game_id       text        not null references api.games (id) on delete cascade,
  market        text        not null,
  outcome       text        not null,
  closing_price integer     not null,
  bookmaker     text        not null default 'pinnacle',
  captured_at   timestamptz not null,
  primary key   (game_id, market, outcome, bookmaker)
);

create index if not exists closing_lines_game
  on api.closing_lines (game_id, market);

-- ─────────────────────────────────────────────────────────────────
-- Model predictions + EV output
-- Written by the EV engine after each odds ingestion cycle.
-- ─────────────────────────────────────────────────────────────────
create table if not exists api.model_predictions (
  id                uuid        primary key default gen_random_uuid(),
  game_id           text        references api.games (id) on delete cascade,
  market            text        not null,
  outcome           text        not null,
  model_probability numeric     not null check (model_probability between 0 and 1),
  fair_odds         integer     not null,
  expected_value    numeric     not null,   -- e.g. 0.087 = 8.7% edge
  kelly_fraction    numeric,                -- quarter-Kelly sizing
  bookmaker         text,                   -- best available book
  best_price        integer,               -- American odds at best book
  model_name        text        not null default 'grok-ev-v1',
  created_at        timestamptz not null default now()
);

create index if not exists model_predictions_game_ev
  on api.model_predictions (game_id, expected_value desc);

create index if not exists model_predictions_ev_threshold
  on api.model_predictions (expected_value desc, created_at desc)
  where expected_value > 0.05;

-- ─────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────
alter table api.games              enable row level security;
alter table api.odds_snapshots     enable row level security;
alter table api.closing_lines      enable row level security;
alter table api.model_predictions  enable row level security;

-- Public read for all four tables (odds data is not sensitive)
create policy "public read games"
  on api.games for select using (true);

create policy "public read odds_snapshots"
  on api.odds_snapshots for select using (true);

create policy "public read closing_lines"
  on api.closing_lines for select using (true);

create policy "public read model_predictions"
  on api.model_predictions for select using (true);

-- Service-role full access (for cron workers and server-side writes)
create policy "service role all games"
  on api.games for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role all odds_snapshots"
  on api.odds_snapshots for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role all closing_lines"
  on api.closing_lines for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role all model_predictions"
  on api.model_predictions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────
-- Realtime subscriptions
-- Enable INSERT publications so clients receive live updates.
-- ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime
  add table api.odds_snapshots,
            api.model_predictions;
