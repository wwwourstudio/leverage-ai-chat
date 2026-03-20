-- ============================================================================
-- LEVERAGE AI — INTELLIGENCE SCHEMA MIGRATION (v2)
-- Run ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Idempotent: safe to re-run; all statements use IF NOT EXISTS / OR REPLACE.
--
-- WHAT THIS ADDS:
--   teams          — MLB franchise reference (new, no conflict)
--   players        — MLBAM player reference (new, no conflict)
--   mlb_games      — MLB schedule + weather (renamed from 'games' to avoid
--                    conflict with existing api.games odds-infrastructure table)
--   statcast_daily — Baseball Savant leaderboard snapshot (new)
--   projections    — LeverageMetrics model output per player × game (new)
--   sharp_signals  — Structured sharp-money detection (new)
--   daily_picks    — Daily HR prop picks from picks-engine.ts (new)
--   VIEW: top_picks_today — live join across all layers
--
-- WHY mlb_games NOT games:
--   The existing api.games table (id uuid, external_id text, sport text,
--   home_team text, away_team text, commence_time timestamptz) is used by
--   the arbitrage / odds infrastructure and must not be altered.
--   mlb_games stores MLB Stats API schedule data (gamePk as text PK) and
--   is the identity backbone for projections + sharp_signals.
-- ============================================================================

SET search_path TO api;

-- ============================================================================
-- 1. TEAMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
  id           TEXT PRIMARY KEY,           -- abbreviation: 'NYY', 'LAD', etc.
  name         TEXT NOT NULL,              -- 'New York Yankees'
  league       TEXT,                       -- 'AL' | 'NL'
  division     TEXT,                       -- 'East' | 'Central' | 'West'
  stadium      TEXT,
  stadium_lat  DOUBLE PRECISION,
  stadium_lon  DOUBLE PRECISION,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_league_div ON teams (league, division);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_public_read"   ON teams;
DROP POLICY IF EXISTS "teams_service_write" ON teams;
CREATE POLICY "teams_public_read"   ON teams FOR SELECT USING (true);
CREATE POLICY "teams_service_write" ON teams FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 2. PLAYERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,           -- MLBAM player ID as text ('592450')
  name         TEXT NOT NULL,
  team_id      TEXT REFERENCES teams (id) ON DELETE SET NULL,
  position     TEXT,
  bats         CHAR(1),
  throws       CHAR(1),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_team   ON players (team_id);
CREATE INDEX IF NOT EXISTS idx_players_active ON players (is_active) WHERE is_active = TRUE;

-- Full-text search on player name
CREATE INDEX IF NOT EXISTS idx_players_name_gin
  ON players USING gin (to_tsvector('english', name));

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "players_public_read"   ON players;
DROP POLICY IF EXISTS "players_service_write" ON players;
CREATE POLICY "players_public_read"   ON players FOR SELECT USING (true);
CREATE POLICY "players_service_write" ON players FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. MLB_GAMES
-- Named mlb_games (not games) to avoid conflict with the existing api.games
-- table used by the arbitrage / live-odds infrastructure.
-- Populated from MLB Stats API on each projection run (gamePk text PK).
-- ============================================================================

CREATE TABLE IF NOT EXISTS mlb_games (
  id           TEXT PRIMARY KEY,           -- gamePk as text ('746167')
  game_date    DATE NOT NULL,
  start_time   TIMESTAMPTZ,
  home_team_id TEXT REFERENCES teams (id) ON DELETE SET NULL,
  away_team_id TEXT REFERENCES teams (id) ON DELETE SET NULL,
  home_team    TEXT,                       -- full name (denormalised for fast joins)
  away_team    TEXT,
  venue        TEXT,
  weather      JSONB,                      -- { tempC, windMph, windDir, precip }
  status       TEXT DEFAULT 'scheduled',   -- 'scheduled' | 'live' | 'final'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mlb_games_date      ON mlb_games (game_date DESC);
CREATE INDEX IF NOT EXISTS idx_mlb_games_home_team ON mlb_games (home_team_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_mlb_games_away_team ON mlb_games (away_team_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_mlb_games_status
  ON mlb_games (status) WHERE status != 'final';

ALTER TABLE mlb_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mlb_games_public_read"   ON mlb_games;
DROP POLICY IF EXISTS "mlb_games_service_write" ON mlb_games;
CREATE POLICY "mlb_games_public_read"   ON mlb_games FOR SELECT USING (true);
CREATE POLICY "mlb_games_service_write" ON mlb_games FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4. STATCAST_DAILY
-- Season-to-date Baseball Savant leaderboard snapshot (refreshed ≤ every 4h).
-- Stores AGGREGATED rates per player (not pitch-level like statcast_pitches_raw).
-- One row per player per season; upserted on each refresh.
-- ============================================================================

CREATE TABLE IF NOT EXISTS statcast_daily (
  id                BIGSERIAL    PRIMARY KEY,
  player_id         TEXT         NOT NULL,  -- MLBAM ID as text (no FK — resilient ingest)
  player_name       TEXT         NOT NULL,
  player_type       TEXT         NOT NULL   CHECK (player_type IN ('batter', 'pitcher')),
  season            INTEGER      NOT NULL,

  -- Contact quality (batters)
  pa                INTEGER,
  barrel_rate       NUMERIC(6,3),
  hard_hit_pct      NUMERIC(6,3),
  avg_exit_velocity NUMERIC(6,2),
  launch_angle      NUMERIC(5,2),
  sweet_spot_pct    NUMERIC(6,3),

  -- Expected stats (batters + pitchers)
  xba               NUMERIC(5,3),
  xslg              NUMERIC(5,3),
  woba              NUMERIC(5,3),
  xwoba             NUMERIC(5,3),

  data_source       TEXT         DEFAULT 'savant_season',
  fetched_at        TIMESTAMPTZ  DEFAULT NOW(),

  UNIQUE (player_id, season, player_type)
);

CREATE INDEX IF NOT EXISTS idx_statcast_daily_player_season
  ON statcast_daily (player_id, season DESC);
CREATE INDEX IF NOT EXISTS idx_statcast_daily_type_barrel
  ON statcast_daily (player_type, season, barrel_rate DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_statcast_daily_fetched
  ON statcast_daily (fetched_at DESC);

ALTER TABLE statcast_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "statcast_daily_public_read"   ON statcast_daily;
DROP POLICY IF EXISTS "statcast_daily_service_write" ON statcast_daily;
CREATE POLICY "statcast_daily_public_read"   ON statcast_daily FOR SELECT USING (true);
CREATE POLICY "statcast_daily_service_write" ON statcast_daily FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 5. PROJECTIONS
-- LeverageMetrics model output per player × game.
-- Populated by projection-pipeline.ts after every run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS projections (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       TEXT         NOT NULL,  -- MLBAM ID as text
  player_name     TEXT         NOT NULL,
  game_id         TEXT         NOT NULL,  -- mlb_games.id (gamePk text) or synthetic key
  game_date       DATE         NOT NULL,
  player_type     TEXT         NOT NULL   CHECK (player_type IN ('hitter', 'pitcher')),

  -- Model output
  hr_probability  NUMERIC(6,4),
  k_projection    NUMERIC(6,2),
  breakout_score  NUMERIC(5,1),
  dk_pts_mean     NUMERIC(6,2),
  matchup_score   NUMERIC(5,3),

  -- Monte Carlo percentiles
  p10             NUMERIC(5,3),
  p50             NUMERIC(5,3),
  p90             NUMERIC(5,3),

  -- Contextual adjustments
  park_factor     NUMERIC(5,3),
  weather_adj     NUMERIC(5,3),

  status          TEXT         DEFAULT 'neutral',
  model_version   TEXT         DEFAULT '1.0',
  created_at      TIMESTAMPTZ  DEFAULT NOW(),

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
DROP POLICY IF EXISTS "projections_public_read"   ON projections;
DROP POLICY IF EXISTS "projections_service_write" ON projections;
CREATE POLICY "projections_public_read"   ON projections FOR SELECT USING (true);
CREATE POLICY "projections_service_write" ON projections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 6. SHARP_SIGNALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS sharp_signals (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       TEXT,
  player_id     TEXT,
  player_name   TEXT,
  signal_type   TEXT         NOT NULL
    CHECK (signal_type IN ('sharp', 'reverse_line_movement', 'steam', 'public_fade')),
  market        TEXT         NOT NULL,
  bookmaker     TEXT,
  open_odds     INTEGER,
  current_odds  INTEGER,
  movement_pts  INTEGER,
  strength      NUMERIC(5,3),
  public_pct    NUMERIC(5,2),
  sport         TEXT         DEFAULT 'baseball_mlb',
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sharp_signals_game
  ON sharp_signals (game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_player
  ON sharp_signals (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_recent
  ON sharp_signals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_type_sport
  ON sharp_signals (signal_type, sport, created_at DESC);

ALTER TABLE sharp_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sharp_signals_public_read"   ON sharp_signals;
DROP POLICY IF EXISTS "sharp_signals_service_write" ON sharp_signals;
CREATE POLICY "sharp_signals_public_read"   ON sharp_signals FOR SELECT USING (true);
CREATE POLICY "sharp_signals_service_write" ON sharp_signals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 7. DAILY_PICKS
-- Output of picks-engine.ts.  One row per player per day per game.
-- Duplicated here so the migration is self-contained — idempotent if the
-- create-daily-picks-table.sql has already been run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_picks (
  id                  BIGSERIAL    PRIMARY KEY,
  pick_date           DATE         NOT NULL,
  game_id             TEXT,
  player_name         TEXT         NOT NULL,
  player_id           BIGINT,
  home_team           TEXT,
  away_team           TEXT,
  opposing_pitcher    TEXT,
  pitcher_hand        CHAR(1),
  home_umpire         TEXT,
  model_probability   NUMERIC(6,4) NOT NULL,
  implied_probability NUMERIC(6,4) NOT NULL,
  edge                NUMERIC(6,2) NOT NULL,
  adjusted_edge       NUMERIC(6,2) NOT NULL,
  score               NUMERIC(6,2) NOT NULL,
  tier                TEXT         NOT NULL
    CHECK (tier IN ('ELITE','STRONG','LEAN','PASS')),
  best_odds           INTEGER      NOT NULL,
  best_book           TEXT         NOT NULL,
  prop_line           NUMERIC(4,1),
  all_lines           JSONB,
  weather_factor      NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  matchup_factor      NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  park_factor         NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  umpire_boost        NUMERIC(5,3) NOT NULL DEFAULT 0.0,
  bullpen_factor      NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  sharp_boosted       BOOLEAN      NOT NULL DEFAULT FALSE,
  data_source         TEXT,
  generated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_picks_unique_pick UNIQUE (pick_date, player_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_picks_date_tier ON daily_picks (pick_date, tier);
CREATE INDEX IF NOT EXISTS idx_daily_picks_player_id ON daily_picks (player_id);

ALTER TABLE daily_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_picks_read"  ON daily_picks;
DROP POLICY IF EXISTS "daily_picks_write" ON daily_picks;
CREATE POLICY "daily_picks_read"  ON daily_picks FOR SELECT USING (true);
CREATE POLICY "daily_picks_write" ON daily_picks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 8. VIEW: top_picks_today
-- Live join: daily_picks + projections + statcast_daily + teams.
-- Regular view (not materialized) — always current, indexed tables keep it fast.
-- ============================================================================

CREATE OR REPLACE VIEW top_picks_today AS
SELECT
  dp.id                  AS pick_id,
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

  sd.barrel_rate,
  sd.hard_hit_pct,
  sd.avg_exit_velocity,
  sd.xwoba,

  ht.league    AS home_league,
  ht.division  AS home_division,
  at.league    AS away_league

FROM daily_picks dp

LEFT JOIN projections pr
  ON  pr.player_name ILIKE dp.player_name
  AND pr.game_date   = dp.pick_date

LEFT JOIN statcast_daily sd
  ON  sd.player_name ILIKE dp.player_name
  AND sd.player_type = 'batter'
  AND sd.season      = EXTRACT(YEAR FROM dp.pick_date)::INTEGER

LEFT JOIN teams ht ON ht.id = (
  SELECT id FROM teams WHERE name ILIKE dp.home_team LIMIT 1
)
LEFT JOIN teams at ON at.id = (
  SELECT id FROM teams WHERE name ILIKE dp.away_team LIMIT 1
)

WHERE dp.pick_date >= CURRENT_DATE - INTERVAL '1 day'
  AND dp.tier != 'PASS'

ORDER BY dp.score DESC, pr.hr_probability DESC NULLS LAST;

GRANT SELECT ON top_picks_today TO authenticated, anon, service_role;

-- ============================================================================
-- 9. REALTIME SUBSCRIPTIONS
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
  RAISE NOTICE '✓ Intelligence schema v2 applied successfully';
  RAISE NOTICE '  New tables: teams, players, mlb_games, statcast_daily, projections, sharp_signals, daily_picks';
  RAISE NOTICE '  New view:   top_picks_today';
  RAISE NOTICE '  NOTE: Uses mlb_games (not games) to avoid conflict with existing odds-infra table';
END $$;
