-- ============================================================================
-- LEVERAGE AI — INTELLIGENCE SCHEMA MIGRATION
-- Run ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Idempotent: safe to re-run; all statements use IF NOT EXISTS / OR REPLACE.
--
-- Adds six tables that promote the database from "supporting storage" to
-- the core intelligence layer, plus a real-time view for the picks UI.
--
-- Table dependency order (no circular FKs):
--   teams → players → games
--   statcast_daily (no FK — populated from Baseball Savant leaderboard)
--   projections    (game_id + player text, no FK — ingest order independence)
--   sharp_signals  (game_id text, no FK — populated from odds snapshots)
--   VIEW: top_picks_today (joins all above + existing daily_picks)
-- ============================================================================

SET search_path TO api;

-- ============================================================================
-- 1. TEAMS
-- Reference table for all MLB franchises.
-- Keyed by 2–3 char abbreviation (NYY, LAD, etc.) to match MLB Stats API.
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
  id           TEXT PRIMARY KEY,           -- abbreviation: 'NYY', 'LAD', etc.
  name         TEXT NOT NULL,              -- 'New York Yankees'
  league       TEXT,                       -- 'AL' | 'NL'
  division     TEXT,                       -- 'East' | 'Central' | 'West'
  stadium      TEXT,                       -- 'Yankee Stadium'
  stadium_lat  DOUBLE PRECISION,
  stadium_lon  DOUBLE PRECISION,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_league_div ON teams (league, division);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_public_read"    ON teams;
DROP POLICY IF EXISTS "teams_service_write"  ON teams;
CREATE POLICY "teams_public_read"   ON teams FOR SELECT USING (true);
CREATE POLICY "teams_service_write" ON teams FOR ALL   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 2. PLAYERS
-- Reference table for MLB players with Statcast / MLBAM identity.
-- player_id = MLBAM numeric ID stored as text for join flexibility.
-- ============================================================================

CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,           -- MLBAM player ID as text ('592450')
  name         TEXT NOT NULL,              -- 'Aaron Judge'
  team_id      TEXT REFERENCES teams (id) ON DELETE SET NULL,
  position     TEXT,                       -- 'RF', 'SP', 'RP', etc.
  bats         CHAR(1),                    -- 'R' | 'L' | 'S'
  throws       CHAR(1),                    -- 'R' | 'L' | 'S'
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_team     ON players (team_id);
CREATE INDEX IF NOT EXISTS idx_players_active   ON players (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_players_name_gin ON players USING gin (to_tsvector('english', name));

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "players_public_read"    ON players;
DROP POLICY IF EXISTS "players_service_write"  ON players;
CREATE POLICY "players_public_read"   ON players FOR SELECT USING (true);
CREATE POLICY "players_service_write" ON players FOR ALL   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. GAMES
-- One row per MLB game. Populated from MLB Stats API on each projection run.
-- weather JSONB stores the Open-Meteo payload used at projection time.
-- ============================================================================

CREATE TABLE IF NOT EXISTS games (
  id           TEXT PRIMARY KEY,           -- gamePk as text ('746167')
  game_date    DATE NOT NULL,
  start_time   TIMESTAMPTZ,
  home_team_id TEXT REFERENCES teams (id) ON DELETE SET NULL,
  away_team_id TEXT REFERENCES teams (id) ON DELETE SET NULL,
  home_team    TEXT,                       -- full name (denormalised for fast joins)
  away_team    TEXT,
  venue        TEXT,
  weather      JSONB,                      -- { tempC, windMph, windDir, precip, ... }
  status       TEXT DEFAULT 'scheduled',   -- 'scheduled' | 'live' | 'final'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_date       ON games (game_date DESC);
CREATE INDEX IF NOT EXISTS idx_games_home_team  ON games (home_team_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_games_away_team  ON games (away_team_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_games_status     ON games (status) WHERE status != 'final';

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "games_public_read"    ON games;
DROP POLICY IF EXISTS "games_service_write"  ON games;
CREATE POLICY "games_public_read"   ON games FOR SELECT USING (true);
CREATE POLICY "games_service_write" ON games FOR ALL   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4. STATCAST_DAILY
-- Season-to-date Baseball Savant leaderboard snapshot (refreshed ≤ every 4h).
-- Unlike statcast_pitches_raw (pitch-level), this stores AGGREGATED rates per
-- player — exactly what the HR model consumes (barrel_rate, exit_velocity, etc.)
-- One row per player per season; upserted on each refresh.
-- ============================================================================

CREATE TABLE IF NOT EXISTS statcast_daily (
  id               BIGSERIAL    PRIMARY KEY,
  player_id        TEXT         NOT NULL,  -- MLBAM ID as text (no FK — resilient ingest)
  player_name      TEXT         NOT NULL,
  player_type      TEXT         NOT NULL   CHECK (player_type IN ('batter', 'pitcher')),
  season           INTEGER      NOT NULL,

  -- Plate discipline / contact quality (batters)
  pa               INTEGER,                -- plate appearances / batters faced
  barrel_rate      NUMERIC(6,3),           -- barrels per batted-ball event (%)
  hard_hit_pct     NUMERIC(6,3),           -- EV ≥ 95 mph (%)
  avg_exit_velocity NUMERIC(6,2),          -- mph
  launch_angle     NUMERIC(5,2),           -- degrees
  sweet_spot_pct   NUMERIC(6,3),           -- launch angle 8–32° (%)

  -- Expected stats (both batters and pitchers)
  xba              NUMERIC(5,3),
  xslg             NUMERIC(5,3),
  woba             NUMERIC(5,3),
  xwoba            NUMERIC(5,3),

  -- Raw source: 'savant_season' | 'savant_recent_14d' | 'fallback'
  data_source      TEXT         DEFAULT 'savant_season',
  fetched_at       TIMESTAMPTZ  DEFAULT NOW(),

  UNIQUE (player_id, season, player_type)
);

CREATE INDEX IF NOT EXISTS idx_statcast_daily_player_season
  ON statcast_daily (player_id, season DESC);
CREATE INDEX IF NOT EXISTS idx_statcast_daily_type_barrel
  ON statcast_daily (player_type, season, barrel_rate DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_statcast_daily_fetched
  ON statcast_daily (fetched_at DESC);

ALTER TABLE statcast_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "statcast_daily_public_read"    ON statcast_daily;
DROP POLICY IF EXISTS "statcast_daily_service_write"  ON statcast_daily;
CREATE POLICY "statcast_daily_public_read"   ON statcast_daily FOR SELECT USING (true);
CREATE POLICY "statcast_daily_service_write" ON statcast_daily FOR ALL   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 5. PROJECTIONS
-- Output of the LeverageMetrics model per player × game.
-- Populated by projection-pipeline.ts after every run.
-- The picks engine reads these instead of re-running the model on hot paths.
-- ============================================================================

CREATE TABLE IF NOT EXISTS projections (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        TEXT         NOT NULL,  -- MLBAM ID as text
  player_name      TEXT         NOT NULL,
  game_id          TEXT         NOT NULL,  -- gamePk as text
  game_date        DATE         NOT NULL,
  player_type      TEXT         NOT NULL   CHECK (player_type IN ('hitter', 'pitcher')),

  -- Model output
  hr_probability   NUMERIC(6,4),           -- P(HR per game) [0,1]
  k_projection     NUMERIC(6,2),           -- expected Ks (pitchers) or K% (hitters)
  breakout_score   NUMERIC(5,1),           -- 0–100 pitcher breakout score
  dk_pts_mean      NUMERIC(6,2),           -- expected DraftKings points
  matchup_score    NUMERIC(5,3),           -- 0–1 composite matchup quality

  -- Monte Carlo percentiles
  p10              NUMERIC(5,3),
  p50              NUMERIC(5,3),
  p90              NUMERIC(5,3),

  -- Contextual adjustments baked in
  park_factor      NUMERIC(5,3),
  weather_adj      NUMERIC(5,3),

  -- Derived status
  status           TEXT         DEFAULT 'neutral',  -- 'hot' | 'edge' | 'value' | 'neutral'
  model_version    TEXT         DEFAULT '1.0',

  created_at       TIMESTAMPTZ  DEFAULT NOW(),

  UNIQUE (player_id, game_id, player_type)
);

CREATE INDEX IF NOT EXISTS idx_projections_game_date
  ON projections (game_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_projections_player_date
  ON projections (player_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_projections_hr_rank
  ON projections (game_date DESC, hr_probability DESC NULLS LAST)
  WHERE player_type = 'hitter';

ALTER TABLE projections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projections_public_read"    ON projections;
DROP POLICY IF EXISTS "projections_service_write"  ON projections;
CREATE POLICY "projections_public_read"   ON projections FOR SELECT USING (true);
CREATE POLICY "projections_service_write" ON projections FOR ALL   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 6. SHARP_SIGNALS
-- Structured sharp-money detection output, one row per player/game signal.
-- Populated by hr-prop-market.ts (via line-movement-tracker) and the analyze
-- route's line-movement query.  Separates sharp detection from raw line history.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sharp_signals (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          TEXT,                   -- gamePk or Odds API event ID
  player_id        TEXT,                   -- MLBAM ID as text (nullable for game-level signals)
  player_name      TEXT,
  signal_type      TEXT         NOT NULL   CHECK (signal_type IN ('sharp', 'reverse_line_movement', 'steam', 'public_fade')),
  market           TEXT         NOT NULL,  -- 'batter_home_runs' | 'h2h' | 'spreads' | 'totals'
  bookmaker        TEXT,
  open_odds        INTEGER,                -- American odds at open
  current_odds     INTEGER,               -- American odds now
  movement_pts     INTEGER,               -- current_odds - open_odds (negative = shortening)
  strength         NUMERIC(5,3),          -- 0–1 signal confidence
  public_pct       NUMERIC(5,2),          -- public bet percentage (when available)
  sport            TEXT         DEFAULT 'baseball_mlb',
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sharp_signals_game       ON sharp_signals (game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_player     ON sharp_signals (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_recent     ON sharp_signals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_type_sport ON sharp_signals (signal_type, sport, created_at DESC);

ALTER TABLE sharp_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sharp_signals_public_read"    ON sharp_signals;
DROP POLICY IF EXISTS "sharp_signals_service_write"  ON sharp_signals;
CREATE POLICY "sharp_signals_public_read"   ON sharp_signals FOR SELECT USING (true);
CREATE POLICY "sharp_signals_service_write" ON sharp_signals FOR ALL   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 7. VIEW: top_picks_today
-- Real-time join across picks + projections + players + teams.
-- Replaces the materialized view proposal (Supabase free tier doesn't support
-- REFRESH CONCURRENTLY — a regular view is always up-to-date and fast enough
-- given the indexed underlying tables).
-- ============================================================================

CREATE OR REPLACE VIEW top_picks_today AS
SELECT
  dp.id                                          AS pick_id,
  dp.player_name,
  dp.home_team,
  dp.away_team,
  dp.pick_date,
  dp.tier,
  dp.score,
  dp.adjusted_edge,
  dp.best_odds,
  dp.best_book,
  dp.sharp_boosted,

  -- Live projection data (may be NULL when picks were generated before pipeline ran)
  pr.hr_probability,
  pr.k_projection,
  pr.breakout_score,
  pr.dk_pts_mean,
  pr.matchup_score,
  pr.p10,
  pr.p50,
  pr.p90,
  pr.park_factor,
  pr.weather_adj,

  -- Statcast power profile (current season)
  sd.barrel_rate,
  sd.hard_hit_pct,
  sd.avg_exit_velocity,
  sd.xwoba,

  -- Team context
  ht.league   AS home_league,
  ht.division AS home_division,
  at.league   AS away_league

FROM daily_picks dp

-- Join projections: player_name match on today's game date
LEFT JOIN projections pr
  ON  pr.player_name ILIKE dp.player_name
  AND pr.game_date   = dp.pick_date

-- Join Statcast leaderboard (current season, batter only)
LEFT JOIN statcast_daily sd
  ON  sd.player_name ILIKE dp.player_name
  AND sd.player_type = 'batter'
  AND sd.season      = EXTRACT(YEAR FROM dp.pick_date)::INTEGER

-- Join team data for home and away
LEFT JOIN teams ht ON ht.id = (
  SELECT id FROM teams WHERE name ILIKE dp.home_team LIMIT 1
)
LEFT JOIN teams at ON at.id = (
  SELECT id FROM teams WHERE name ILIKE dp.away_team LIMIT 1
)

WHERE dp.pick_date >= CURRENT_DATE - INTERVAL '1 day'
  AND dp.tier NOT IN ('PASS')

ORDER BY dp.score DESC, pr.hr_probability DESC NULLS LAST;

-- Grant SELECT on the view to all roles (view inherits table RLS)
GRANT SELECT ON top_picks_today TO authenticated, anon, service_role;

-- ============================================================================
-- 8. REALTIME SUBSCRIPTIONS
-- Allow clients to subscribe to live updates for the new intelligence tables.
-- ============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE statcast_daily;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE projections;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sharp_signals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Intelligence schema applied successfully';
  RAISE NOTICE '  New tables: teams, players, games, statcast_daily, projections, sharp_signals';
  RAISE NOTICE '  New view:   top_picks_today (picks + projections + statcast + teams)';
  RAISE NOTICE '  Realtime:   statcast_daily, projections, sharp_signals subscribed';
  RAISE NOTICE '';
  RAISE NOTICE '  DATA FLOW:';
  RAISE NOTICE '  1. Ingest: MLB Stats API → teams + players + games';
  RAISE NOTICE '  2. Ingest: Baseball Savant → statcast_daily (upsert on refresh)';
  RAISE NOTICE '  3. Model:  projection-pipeline.ts → projections (upsert per run)';
  RAISE NOTICE '  4. Detect: hr-prop-market.ts → line_movement → sharp_signals';
  RAISE NOTICE '  5. Output: picks-engine.ts → daily_picks (existing)';
  RAISE NOTICE '  6. Read:   top_picks_today view joins all layers instantly';
END $$;
