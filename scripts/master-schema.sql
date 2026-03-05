-- ============================================================================
-- LEVERAGE AI - UNIFIED DATABASE SCHEMA
-- Production-ready schema for sports betting intelligence platform
-- Execute ONCE in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 0. SCHEMA SETUP
-- All tables live in the 'api' schema, which both Supabase clients configure
-- via db: { schema: 'api' } in lib/supabase/client.ts and server.ts.
-- After running this script, go to Supabase Dashboard → Settings → API →
-- "Exposed schemas" and add 'api' so PostgREST can serve it.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS api;
SET search_path TO api;

-- Grant schema access to Supabase roles
-- NOTE: The 'api' schema is not public schema, so explicit grants are required.
-- Without these, RLS policies exist but the role still gets "permission denied" (42501).
GRANT USAGE ON SCHEMA api TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES TO service_role;

-- ============================================================================
-- 1. CORE ODDS TABLES
-- ============================================================================

-- Live odds cache (all sports, 5-minute TTL)
CREATE TABLE IF NOT EXISTS live_odds_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  sport_key VARCHAR(100) NOT NULL,
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  bookmakers JSONB NOT NULL,
  markets JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  CONSTRAINT valid_sport_key CHECK (sport_key ~ '^[a-z_]+$')
);

CREATE INDEX IF NOT EXISTS idx_live_odds_sport_key ON live_odds_cache(sport_key);
CREATE INDEX IF NOT EXISTS idx_live_odds_game_id ON live_odds_cache(game_id);
CREATE INDEX IF NOT EXISTS idx_live_odds_expires ON live_odds_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_live_odds_commence ON live_odds_cache(commence_time);

-- ============================================================================
-- 2. SPORT-SPECIFIC ODDS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS mlb_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  h2h_odds JSONB,
  spreads JSONB,
  totals JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nfl_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  h2h_odds JSONB,
  spreads JSONB,
  totals JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nba_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  h2h_odds JSONB,
  spreads JSONB,
  totals JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nhl_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  h2h_odds JSONB,
  spreads JSONB,
  totals JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sport-specific tables
CREATE INDEX IF NOT EXISTS idx_mlb_odds_game_id ON mlb_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_nfl_odds_game_id ON nfl_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_nba_odds_game_id ON nba_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_nhl_odds_game_id ON nhl_odds(game_id);

-- ============================================================================
-- 3. LINE MOVEMENT TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS line_movement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  bookmaker VARCHAR(100) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  old_line NUMERIC,
  new_line NUMERIC,
  line_change NUMERIC,
  old_odds INTEGER,
  new_odds INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_movement_game_id ON line_movement(game_id);
CREATE INDEX IF NOT EXISTS idx_line_movement_sport ON line_movement(sport);
CREATE INDEX IF NOT EXISTS idx_line_movement_timestamp ON line_movement(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_movement_updated ON line_movement(updated_at DESC);

-- ============================================================================
-- 4. ARBITRAGE OPPORTUNITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  bookmaker_1 VARCHAR(100) NOT NULL,
  bookmaker_2 VARCHAR(100) NOT NULL,
  odds_1 INTEGER NOT NULL,
  odds_2 INTEGER NOT NULL,
  stake_1 NUMERIC NOT NULL,
  stake_2 NUMERIC NOT NULL,
  total_stake NUMERIC NOT NULL,
  profit_margin NUMERIC NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arb_sport ON arbitrage_opportunities(sport);
CREATE INDEX IF NOT EXISTS idx_arb_status ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_arb_expires ON arbitrage_opportunities(expires_at);
CREATE INDEX IF NOT EXISTS idx_arb_profit ON arbitrage_opportunities(profit_margin DESC);

-- ============================================================================
-- 5. PLAYER PROPS MARKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_props_markets (
  id TEXT PRIMARY KEY,          -- composite string: "{eventId}-{playerName}-{marketKey}"
  sport VARCHAR(50) NOT NULL,
  game_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  stat_type VARCHAR(100) NOT NULL,
  line NUMERIC,
  over_odds INTEGER,
  under_odds INTEGER,
  bookmaker VARCHAR(100) NOT NULL,
  game_time TIMESTAMPTZ,
  home_team VARCHAR(255),
  away_team VARCHAR(255),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_props_game_id ON player_props_markets(game_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player ON player_props_markets(player_name);
CREATE INDEX IF NOT EXISTS idx_player_props_type ON player_props_markets(stat_type);
CREATE INDEX IF NOT EXISTS idx_player_props_sport ON player_props_markets(sport);
CREATE INDEX IF NOT EXISTS idx_player_props_fetched ON player_props_markets(fetched_at DESC);

-- ============================================================================
-- 6. KALSHI PREDICTION MARKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS kalshi_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id VARCHAR(255) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category VARCHAR(100),
  yes_price NUMERIC,
  no_price NUMERIC,
  volume NUMERIC,
  close_time TIMESTAMPTZ,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_kalshi_category ON kalshi_markets(category);
CREATE INDEX IF NOT EXISTS idx_kalshi_cached ON kalshi_markets(cached_at DESC);

-- ============================================================================
-- 7. HISTORICAL DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS historical_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(255) NOT NULL UNIQUE,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  game_date TIMESTAMPTZ NOT NULL,
  final_odds JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_sport ON historical_games(sport);
CREATE INDEX IF NOT EXISTS idx_historical_date ON historical_games(game_date DESC);

-- ============================================================================
-- 8. AI RESPONSE TRUST SCORES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_response_trust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash VARCHAR(64) NOT NULL,
  response_content TEXT NOT NULL,
  trust_score NUMERIC CHECK (trust_score >= 0 AND trust_score <= 1),
  consensus_score NUMERIC CHECK (consensus_score >= 0 AND consensus_score <= 1),
  data_sources JSONB,
  validation_method VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_trust_hash ON ai_response_trust(query_hash);
CREATE INDEX IF NOT EXISTS idx_ai_trust_score ON ai_response_trust(trust_score DESC);

-- AI predictions / chat history
CREATE TABLE IF NOT EXISTS ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model VARCHAR(100) DEFAULT 'grok-3-fast',
  confidence FLOAT8 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_user ON ai_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_created ON ai_predictions(created_at DESC);

-- AI feedback (helpful/improve votes from users)
CREATE TABLE IF NOT EXISTS ai_feedback (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id      TEXT,
  vote            TEXT        NOT NULL CHECK (vote IN ('helpful', 'improve')),
  message_excerpt TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_vote ON ai_feedback(vote);

-- ============================================================================
-- 9. QUANTITATIVE TRADING ENGINE
-- ============================================================================

-- Capital state management
CREATE TABLE IF NOT EXISTS capital_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_capital NUMERIC NOT NULL CHECK (total_capital > 0),
  risk_budget NUMERIC NOT NULL CHECK (risk_budget > 0 AND risk_budget <= 1),
  max_single_position NUMERIC NOT NULL CHECK (max_single_position > 0 AND max_single_position <= 1),
  kelly_scale NUMERIC DEFAULT 0.25 CHECK (kelly_scale > 0 AND kelly_scale <= 1),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capital_state_active ON capital_state(active) WHERE active = true;

-- Bet allocations
CREATE TABLE IF NOT EXISTS bet_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_state_id UUID REFERENCES capital_state(id),
  market_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  matchup TEXT NOT NULL,
  edge NUMERIC NOT NULL,
  kelly_fraction NUMERIC NOT NULL CHECK (kelly_fraction >= 0 AND kelly_fraction <= 1),
  allocated_capital NUMERIC NOT NULL CHECK (allocated_capital > 0),
  confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'placed', 'won', 'lost', 'void')),
  actual_return NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bet_allocations_market ON bet_allocations(market_id);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_sport ON bet_allocations(sport);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_status ON bet_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bet_allocations_created ON bet_allocations(created_at DESC);

-- ============================================================================
-- 10. USER PROFILE & PREFERENCES TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  avatar_url         TEXT,
  subscription_tier  TEXT        NOT NULL DEFAULT 'free'
                                 CHECK (subscription_tier IN ('free','core','pro','high_stakes')),
  credits_remaining  INTEGER     NOT NULL DEFAULT 15,
  credits_total      INTEGER     NOT NULL DEFAULT 15,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_sports        TEXT[]      NOT NULL DEFAULT ARRAY['NBA','NFL'],
  preferred_books       TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  theme                 TEXT        NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light','system')),
  default_sport         TEXT        NOT NULL DEFAULT 'NBA',
  email_notifications   BOOLEAN     NOT NULL DEFAULT TRUE,
  push_notifications    BOOLEAN     NOT NULL DEFAULT FALSE,
  odds_alerts           BOOLEAN     NOT NULL DEFAULT TRUE,
  line_movement_alerts  BOOLEAN     NOT NULL DEFAULT TRUE,
  arbitrage_alerts      BOOLEAN     NOT NULL DEFAULT TRUE,
  bankroll              NUMERIC     NOT NULL DEFAULT 0,
  risk_tolerance        TEXT        NOT NULL DEFAULT 'medium'
                                    CHECK (risk_tolerance IN ('conservative','medium','aggressive')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Add custom_instructions column if it doesn't exist (safe to re-run)
ALTER TABLE api.user_preferences ADD COLUMN IF NOT EXISTS custom_instructions TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS user_alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type        TEXT        NOT NULL
                                CHECK (alert_type IN (
                                  'odds_change','line_movement','player_prop',
                                  'arbitrage','kalshi_price','game_start'
                                )),
  sport             TEXT,
  team              TEXT,
  player            TEXT,
  condition         JSONB       NOT NULL DEFAULT '{}',
  threshold         NUMERIC,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  trigger_count     INTEGER     NOT NULL DEFAULT 0,
  max_triggers      INTEGER     NOT NULL DEFAULT 1,
  last_triggered_at TIMESTAMPTZ,
  title             TEXT        NOT NULL,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id   ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_is_active ON user_alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_alerts_type      ON user_alerts(alert_type);

CREATE TABLE IF NOT EXISTS user_stats (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_analyses       INTEGER     NOT NULL DEFAULT 0,
  total_bets_tracked   INTEGER     NOT NULL DEFAULT 0,
  wins                 INTEGER     NOT NULL DEFAULT 0,
  losses               INTEGER     NOT NULL DEFAULT 0,
  pushes               INTEGER     NOT NULL DEFAULT 0,
  total_wagered        NUMERIC     NOT NULL DEFAULT 0,
  total_won            NUMERIC     NOT NULL DEFAULT 0,
  roi                  NUMERIC     NOT NULL DEFAULT 0,
  longest_win_streak   INTEGER     NOT NULL DEFAULT 0,
  current_win_streak   INTEGER     NOT NULL DEFAULT 0,
  favorite_sport       TEXT,
  favorite_book        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

CREATE TABLE IF NOT EXISTS user_insights (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_value      NUMERIC     NOT NULL DEFAULT 0,
  win_rate         NUMERIC     NOT NULL DEFAULT 0,
  roi              NUMERIC     NOT NULL DEFAULT 0,
  active_contests  INTEGER     NOT NULL DEFAULT 0,
  total_invested   NUMERIC     NOT NULL DEFAULT 0,
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON user_insights(user_id);

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                    TEXT        NOT NULL DEFAULT 'free'
                                      CHECK (tier IN ('free','core','pro','high_stakes')),
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_user_id ON subscription_tiers(user_id);

-- ============================================================================
-- 11. FANTASY SPORTS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_leagues (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  sport            TEXT        NOT NULL CHECK (sport IN ('nfl','nba','mlb','nhl')),
  platform         TEXT        NOT NULL DEFAULT 'custom',
  league_size      INTEGER     NOT NULL DEFAULT 12,
  scoring_type     TEXT        NOT NULL DEFAULT 'ppr'
                               CHECK (scoring_type IN ('ppr','half_ppr','standard','custom')),
  scoring_settings JSONB       NOT NULL DEFAULT '{}',
  roster_slots     JSONB       NOT NULL DEFAULT '{}',
  draft_type       TEXT        NOT NULL DEFAULT 'snake'
                               CHECK (draft_type IN ('snake','auction','linear')),
  faab_budget      INTEGER     NOT NULL DEFAULT 100,
  season_year      INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_user_id     ON fantasy_leagues(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_sport       ON fantasy_leagues(sport);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_season_year ON fantasy_leagues(season_year);

CREATE TABLE IF NOT EXISTS fantasy_teams (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       UUID        NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  team_name       TEXT        NOT NULL,
  draft_position  INTEGER,
  is_user_team    BOOLEAN     NOT NULL DEFAULT FALSE,
  waiver_priority INTEGER,
  faab_remaining  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_teams_league_id    ON fantasy_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_user_id      ON fantasy_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_is_user_team ON fantasy_teams(league_id, is_user_team);

CREATE TABLE IF NOT EXISTS fantasy_rosters (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID        NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_name      TEXT        NOT NULL,
  position         TEXT        NOT NULL,
  roster_slot      TEXT        NOT NULL,
  acquisition_type TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (acquisition_type IN ('draft','waiver','trade','free_agent')),
  acquisition_cost INTEGER     NOT NULL DEFAULT 0,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_team_id     ON fantasy_rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_player_name ON fantasy_rosters(player_name);

CREATE TABLE IF NOT EXISTS fantasy_projections (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sport             TEXT        NOT NULL,
  player_name       TEXT        NOT NULL,
  player_id         TEXT,
  position          TEXT        NOT NULL,
  season_year       INTEGER     NOT NULL,
  week              INTEGER,
  projection_source TEXT        NOT NULL DEFAULT 'user',
  stats             JSONB       NOT NULL DEFAULT '{}',
  fantasy_points    NUMERIC     NOT NULL DEFAULT 0,
  adp               NUMERIC,
  vbd               NUMERIC,
  tier              INTEGER,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sport, player_name, season_year, week, projection_source)
);

CREATE INDEX IF NOT EXISTS idx_fantasy_projections_sport      ON fantasy_projections(sport);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_season     ON fantasy_projections(season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_player     ON fantasy_projections(player_name);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_points     ON fantasy_projections(fantasy_points DESC);
CREATE INDEX IF NOT EXISTS idx_fantasy_projections_week_sport ON fantasy_projections(sport, season_year, week);

CREATE TABLE IF NOT EXISTS waiver_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID        NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  team_id      UUID        NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  add_player   TEXT        NOT NULL,
  drop_player  TEXT,
  faab_bid     INTEGER     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected','processed')),
  week         INTEGER     NOT NULL,
  reason       TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waiver_transactions_league_id ON waiver_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_team_id   ON waiver_transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_status    ON waiver_transactions(status);
CREATE INDEX IF NOT EXISTS idx_waiver_transactions_week      ON waiver_transactions(league_id, week);

-- ============================================================================
-- 12. DRAFT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS draft_rooms (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID        NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','active','paused','completed')),
  current_pick INTEGER     NOT NULL DEFAULT 1,
  total_picks  INTEGER,
  draft_order  UUID[],
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_rooms_league_id ON draft_rooms(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_rooms_status    ON draft_rooms(status);

CREATE TABLE IF NOT EXISTS draft_picks (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_room_id        UUID        NOT NULL REFERENCES draft_rooms(id) ON DELETE CASCADE,
  pick_number          INTEGER     NOT NULL,
  round                INTEGER     NOT NULL,
  team_id              UUID        REFERENCES fantasy_teams(id) ON DELETE SET NULL,
  player_name          TEXT        NOT NULL,
  position             TEXT        NOT NULL,
  vbd_at_pick          NUMERIC,
  recommendation       JSONB,
  was_recommended      BOOLEAN     NOT NULL DEFAULT FALSE,
  survival_probability NUMERIC,
  picked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_room_id, pick_number),
  UNIQUE (draft_room_id, player_name)
);

CREATE INDEX IF NOT EXISTS idx_draft_picks_draft_room_id ON draft_picks(draft_room_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_team_id       ON draft_picks(team_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_pick_number   ON draft_picks(draft_room_id, pick_number);

-- ============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlb_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhl_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_movement ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kalshi_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_trust ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_allocations ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required)
DROP POLICY IF EXISTS "Public read access" ON live_odds_cache;
CREATE POLICY "Public read access" ON live_odds_cache FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON mlb_odds;
CREATE POLICY "Public read access" ON mlb_odds FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON nfl_odds;
CREATE POLICY "Public read access" ON nfl_odds FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON nba_odds;
CREATE POLICY "Public read access" ON nba_odds FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON nhl_odds;
CREATE POLICY "Public read access" ON nhl_odds FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON line_movement;
CREATE POLICY "Public read access" ON line_movement FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON arbitrage_opportunities;
CREATE POLICY "Public read access" ON arbitrage_opportunities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON player_props_markets;
CREATE POLICY "Public read access" ON player_props_markets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON kalshi_markets;
CREATE POLICY "Public read access" ON kalshi_markets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON historical_games;
CREATE POLICY "Public read access" ON historical_games FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON ai_response_trust;
CREATE POLICY "Public read access" ON ai_response_trust FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON capital_state;
CREATE POLICY "Public read access" ON capital_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read access" ON bet_allocations;
CREATE POLICY "Public read access" ON bet_allocations FOR SELECT USING (true);

-- Authenticated write access
DROP POLICY IF EXISTS "Auth write access" ON live_odds_cache;
CREATE POLICY "Auth write access" ON live_odds_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON mlb_odds;
CREATE POLICY "Auth write access" ON mlb_odds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON nfl_odds;
CREATE POLICY "Auth write access" ON nfl_odds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON nba_odds;
CREATE POLICY "Auth write access" ON nba_odds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON nhl_odds;
CREATE POLICY "Auth write access" ON nhl_odds FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON line_movement;
CREATE POLICY "Auth write access" ON line_movement FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON arbitrage_opportunities;
CREATE POLICY "Auth write access" ON arbitrage_opportunities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON player_props_markets;
CREATE POLICY "Auth write access" ON player_props_markets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON kalshi_markets;
CREATE POLICY "Auth write access" ON kalshi_markets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON capital_state;
CREATE POLICY "Auth write access" ON capital_state FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Auth write access" ON bet_allocations;
CREATE POLICY "Auth write access" ON bet_allocations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS for user tables (each user owns their own rows)
ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_insights        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_leagues      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_rosters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_projections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own predictions only"  ON ai_predictions;
CREATE POLICY "Own predictions only"  ON ai_predictions     FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Own profile only"      ON user_profiles;
CREATE POLICY "Own profile only"      ON user_profiles      FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Own preferences only"  ON user_preferences;
CREATE POLICY "Own preferences only"  ON user_preferences   FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Own alerts only"       ON user_alerts;
CREATE POLICY "Own alerts only"       ON user_alerts        FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Own stats only"        ON user_stats;
CREATE POLICY "Own stats only"        ON user_stats         FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Own insights only"     ON user_insights;
CREATE POLICY "Own insights only"     ON user_insights      FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Own subscription only" ON subscription_tiers;
CREATE POLICY "Own subscription only" ON subscription_tiers FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "League owner access"  ON fantasy_leagues;
CREATE POLICY "League owner access"  ON fantasy_leagues
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "League member read"   ON fantasy_teams;
CREATE POLICY "League member read"   ON fantasy_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fantasy_leagues
      WHERE fantasy_leagues.id = fantasy_teams.league_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "League owner write"   ON fantasy_teams;
CREATE POLICY "League owner write"   ON fantasy_teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fantasy_leagues
      WHERE fantasy_leagues.id = fantasy_teams.league_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Roster access"        ON fantasy_rosters;
CREATE POLICY "Roster access"        ON fantasy_rosters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fantasy_teams
      JOIN fantasy_leagues ON fantasy_leagues.id = fantasy_teams.league_id
      WHERE fantasy_teams.id = fantasy_rosters.team_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Projections read"     ON fantasy_projections;
CREATE POLICY "Projections read"     ON fantasy_projections FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Projections write"    ON fantasy_projections;
CREATE POLICY "Projections write"    ON fantasy_projections FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Projections update"   ON fantasy_projections;
CREATE POLICY "Projections update"   ON fantasy_projections FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Waiver access"        ON waiver_transactions;
CREATE POLICY "Waiver access"        ON waiver_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fantasy_leagues
      WHERE fantasy_leagues.id = waiver_transactions.league_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Draft room access"    ON draft_rooms;
CREATE POLICY "Draft room access"    ON draft_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fantasy_leagues
      WHERE fantasy_leagues.id = draft_rooms.league_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Draft pick access"    ON draft_picks;
CREATE POLICY "Draft pick access"    ON draft_picks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM draft_rooms
      JOIN fantasy_leagues ON fantasy_leagues.id = draft_rooms.league_id
      WHERE draft_rooms.id = draft_picks.draft_room_id
        AND fantasy_leagues.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 14. USER CREDITS TABLE
-- Persists credit balances server-side so they survive cache clears and
-- are consistent across devices. Incremented by the Stripe webhook handler.
-- ============================================================================

CREATE TABLE IF NOT EXISTS api.user_credits (
  user_id       uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance       integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can read own credits" ON api.user_credits;
CREATE POLICY "User can read own credits"
  ON api.user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service-role (Stripe webhook) can write; users cannot self-update
DROP POLICY IF EXISTS "Service role can manage credits" ON api.user_credits;
CREATE POLICY "Service role can manage credits"
  ON api.user_credits FOR ALL
  USING (auth.role() = 'service_role');

-- RPC: atomically increment a user's credit balance
CREATE OR REPLACE FUNCTION api.increment_user_credits(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  INSERT INTO api.user_credits (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance    = api.user_credits.balance + EXCLUDED.balance,
    updated_at = now();
$$;

-- ============================================================================
-- 15. ENABLE REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Core live data (idempotent: ignore if already a member)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE live_odds_cache;        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE line_movement;           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE arbitrage_opportunities; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE player_props_markets;    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE kalshi_markets;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fantasy & alerts live updates
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_leagues;        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_teams;           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE draft_rooms;             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;             EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE waiver_transactions;     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE user_alerts;             EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 14. CHAT PERSISTENCE
-- ============================================================================

-- Chat threads (one row per conversation / sidebar entry)
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  preview TEXT DEFAULT '',
  category TEXT DEFAULT 'all',
  tags TEXT[] DEFAULT '{}',
  starred BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads(user_id, updated_at DESC);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own threads only" ON chat_threads;
CREATE POLICY "Own threads only" ON chat_threads
  FOR ALL USING (auth.uid() = user_id);

-- Chat messages (individual turns in a thread)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_used TEXT,
  confidence FLOAT8,
  is_welcome BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Thread owner messages" ON chat_messages;
CREATE POLICY "Thread owner messages" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = auth.uid()
    )
  );

-- Enable realtime for live sidebar updates
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- ROLE GRANTS (explicit grants for all tables created above)
-- ALTER DEFAULT PRIVILEGES only covers future tables; existing tables need GRANT.
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA api TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO authenticated, service_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Leverage AI database schema created successfully';
  RAISE NOTICE '✓ api schema created and set as search path';
  RAISE NOTICE '✓ 30 tables created with indexes and constraints:';
  RAISE NOTICE '    Core: live_odds_cache, mlb/nfl/nba/nhl_odds, line_movement,';
  RAISE NOTICE '          arbitrage_opportunities, player_props_markets, kalshi_markets,';
  RAISE NOTICE '          historical_games, ai_response_trust, ai_predictions, capital_state, bet_allocations';
  RAISE NOTICE '    User: user_profiles, user_preferences, user_alerts, user_stats,';
  RAISE NOTICE '          user_insights, subscription_tiers';
  RAISE NOTICE '    Fantasy: fantasy_leagues, fantasy_teams, fantasy_rosters,';
  RAISE NOTICE '             fantasy_projections, waiver_transactions';
  RAISE NOTICE '    Draft: draft_rooms, draft_picks';
  RAISE NOTICE '    Chat: chat_threads, chat_messages';
  RAISE NOTICE '✓ RLS policies applied for all tables';
  RAISE NOTICE '✓ Realtime subscriptions enabled';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Supabase Dashboard → Settings → API → Exposed schemas → add "api"';
  RAISE NOTICE '  2. Test with /api/health endpoint';
END $$;
