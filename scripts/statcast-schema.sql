-- =============================================================================
-- Statcast Schema Migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- =============================================================================
-- Creates two tables in the `api` schema:
--   statcast_pitches_raw  — pitch-level Statcast data (from Baseball Savant)
--   hitter_splits         — pre-computed per-batter splits (vs LHP/RHP, home/away)
--
-- Populate via pybaseball:
--   from pybaseball import statcast
--   df = statcast('2024-03-01', '2024-10-31')
--   # then INSERT into api.statcast_pitches_raw
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Raw pitch-level Statcast data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api.statcast_pitches_raw (
  id                BIGSERIAL PRIMARY KEY,
  batter            INTEGER       NOT NULL,         -- MLB player id (matches PLAYER_HEADSHOT_IDS)
  pitcher           INTEGER       NOT NULL,         -- MLB player id
  game_date         DATE          NOT NULL,
  game_pk           BIGINT,                         -- MLB game pk
  pitch_type        VARCHAR(5),                     -- FF, SL, CH, CU, SI, FC, ...
  release_speed     NUMERIC(5,1),                   -- mph
  release_spin_rate INTEGER,                        -- RPM
  release_extension NUMERIC(4,2),                  -- ft from rubber
  pfx_x             NUMERIC(6,3),                   -- horizontal movement (ft, catcher POV)
  pfx_z             NUMERIC(6,3),                   -- vertical movement (ft)
  -- Kinematic parameters (Statcast tracking)
  vx0               NUMERIC(8,4),                   -- initial horizontal velocity (ft/s)
  vy0               NUMERIC(8,4),                   -- initial velocity toward plate (ft/s)
  vz0               NUMERIC(8,4),                   -- initial vertical velocity (ft/s)
  ax                NUMERIC(8,4),                   -- horizontal acceleration (ft/s²)
  ay                NUMERIC(8,4),                   -- acceleration toward plate (ft/s²)
  az                NUMERIC(8,4),                   -- vertical acceleration (ft/s²)
  -- Contact / outcome data
  launch_speed      NUMERIC(5,1),                   -- exit velocity (mph)
  launch_angle      NUMERIC(5,1),                   -- degrees
  hit_distance_sc   NUMERIC(7,1),                   -- projected hit distance (ft)
  events            VARCHAR(50),                    -- home_run, strikeout, single, ...
  description       VARCHAR(100),                   -- called_strike, swinging_strike, ...
  -- Batter / pitcher handedness
  stand             CHAR(1),                        -- batter: L or R
  p_throws          CHAR(1),                        -- pitcher: L or R
  -- Game context
  home_team         VARCHAR(5),
  away_team         VARCHAR(5),
  inning            SMALLINT,
  inning_topbot     VARCHAR(3),                     -- 'Top' | 'Bot'
  outs_when_up      SMALLINT,
  balls             SMALLINT,
  strikes           SMALLINT,
  -- Timestamps
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for the most common query patterns
CREATE INDEX IF NOT EXISTS idx_statcast_batter_date
  ON api.statcast_pitches_raw (batter, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_statcast_pitcher_date
  ON api.statcast_pitches_raw (pitcher, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_statcast_game_date
  ON api.statcast_pitches_raw (game_date DESC);

CREATE INDEX IF NOT EXISTS idx_statcast_pitch_type
  ON api.statcast_pitches_raw (pitch_type, pitcher);

-- Row-level security (public read, matching live_odds_cache pattern)
ALTER TABLE api.statcast_pitches_raw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_statcast_pitches" ON api.statcast_pitches_raw;
CREATE POLICY "public_read_statcast_pitches"
  ON api.statcast_pitches_raw
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "service_write_statcast_pitches" ON api.statcast_pitches_raw;
CREATE POLICY "service_write_statcast_pitches"
  ON api.statcast_pitches_raw
  FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. Hitter splits — pre-aggregated for fast card generation
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api.hitter_splits (
  id                BIGSERIAL     PRIMARY KEY,
  batter            INTEGER       NOT NULL,         -- MLB player id
  player_name       VARCHAR(100),                   -- Display name
  season            INTEGER       NOT NULL,         -- e.g. 2024
  split_type        VARCHAR(20)   NOT NULL,         -- 'overall' | 'vs_LHP' | 'vs_RHP' | 'home' | 'away'
  -- Volume
  pa                INTEGER       NOT NULL DEFAULT 0,
  hr                INTEGER       NOT NULL DEFAULT 0,
  -- Core Statcast rates
  hr_rate           NUMERIC(7,5),                   -- HR / PA
  barrel_rate       NUMERIC(7,5),                   -- Barrels / PA
  avg_exit_velocity NUMERIC(5,1),                   -- mph
  air_pull_rate     NUMERIC(7,5),                   -- pulled air balls / total air balls
  hard_hit_rate     NUMERIC(7,5),                   -- EV ≥ 95 mph / batted balls
  xslg              NUMERIC(5,3),                   -- expected slugging %
  -- Timestamps
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- Unique constraint: one row per batter / season / split
  UNIQUE (batter, season, split_type)
);

CREATE INDEX IF NOT EXISTS idx_hitter_splits_batter
  ON api.hitter_splits (batter, season);

CREATE INDEX IF NOT EXISTS idx_hitter_splits_leaderboard
  ON api.hitter_splits (season, split_type, barrel_rate DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_hitter_splits_hr_leaderboard
  ON api.hitter_splits (season, split_type, hr_rate DESC NULLS LAST);

-- Row-level security
ALTER TABLE api.hitter_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_hitter_splits" ON api.hitter_splits;
CREATE POLICY "public_read_hitter_splits"
  ON api.hitter_splits
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "service_write_hitter_splits" ON api.hitter_splits;
CREATE POLICY "service_write_hitter_splits"
  ON api.hitter_splits
  FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Verification query (run after migration to confirm tables exist)
-- ---------------------------------------------------------------------------
-- SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name)::regclass))
-- FROM information_schema.tables
-- WHERE table_schema = 'api'
--   AND table_name IN ('statcast_pitches_raw', 'hitter_splits')
-- ORDER BY table_name;
