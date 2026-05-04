-- ============================================================================
-- LEVERAGE AI — UNIFIED DATABASE SCHEMA (v2)
-- Run ONCE in Supabase SQL Editor to initialize a fresh environment.
-- All tables live in the 'api' schema.
--
-- After running:
--   Dashboard → Settings → API → Exposed schemas → add "api"
-- ============================================================================

-- ── Schema setup ─────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS api;
SET search_path TO api;

GRANT USAGE ON SCHEMA api TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES TO service_role;

-- ── 1. ODDS / LIVE DATA ───────────────────────────────────────────────────────

-- Primary live odds cache (all sports, 5-min TTL)
CREATE TABLE IF NOT EXISTS live_odds_cache (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sport         VARCHAR(50) NOT NULL,
  sport_key     VARCHAR(100) NOT NULL,
  game_id       VARCHAR(255) NOT NULL UNIQUE,
  home_team     VARCHAR(255) NOT NULL,
  away_team     VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  bookmakers    JSONB       NOT NULL,
  markets       JSONB       NOT NULL,
  cached_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  CONSTRAINT valid_sport_key CHECK (sport_key ~ '^[a-z_]+$')
);
CREATE INDEX IF NOT EXISTS idx_live_odds_sport_key ON live_odds_cache(sport_key);
CREATE INDEX IF NOT EXISTS idx_live_odds_game_id   ON live_odds_cache(game_id);
CREATE INDEX IF NOT EXISTS idx_live_odds_expires   ON live_odds_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_live_odds_commence  ON live_odds_cache(commence_time);

-- Odds snapshots: one row per bookmaker/market/outcome per cron run.
-- Retention: 48 hours enforced by api.cleanup_odds_snapshots() called from odds cron.
-- NOTE: NEVER let this grow unbounded — the retention function MUST run each cron cycle.
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID        NOT NULL,
  bookmaker   TEXT        NOT NULL,
  market      TEXT        NOT NULL,
  outcome     TEXT        NOT NULL,
  price       INTEGER     NOT NULL,
  point       NUMERIC,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_game     ON odds_snapshots(game_id);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_captured ON odds_snapshots(captured_at DESC);

-- Closing lines for CLV (Closing Line Value) tracking — 90-day retention
CREATE TABLE IF NOT EXISTS closing_lines (
  game_id       UUID        NOT NULL,
  market        TEXT        NOT NULL,
  outcome       TEXT        NOT NULL,
  closing_price INTEGER     NOT NULL,
  bookmaker     TEXT        NOT NULL,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, market, outcome, bookmaker)
);
CREATE INDEX IF NOT EXISTS idx_closing_lines_captured ON closing_lines(captured_at DESC);

-- Line movement (recorded when odds shift > threshold)
CREATE TABLE IF NOT EXISTS line_movement (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      VARCHAR(255) NOT NULL,
  sport        VARCHAR(50)  NOT NULL,
  home_team    VARCHAR(255) NOT NULL,
  away_team    VARCHAR(255) NOT NULL,
  bookmaker    VARCHAR(100) NOT NULL,
  market_type  VARCHAR(50)  NOT NULL,
  old_line     NUMERIC,
  new_line     NUMERIC,
  line_change  NUMERIC,
  old_odds     INTEGER,
  new_odds     INTEGER,
  timestamp    TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_line_movement_game_id   ON line_movement(game_id);
CREATE INDEX IF NOT EXISTS idx_line_movement_sport     ON line_movement(sport);
CREATE INDEX IF NOT EXISTS idx_line_movement_timestamp ON line_movement(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_movement_updated   ON line_movement(updated_at DESC);

-- Arbitrage opportunities (short-lived, ~10 min TTL)
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       VARCHAR(255) NOT NULL,
  sport         VARCHAR(50)  NOT NULL,
  home_team     VARCHAR(255) NOT NULL,
  away_team     VARCHAR(255) NOT NULL,
  bookmaker_1   VARCHAR(100) NOT NULL,
  bookmaker_2   VARCHAR(100) NOT NULL,
  odds_1        INTEGER      NOT NULL,
  odds_2        INTEGER      NOT NULL,
  stake_1       NUMERIC      NOT NULL,
  stake_2       NUMERIC      NOT NULL,
  total_stake   NUMERIC      NOT NULL,
  profit_margin NUMERIC      NOT NULL,
  status        VARCHAR(20)  DEFAULT 'active',
  detected_at   TIMESTAMPTZ  DEFAULT NOW(),
  expires_at    TIMESTAMPTZ  DEFAULT NOW() + INTERVAL '10 minutes',
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_arb_sport   ON arbitrage_opportunities(sport);
CREATE INDEX IF NOT EXISTS idx_arb_status  ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_arb_expires ON arbitrage_opportunities(expires_at);
CREATE INDEX IF NOT EXISTS idx_arb_profit  ON arbitrage_opportunities(profit_margin DESC);

-- ── 2. GAMES & SCHEDULES ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS games (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_key     VARCHAR(100) NOT NULL,
  external_id   VARCHAR(255) NOT NULL UNIQUE,
  home_team     VARCHAR(255) NOT NULL,
  away_team     VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ  NOT NULL,
  status        VARCHAR(50)  NOT NULL DEFAULT 'scheduled',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_games_sport     ON games(sport_key);
CREATE INDEX IF NOT EXISTS idx_games_commence  ON games(commence_time);
CREATE INDEX IF NOT EXISTS idx_games_status    ON games(status);

CREATE TABLE IF NOT EXISTS mlb_games (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_pk       INTEGER     NOT NULL UNIQUE,
  game_date     DATE        NOT NULL,
  home_team     TEXT        NOT NULL,
  away_team     TEXT        NOT NULL,
  home_team_id  INTEGER,
  away_team_id  INTEGER,
  venue         TEXT,
  venue_lat     NUMERIC,
  venue_lon     NUMERIC,
  status        TEXT        NOT NULL DEFAULT 'scheduled',
  home_lineup   JSONB       NOT NULL DEFAULT '[]',
  away_lineup   JSONB       NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mlb_games_date ON mlb_games(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_mlb_games_pk   ON mlb_games(game_pk);

-- ── 3. PLAYER PROPS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_props_markets (
  id           TEXT        PRIMARY KEY, -- "{eventId}-{playerName}-{marketKey}"
  sport        VARCHAR(50)  NOT NULL,
  game_id      VARCHAR(255) NOT NULL,
  player_name  VARCHAR(255) NOT NULL,
  stat_type    VARCHAR(100) NOT NULL,
  line         NUMERIC,
  over_odds    INTEGER,
  under_odds   INTEGER,
  bookmaker    VARCHAR(100) NOT NULL,
  game_time    TIMESTAMPTZ,
  home_team    VARCHAR(255),
  away_team    VARCHAR(255),
  fetched_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_player_props_game_id ON player_props_markets(game_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player  ON player_props_markets(player_name);
CREATE INDEX IF NOT EXISTS idx_player_props_type    ON player_props_markets(stat_type);
CREATE INDEX IF NOT EXISTS idx_player_props_sport   ON player_props_markets(sport);
CREATE INDEX IF NOT EXISTS idx_player_props_fetched ON player_props_markets(fetched_at DESC);

-- ── 4. KALSHI PREDICTION MARKETS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kalshi_markets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id     VARCHAR(255) NOT NULL UNIQUE,
  title         TEXT         NOT NULL,
  category      VARCHAR(100),
  yes_price     NUMERIC,
  no_price      NUMERIC,
  volume        NUMERIC,
  close_time    TIMESTAMPTZ,
  event_ticker  VARCHAR(255),
  series_ticker VARCHAR(255),
  cached_at     TIMESTAMPTZ  DEFAULT NOW(),
  expires_at    TIMESTAMPTZ  DEFAULT NOW() + INTERVAL '5 minutes'
);
CREATE INDEX IF NOT EXISTS idx_kalshi_category ON kalshi_markets(category);
CREATE INDEX IF NOT EXISTS idx_kalshi_cached   ON kalshi_markets(cached_at DESC);

-- Live deployments: add columns if upgrading from v1 schema
ALTER TABLE kalshi_markets ADD COLUMN IF NOT EXISTS event_ticker  VARCHAR(255);
ALTER TABLE kalshi_markets ADD COLUMN IF NOT EXISTS series_ticker VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_kalshi_event_ticker  ON kalshi_markets(event_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_series_ticker ON kalshi_markets(series_ticker);

-- ── 5. STATCAST / MLB PROJECTIONS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS statcast_daily (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        INTEGER     NOT NULL,
  player_name      TEXT        NOT NULL,
  player_type      TEXT        NOT NULL CHECK (player_type IN ('hitter','pitcher')),
  team             TEXT,
  bats             TEXT,
  throws           TEXT,
  -- Hitter metrics
  avg_exit_velocity NUMERIC,
  max_exit_velocity NUMERIC,
  avg_launch_angle  NUMERIC,
  barrel_rate       NUMERIC,
  hard_hit_rate     NUMERIC,
  -- Pitcher metrics
  avg_velocity      NUMERIC,
  whiff_rate        NUMERIC,
  chase_rate        NUMERIC,
  k_rate            NUMERIC,
  -- Context
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  season            INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  UNIQUE (player_id, player_type, season)
);
CREATE INDEX IF NOT EXISTS idx_statcast_daily_player   ON statcast_daily(player_id);
CREATE INDEX IF NOT EXISTS idx_statcast_daily_type     ON statcast_daily(player_type);
CREATE INDEX IF NOT EXISTS idx_statcast_daily_fetched  ON statcast_daily(fetched_at DESC);

-- Persistent cache for Baseball Savant leaderboard payloads (full JSON blobs).
-- Replaces in-memory Map which is wiped on every Vercel cold start.
CREATE TABLE IF NOT EXISTS statcast_leaderboard_cache (
  cache_key  TEXT        PRIMARY KEY,
  payload    TEXT        NOT NULL,
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);
ALTER TABLE statcast_leaderboard_cache ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
  NOT NULL DEFAULT (NOW() + INTERVAL '6 hours');

-- Statcast pitch-level events (populated by /api/cron/statcast)
CREATE TABLE IF NOT EXISTS statcast_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    INTEGER     NOT NULL,
  player_name  TEXT        NOT NULL,
  player_type  TEXT        NOT NULL CHECK (player_type IN ('hitter','pitcher')),
  raw_data     JSONB       NOT NULL,
  game_date    DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_statcast_events_player  ON statcast_events(player_id);
CREATE INDEX IF NOT EXISTS idx_statcast_events_date    ON statcast_events(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_statcast_events_type    ON statcast_events(player_type);

-- Raw verbatim JSONB from Baseball Savant CSV (source of truth for statcastQuery.ts)
CREATE TABLE IF NOT EXISTS statcast_raw_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  INTEGER,
  game_date  DATE,
  raw        JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_statcast_raw_player ON statcast_raw_events(player_id);
CREATE INDEX IF NOT EXISTS idx_statcast_raw_date   ON statcast_raw_events(game_date DESC);

-- Statcast pitch-level detail (for /api/statcast/query)
CREATE TABLE IF NOT EXISTS statcast_pitches_raw (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  pitcher_id     INTEGER NOT NULL,
  batter_id      INTEGER,
  game_pk        INTEGER,
  pitch_type     TEXT,
  release_speed  NUMERIC,
  spin_rate      NUMERIC,
  pfx_x          NUMERIC,
  pfx_z          NUMERIC,
  plate_x        NUMERIC,
  plate_z        NUMERIC,
  launch_speed   NUMERIC,
  launch_angle   NUMERIC,
  hit_distance   NUMERIC,
  events         TEXT,
  description    TEXT,
  zone           INTEGER,
  stand          TEXT,
  p_throws       TEXT,
  inning         INTEGER,
  balls          INTEGER,
  strikes        INTEGER,
  on_1b          BOOLEAN,
  on_2b          BOOLEAN,
  on_3b          BOOLEAN,
  outs_when_up   INTEGER,
  estimated_ba   NUMERIC,
  estimated_woba NUMERIC,
  woba_value     NUMERIC,
  barrel         BOOLEAN,
  hard_hit       BOOLEAN,
  game_date      DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pitches_raw_pitcher ON statcast_pitches_raw(pitcher_id);
CREATE INDEX IF NOT EXISTS idx_pitches_raw_date    ON statcast_pitches_raw(game_date DESC);

-- Hitter splits (home/road, vs L/R)
CREATE TABLE IF NOT EXISTS hitter_splits (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   INTEGER NOT NULL,
  player_name TEXT    NOT NULL,
  split_type  TEXT    NOT NULL, -- 'home','road','vs_L','vs_R'
  at_bats     INTEGER,
  avg         NUMERIC,
  obp         NUMERIC,
  slg         NUMERIC,
  hr          INTEGER,
  dk_avg_pts  NUMERIC,
  games       INTEGER,
  season      INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, split_type, season)
);
CREATE INDEX IF NOT EXISTS idx_hitter_splits_player ON hitter_splits(player_id);

-- ── 6. MARKET INTELLIGENCE ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_anomalies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       TEXT        NOT NULL,
  sport         TEXT        NOT NULL,
  anomaly_type  TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  severity      TEXT        NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high')),
  raw_data      JSONB       NOT NULL DEFAULT '{}',
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours'
);
CREATE INDEX IF NOT EXISTS idx_market_anomalies_game    ON market_anomalies(game_id);
CREATE INDEX IF NOT EXISTS idx_market_anomalies_expires ON market_anomalies(expires_at);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      TEXT        NOT NULL,
  sport        TEXT        NOT NULL,
  bookmaker    TEXT        NOT NULL,
  market_type  TEXT        NOT NULL,
  home_odds    INTEGER,
  away_odds    INTEGER,
  home_spread  NUMERIC,
  away_spread  NUMERIC,
  total        NUMERIC,
  over_odds    INTEGER,
  under_odds   INTEGER,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  velocity     NUMERIC,
  sharp_action BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_game     ON market_snapshots(game_id);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_captured ON market_snapshots(captured_at DESC);

CREATE TABLE IF NOT EXISTS movement_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      TEXT        NOT NULL,
  sport        TEXT        NOT NULL,
  bookmaker    TEXT        NOT NULL,
  market_type  TEXT        NOT NULL,
  from_odds    INTEGER     NOT NULL,
  to_odds      INTEGER     NOT NULL,
  change_pct   NUMERIC     NOT NULL,
  is_sharp     BOOLEAN     NOT NULL DEFAULT FALSE,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movement_events_game ON movement_events(game_id);
CREATE INDEX IF NOT EXISTS idx_movement_events_time ON movement_events(detected_at DESC);

CREATE TABLE IF NOT EXISTS signal_performance (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type      TEXT        NOT NULL UNIQUE,
  win_rate         NUMERIC     NOT NULL DEFAULT 0.5,
  roi              NUMERIC     NOT NULL DEFAULT 0,
  sample_size      INTEGER     NOT NULL DEFAULT 0,
  last_calibrated  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_predictions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         TEXT        NOT NULL,
  sport           TEXT        NOT NULL,
  home_win_prob   NUMERIC     NOT NULL,
  away_win_prob   NUMERIC     NOT NULL,
  confidence      NUMERIC     NOT NULL DEFAULT 0.5,
  model_version   TEXT        NOT NULL DEFAULT '1.0',
  predicted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, model_version)
);
CREATE INDEX IF NOT EXISTS idx_model_predictions_game ON model_predictions(game_id);

-- ── 7. PICKS ENGINE ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_picks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_date       DATE        NOT NULL,
  sport           TEXT        NOT NULL,
  game_id         TEXT        NOT NULL,
  home_team       TEXT        NOT NULL,
  away_team       TEXT        NOT NULL,
  pick_type       TEXT        NOT NULL,
  pick_value      TEXT        NOT NULL,
  odds            INTEGER     NOT NULL,
  edge            NUMERIC     NOT NULL,
  confidence      NUMERIC     NOT NULL,
  kelly_fraction  NUMERIC     NOT NULL DEFAULT 0,
  units           NUMERIC     NOT NULL DEFAULT 1,
  tier            TEXT        NOT NULL DEFAULT 'value' CHECK (tier IN ('value','edge','high_value','premium')),
  rationale       TEXT,
  bookmaker       TEXT,
  line            NUMERIC,
  ev_pct          NUMERIC,
  closing_prob    NUMERIC,
  model_version   TEXT        NOT NULL DEFAULT '1.0',
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','push','void')),
  settled_at      TIMESTAMPTZ,
  result_score    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_picks_date   ON daily_picks(pick_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_picks_sport  ON daily_picks(sport);
CREATE INDEX IF NOT EXISTS idx_daily_picks_status ON daily_picks(status);

CREATE TABLE IF NOT EXISTS pick_outcomes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id        UUID        REFERENCES daily_picks(id) ON DELETE SET NULL,
  pick_date      DATE        NOT NULL,
  sport          TEXT        NOT NULL,
  game_id        TEXT        NOT NULL,
  pick_type      TEXT        NOT NULL,
  pick_value     TEXT        NOT NULL,
  edge           NUMERIC     NOT NULL,
  best_odds      INTEGER     NOT NULL,
  units_wagered  NUMERIC     NOT NULL,
  tier           TEXT        NOT NULL,
  hit            BOOLEAN,
  units_profit   NUMERIC,
  closing_odds   INTEGER,
  clv            NUMERIC,
  ev_bucket      TEXT,
  park_factor    NUMERIC,
  weather_bucket TEXT,
  settled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pick_outcomes_date  ON pick_outcomes(pick_date DESC);
CREATE INDEX IF NOT EXISTS idx_pick_outcomes_sport ON pick_outcomes(sport);
CREATE INDEX IF NOT EXISTS idx_pick_outcomes_hit   ON pick_outcomes(hit);

-- ── 8. MODEL METRICS & BACKTESTING ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_metrics (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  window_days        INTEGER     NOT NULL,
  sample_size        INTEGER     NOT NULL,
  brier_score        NUMERIC,
  calibration_alpha  NUMERIC     NOT NULL DEFAULT 1.0,
  calibration_beta   NUMERIC     NOT NULL DEFAULT 0.0,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_model_metrics_window ON model_metrics(window_days);

CREATE TABLE IF NOT EXISTS backtest_results (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  window_days        INTEGER     NOT NULL,
  total_picks        INTEGER     NOT NULL,
  hit_rate           NUMERIC     NOT NULL,
  avg_predicted      NUMERIC     NOT NULL,
  brier_score        NUMERIC     NOT NULL,
  log_loss           NUMERIC,
  calibration_error  NUMERIC,
  roi                NUMERIC,
  calibration_alpha  NUMERIC,
  calibration_beta   NUMERIC,
  calibration_log_loss NUMERIC,
  calibration_n      INTEGER,
  segments           JSONB       NOT NULL DEFAULT '[]',
  diagnostics        TEXT[]      NOT NULL DEFAULT '{}',
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backtest_results_generated ON backtest_results(generated_at DESC);

-- ── 9. QUANTITATIVE TRADING ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capital_state (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  total_capital         NUMERIC NOT NULL CHECK (total_capital > 0),
  risk_budget           NUMERIC NOT NULL CHECK (risk_budget > 0 AND risk_budget <= 1),
  max_single_position   NUMERIC NOT NULL CHECK (max_single_position > 0 AND max_single_position <= 1),
  kelly_scale           NUMERIC DEFAULT 0.25 CHECK (kelly_scale > 0 AND kelly_scale <= 1),
  active                BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capital_state_active ON capital_state(active) WHERE active = true;

CREATE TABLE IF NOT EXISTS bet_allocations (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_state_id UUID    REFERENCES capital_state(id),
  market_id        TEXT    NOT NULL,
  sport            TEXT    NOT NULL,
  matchup          TEXT    NOT NULL,
  edge             NUMERIC NOT NULL,
  kelly_fraction   NUMERIC NOT NULL CHECK (kelly_fraction >= 0 AND kelly_fraction <= 1),
  allocated_capital NUMERIC NOT NULL CHECK (allocated_capital > 0),
  confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status           TEXT    DEFAULT 'pending' CHECK (status IN ('pending','placed','won','lost','void')),
  actual_return    NUMERIC,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  settled_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_market  ON bet_allocations(market_id);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_sport   ON bet_allocations(sport);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_status  ON bet_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_created ON bet_allocations(created_at DESC);

-- ── 10. AI / CHAT ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_predictions (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt     TEXT    NOT NULL,
  response   TEXT    NOT NULL,
  model      VARCHAR(100) DEFAULT 'grok-3-fast',
  confidence FLOAT8  CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_user    ON ai_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_created ON ai_predictions(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id      TEXT,
  vote            TEXT    NOT NULL CHECK (vote IN ('helpful','improve')),
  message_excerpt TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_vote ON ai_feedback(vote);

-- Chat threads (sidebar conversations)
CREATE TABLE IF NOT EXISTS chat_threads (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL DEFAULT 'New Chat',
  preview    TEXT    DEFAULT '',
  category   TEXT    DEFAULT 'all',
  tags       TEXT[]  DEFAULT '{}',
  starred    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads(user_id, updated_at DESC);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID    NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT    NOT NULL,
  cards      JSONB,
  model_used TEXT,
  confidence FLOAT8,
  is_welcome BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at ASC);

-- ── 11. USER TABLES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT,
  avatar_url        TEXT,
  subscription_tier TEXT    NOT NULL DEFAULT 'free'
                            CHECK (subscription_tier IN ('free','core','pro','high_stakes')),
  credits_remaining INTEGER NOT NULL DEFAULT 15,
  credits_total     INTEGER NOT NULL DEFAULT 15,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_sports       TEXT[]  NOT NULL DEFAULT ARRAY['NBA','NFL'],
  preferred_books      TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  theme                TEXT    NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light','system')),
  default_sport        TEXT    NOT NULL DEFAULT 'NBA',
  email_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications   BOOLEAN NOT NULL DEFAULT FALSE,
  odds_alerts          BOOLEAN NOT NULL DEFAULT TRUE,
  line_movement_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  arbitrage_alerts     BOOLEAN NOT NULL DEFAULT TRUE,
  bankroll             NUMERIC NOT NULL DEFAULT 0,
  risk_tolerance       TEXT    NOT NULL DEFAULT 'medium'
                               CHECK (risk_tolerance IN ('conservative','medium','aggressive')),
  custom_instructions  TEXT    NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

CREATE TABLE IF NOT EXISTS user_alerts (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type        TEXT    NOT NULL CHECK (alert_type IN (
                              'odds_change','line_movement','player_prop',
                              'arbitrage','kalshi_price','game_start','market_intelligence'
                            )),
  sport             TEXT,
  team              TEXT,
  player            TEXT,
  condition         JSONB   NOT NULL DEFAULT '{}',
  threshold         NUMERIC,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_count     INTEGER NOT NULL DEFAULT 0,
  max_triggers      INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TIMESTAMPTZ,
  title             TEXT    NOT NULL,
  description       TEXT,
  notify_channels   TEXT[]  NOT NULL DEFAULT ARRAY['in_app'],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id   ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_is_active ON user_alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_alerts_type      ON user_alerts(alert_type);

CREATE TABLE IF NOT EXISTS user_stats (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_analyses     INTEGER NOT NULL DEFAULT 0,
  total_bets_tracked INTEGER NOT NULL DEFAULT 0,
  wins               INTEGER NOT NULL DEFAULT 0,
  losses             INTEGER NOT NULL DEFAULT 0,
  pushes             INTEGER NOT NULL DEFAULT 0,
  total_wagered      NUMERIC NOT NULL DEFAULT 0,
  total_won          NUMERIC NOT NULL DEFAULT 0,
  roi                NUMERIC NOT NULL DEFAULT 0,
  longest_win_streak INTEGER NOT NULL DEFAULT 0,
  current_win_streak INTEGER NOT NULL DEFAULT 0,
  favorite_sport     TEXT,
  favorite_book      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

CREATE TABLE IF NOT EXISTS user_insights (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_value     NUMERIC NOT NULL DEFAULT 0,
  win_rate        NUMERIC NOT NULL DEFAULT 0,
  roi             NUMERIC NOT NULL DEFAULT 0,
  active_contests INTEGER NOT NULL DEFAULT 0,
  total_invested  NUMERIC NOT NULL DEFAULT 0,
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON user_insights(user_id);

CREATE TABLE IF NOT EXISTS user_credits (
  user_id    UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 12. SUBSCRIPTIONS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                   TEXT    NOT NULL DEFAULT 'free'
                                 CHECK (tier IN ('free','core','pro','high_stakes')),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_user_id ON subscription_tiers(user_id);

-- ── 13. KALSHI TRADING ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kalshi_orders (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  market_id   TEXT    NOT NULL,
  action      TEXT    NOT NULL CHECK (action IN ('buy','sell')),
  side        TEXT    NOT NULL CHECK (side IN ('yes','no')),
  quantity    INTEGER NOT NULL,
  price       INTEGER NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','filled','cancelled','rejected')),
  kalshi_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at   TIMESTAMPTZ,
  error_msg   TEXT,
  fee         INTEGER,
  fill_price  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_user   ON kalshi_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_market ON kalshi_orders(market_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_status ON kalshi_orders(status);

-- ── 14. FANTASY SPORTS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fantasy_leagues (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  sport            TEXT    NOT NULL CHECK (sport IN ('nfl','nba','mlb','nhl')),
  platform         TEXT    NOT NULL DEFAULT 'custom',
  league_size      INTEGER NOT NULL DEFAULT 12,
  scoring_type     TEXT    NOT NULL DEFAULT 'ppr'
                           CHECK (scoring_type IN ('ppr','half_ppr','standard','custom')),
  scoring_settings JSONB   NOT NULL DEFAULT '{}',
  roster_slots     JSONB   NOT NULL DEFAULT '{}',
  draft_type       TEXT    NOT NULL DEFAULT 'snake'
                           CHECK (draft_type IN ('snake','auction','linear')),
  faab_budget      INTEGER NOT NULL DEFAULT 100,
  season_year      INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_user_id     ON fantasy_leagues(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_sport       ON fantasy_leagues(sport);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_season_year ON fantasy_leagues(season_year);

CREATE TABLE IF NOT EXISTS fantasy_teams (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID    NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  user_id        UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  team_name      TEXT    NOT NULL,
  draft_position INTEGER,
  is_user_team   BOOLEAN NOT NULL DEFAULT FALSE,
  waiver_priority INTEGER,
  faab_remaining INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_league_id    ON fantasy_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_user_id      ON fantasy_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_is_user_team ON fantasy_teams(league_id, is_user_team);

CREATE TABLE IF NOT EXISTS fantasy_rosters (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID    NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_name      TEXT    NOT NULL,
  position         TEXT    NOT NULL,
  roster_slot      TEXT    NOT NULL,
  acquisition_type TEXT    NOT NULL DEFAULT 'draft'
                           CHECK (acquisition_type IN ('draft','waiver','trade','free_agent')),
  acquisition_cost INTEGER NOT NULL DEFAULT 0,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_team_id     ON fantasy_rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_player_name ON fantasy_rosters(player_name);

CREATE TABLE IF NOT EXISTS fantasy_projections (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  sport             TEXT    NOT NULL,
  player_name       TEXT    NOT NULL,
  player_id         TEXT,
  position          TEXT    NOT NULL,
  season_year       INTEGER NOT NULL,
  week              INTEGER,
  projection_source TEXT    NOT NULL DEFAULT 'user',
  stats             JSONB   NOT NULL DEFAULT '{}',
  fantasy_points    NUMERIC NOT NULL DEFAULT 0,
  adp               NUMERIC,
  vbd               NUMERIC,
  tier              INTEGER,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sport, player_name, season_year, week, projection_source)
);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_sport  ON fantasy_projections(sport);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_season ON fantasy_projections(season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_player ON fantasy_projections(player_name);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_points ON fantasy_projections(fantasy_points DESC);

CREATE TABLE IF NOT EXISTS waiver_transactions (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID    NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  team_id      UUID    NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  add_player   TEXT    NOT NULL,
  drop_player  TEXT,
  faab_bid     INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected','processed')),
  week         INTEGER NOT NULL,
  reason       TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_league_id ON waiver_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_team_id   ON waiver_transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_status    ON waiver_transactions(status);

-- ── 15. DRAFT ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS draft_rooms (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID    NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  status       TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','active','paused','completed')),
  current_pick INTEGER NOT NULL DEFAULT 1,
  total_picks  INTEGER,
  draft_order  UUID[],
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_draft_rooms_league_id ON draft_rooms(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_rooms_status    ON draft_rooms(status);

CREATE TABLE IF NOT EXISTS draft_picks (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_room_id        UUID    NOT NULL REFERENCES draft_rooms(id) ON DELETE CASCADE,
  pick_number          INTEGER NOT NULL,
  round                INTEGER NOT NULL,
  team_id              UUID    REFERENCES fantasy_teams(id) ON DELETE SET NULL,
  player_name          TEXT    NOT NULL,
  position             TEXT    NOT NULL,
  vbd_at_pick          NUMERIC,
  recommendation       JSONB,
  was_recommended      BOOLEAN NOT NULL DEFAULT FALSE,
  survival_probability NUMERIC,
  picked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_room_id, pick_number),
  UNIQUE (draft_room_id, player_name)
);
CREATE INDEX IF NOT EXISTS idx_draft_picks_draft_room_id ON draft_picks(draft_room_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_team_id       ON draft_picks(team_id);

-- ── 16. ADP CACHE ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nfbc_adp (
  id            SERIAL      PRIMARY KEY,
  sport         TEXT        NOT NULL DEFAULT 'mlb' CHECK (sport IN ('mlb','nfl')),
  rank          INTEGER     NOT NULL,
  player_name   TEXT        NOT NULL,
  display_name  TEXT        NOT NULL,
  adp           NUMERIC(7,2) NOT NULL,
  positions     TEXT        NOT NULL DEFAULT '',
  team          TEXT        NOT NULL DEFAULT '',
  value_delta   NUMERIC(7,2) NOT NULL DEFAULT 0,
  is_value_pick BOOLEAN     NOT NULL DEFAULT false,
  auction_value NUMERIC(7,2),
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sport, rank)
);
CREATE INDEX IF NOT EXISTS idx_nfbc_adp_sport        ON nfbc_adp(sport, rank);
CREATE INDEX IF NOT EXISTS idx_nfbc_adp_display_name ON nfbc_adp USING gin(to_tsvector('english', display_name));

-- ── 17. REFERENCE DATA ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   INTEGER UNIQUE,
  full_name     TEXT    NOT NULL,
  team          TEXT,
  position      TEXT,
  sport         TEXT    NOT NULL DEFAULT 'mlb',
  bats          TEXT,
  throws        TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_players_name  ON players(full_name);
CREATE INDEX IF NOT EXISTS idx_players_sport ON players(sport);

CREATE TABLE IF NOT EXISTS teams (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id INTEGER UNIQUE,
  full_name   TEXT    NOT NULL,
  short_name  TEXT,
  abbr        TEXT,
  sport       TEXT    NOT NULL DEFAULT 'mlb',
  division    TEXT,
  league      TEXT,
  venue       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_sport ON teams(sport);
CREATE INDEX IF NOT EXISTS idx_teams_abbr  ON teams(abbr);

-- ── 18. APP SETTINGS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION api.set_app_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION api.set_app_settings_updated_at();

-- ── 19. RETENTION FUNCTIONS ───────────────────────────────────────────────────

-- Deletes odds_snapshots older than retention_hours (default 48h) in 5K-row batches.
-- Called fire-and-forget from the odds cron after each insert cycle.
CREATE OR REPLACE FUNCTION api.cleanup_odds_snapshots(retention_hours INT DEFAULT 48)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT := 0;
  batch_count   INT;
BEGIN
  LOOP
    DELETE FROM api.odds_snapshots
    WHERE id IN (
      SELECT id FROM api.odds_snapshots
      WHERE captured_at < NOW() - (retention_hours || ' hours')::INTERVAL
      LIMIT 5000
    );
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    deleted_count := deleted_count + batch_count;
    EXIT WHEN batch_count = 0;
  END LOOP;
  RETURN deleted_count;
END;
$$;
GRANT EXECUTE ON FUNCTION api.cleanup_odds_snapshots(INT) TO service_role;

-- Deletes closing_lines older than retention_days (default 90d).
CREATE OR REPLACE FUNCTION api.cleanup_closing_lines(retention_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM api.closing_lines
  WHERE captured_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
GRANT EXECUTE ON FUNCTION api.cleanup_closing_lines(INT) TO service_role;

-- ── 20. RLS POLICIES ─────────────────────────────────────────────────────────

-- Public read (no auth needed)
ALTER TABLE live_odds_cache          ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_snapshots           ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_lines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_movement            ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props_markets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kalshi_markets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_state            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_allocations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_anomalies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_performance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_predictions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE games                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlb_games                ENABLE ROW LEVEL SECURITY;
ALTER TABLE statcast_daily           ENABLE ROW LEVEL SECURITY;
ALTER TABLE statcast_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE statcast_raw_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE statcast_pitches_raw     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitter_splits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfbc_adp                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE players                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings             ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'live_odds_cache','odds_snapshots','closing_lines','line_movement',
    'arbitrage_opportunities','player_props_markets','kalshi_markets',
    'capital_state','bet_allocations','market_anomalies','market_snapshots',
    'movement_events','signal_performance','model_predictions',
    'games','mlb_games','statcast_daily','statcast_events',
    'statcast_raw_events','statcast_pitches_raw','hitter_splits',
    'nfbc_adp','players','teams','app_settings'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public read" ON api.%I', t);
    EXECUTE format('CREATE POLICY "Public read" ON api.%I FOR SELECT USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service write" ON api.%I', t);
    EXECUTE format('CREATE POLICY "Service write" ON api.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- User-owned tables
ALTER TABLE ai_predictions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_insights      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kalshi_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_leagues    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_rosters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_picks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_outcomes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_results   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own" ON ai_predictions;     CREATE POLICY "Own" ON ai_predictions     FOR ALL USING ((select auth.uid()) = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Own" ON ai_feedback;        CREATE POLICY "Own" ON ai_feedback        FOR ALL USING ((select auth.uid()) = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Own" ON chat_threads;       CREATE POLICY "Own" ON chat_threads       FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Own" ON user_profiles;      CREATE POLICY "Own" ON user_profiles      FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Own" ON user_preferences;   CREATE POLICY "Own" ON user_preferences   FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Own" ON user_alerts;        CREATE POLICY "Own" ON user_alerts        FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Own" ON user_stats;         CREATE POLICY "Own" ON user_stats         FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Own" ON user_insights;      CREATE POLICY "Own" ON user_insights      FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Own" ON subscription_tiers; CREATE POLICY "Own" ON subscription_tiers FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Own" ON kalshi_orders;      CREATE POLICY "Own" ON kalshi_orders      FOR ALL USING ((select auth.uid()) = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Own" ON fantasy_leagues;    CREATE POLICY "Own" ON fantasy_leagues    FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Own read credits" ON user_credits;
CREATE POLICY "Own read credits" ON user_credits FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Service credits" ON user_credits;
CREATE POLICY "Service credits"  ON user_credits FOR ALL TO service_role USING (true);

-- Chat messages: access via thread ownership
DROP POLICY IF EXISTS "Own messages" ON chat_messages;
CREATE POLICY "Own messages" ON chat_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = (select auth.uid()))
);

-- Fantasy tables: access scoped to league owner
DROP POLICY IF EXISTS "League access" ON fantasy_teams;
CREATE POLICY "League access" ON fantasy_teams FOR ALL USING (
  EXISTS (SELECT 1 FROM fantasy_leagues WHERE fantasy_leagues.id = fantasy_teams.league_id AND fantasy_leagues.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS "League access" ON fantasy_rosters;
CREATE POLICY "League access" ON fantasy_rosters FOR ALL USING (
  EXISTS (SELECT 1 FROM fantasy_teams JOIN fantasy_leagues ON fantasy_leagues.id = fantasy_teams.league_id WHERE fantasy_teams.id = fantasy_rosters.team_id AND fantasy_leagues.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS "League access" ON waiver_transactions;
CREATE POLICY "League access" ON waiver_transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM fantasy_leagues WHERE fantasy_leagues.id = waiver_transactions.league_id AND fantasy_leagues.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS "League access" ON draft_rooms;
CREATE POLICY "League access" ON draft_rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM fantasy_leagues WHERE fantasy_leagues.id = draft_rooms.league_id AND fantasy_leagues.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS "League access" ON draft_picks;
CREATE POLICY "League access" ON draft_picks FOR ALL USING (
  EXISTS (SELECT 1 FROM draft_rooms JOIN fantasy_leagues ON fantasy_leagues.id = draft_rooms.league_id WHERE draft_rooms.id = draft_picks.draft_room_id AND fantasy_leagues.user_id = (select auth.uid()))
);
DROP POLICY IF EXISTS "Auth read" ON fantasy_projections;
CREATE POLICY "Auth read" ON fantasy_projections FOR SELECT USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "Auth write" ON fantasy_projections;
CREATE POLICY "Auth write" ON fantasy_projections FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "Auth update" ON fantasy_projections;
CREATE POLICY "Auth update" ON fantasy_projections FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- Picks / metrics: service_role only (written by cron)
DROP POLICY IF EXISTS "Service" ON daily_picks;      CREATE POLICY "Service" ON daily_picks      FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service" ON pick_outcomes;    CREATE POLICY "Service" ON pick_outcomes    FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service" ON model_metrics;    CREATE POLICY "Service" ON model_metrics    FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service" ON backtest_results; CREATE POLICY "Service" ON backtest_results FOR ALL TO service_role USING (true);
-- Allow authenticated users to read picks/metrics
DROP POLICY IF EXISTS "Auth read" ON daily_picks;      CREATE POLICY "Auth read" ON daily_picks      FOR SELECT USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "Auth read" ON pick_outcomes;    CREATE POLICY "Auth read" ON pick_outcomes    FOR SELECT USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "Auth read" ON model_metrics;    CREATE POLICY "Auth read" ON model_metrics    FOR SELECT USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "Auth read" ON backtest_results; CREATE POLICY "Auth read" ON backtest_results FOR SELECT USING ((select auth.role()) = 'authenticated');

-- ── 21. REALTIME SUBSCRIPTIONS ───────────────────────────────────────────────

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE live_odds_cache;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE odds_snapshots;           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE line_movement;            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE arbitrage_opportunities;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE player_props_markets;     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE kalshi_markets;           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads;             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_leagues;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_teams;            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE draft_rooms;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE waiver_transactions;      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE user_alerts;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 22. EXPLICIT GRANTS ──────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA api TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO authenticated, service_role;

-- RPC helpers
CREATE OR REPLACE FUNCTION api.increment_user_credits(p_user_id UUID, p_amount INTEGER)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO api.user_credits (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET balance = api.user_credits.balance + EXCLUDED.balance, updated_at = NOW();
$$;

DO $$
BEGIN
  RAISE NOTICE '✓ Leverage AI schema v2 initialized';
  RAISE NOTICE '  Tables: 37 in api schema';
  RAISE NOTICE '  Retention: odds_snapshots 48h, closing_lines 90d';
  RAISE NOTICE '  Next: Dashboard → Settings → API → Exposed schemas → add "api"';
END $$;
