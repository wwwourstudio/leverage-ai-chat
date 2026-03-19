-- Migration: create daily_picks table
-- Run in Supabase SQL Editor (schema: api)
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS api.daily_picks (
  id                  BIGSERIAL PRIMARY KEY,

  -- Identity
  pick_date           DATE        NOT NULL,
  game_id             TEXT,                          -- MLB gamePk as text (nullable when TBD)
  player_name         TEXT        NOT NULL,
  player_id           BIGINT,                        -- MLBAM player ID

  -- Game context
  home_team           TEXT,
  away_team           TEXT,
  opposing_pitcher    TEXT,
  pitcher_hand        CHAR(1),                       -- 'L' | 'R'

  -- Model output
  model_probability   NUMERIC(6,4) NOT NULL,         -- [0,1]
  implied_probability NUMERIC(6,4) NOT NULL,         -- [0,1] best market line
  edge                NUMERIC(6,2) NOT NULL,         -- base edge pp
  adjusted_edge       NUMERIC(6,2) NOT NULL,         -- weather + matchup adjusted pp
  score               NUMERIC(6,2) NOT NULL,         -- final score (adjusted + sharp bonus)
  tier                TEXT        NOT NULL           -- ELITE | STRONG | LEAN | PASS
                        CHECK (tier IN ('ELITE','STRONG','LEAN','PASS')),

  -- Market data
  best_odds           INTEGER     NOT NULL,          -- American odds (e.g. +220)
  best_book           TEXT        NOT NULL,
  prop_line           NUMERIC(4,1),                  -- e.g. 0.5

  -- Full book comparison (JSON array)
  all_lines           JSONB,                         -- [{bookmaker, overOdds, impliedProbability}]

  -- Adjustment factors
  weather_factor      NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  matchup_factor      NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  sharp_boosted       BOOLEAN      NOT NULL DEFAULT FALSE,
  data_source         TEXT,                          -- 'recent_14d' | 'season' | 'fallback'

  -- Audit
  generated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Idempotency: re-running cron updates existing rows rather than duplicating
  CONSTRAINT daily_picks_unique_pick
    UNIQUE (pick_date, player_id, game_id)
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_daily_picks_date_tier
  ON api.daily_picks (pick_date, tier);

CREATE INDEX IF NOT EXISTS idx_daily_picks_player_id
  ON api.daily_picks (player_id);

-- Enable Row Level Security
ALTER TABLE api.daily_picks ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated + anonymous users
-- (picks are public information — no sensitive user data)
DROP POLICY IF EXISTS "daily_picks_read" ON api.daily_picks;
CREATE POLICY "daily_picks_read"
  ON api.daily_picks FOR SELECT
  USING (true);

-- Only service role can write (cron / admin)
DROP POLICY IF EXISTS "daily_picks_write" ON api.daily_picks;
CREATE POLICY "daily_picks_write"
  ON api.daily_picks FOR ALL
  USING (auth.role() = 'service_role');
