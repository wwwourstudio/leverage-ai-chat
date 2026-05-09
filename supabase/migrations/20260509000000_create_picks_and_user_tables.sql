-- =============================================================================
-- Migration: Create picks pipeline tables and user support tables
-- Generated: 2026-05-09
-- =============================================================================
--
-- Creates the following tables in the api schema (idempotent — safe to re-run):
--
--   Picks pipeline:
--     api.daily_picks      — ML-generated player picks (written by cron/picks)
--     api.pick_results     — Outcome tracking (written by cron/settle)
--
--   User support:
--     api.user_preferences — Per-user settings + custom AI instructions
--     api.user_credits     — Credit balance (used by /api/init)
--     api.chat_threads     — Chat conversation history metadata
--
-- Note: api.model_metrics and api.backtest_results were created in migration
--       20260408000000_create_model_metrics_backtest_results.sql and are not
--       recreated here.
-- =============================================================================

-- Ensure api schema exists
CREATE SCHEMA IF NOT EXISTS api;
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT ALL ON ROUTINES  TO anon, authenticated, service_role;

-- ── api.daily_picks ───────────────────────────────────────────────────────────
-- Written by cron/picks. Read by /api/picks. Idempotency key: (pick_date, player_id, game_id).

CREATE TABLE IF NOT EXISTS api.daily_picks (
  id                  BIGSERIAL PRIMARY KEY,
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
  tier                TEXT         NOT NULL CHECK (tier IN ('ELITE','STRONG','LEAN','PASS')),
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

CREATE INDEX IF NOT EXISTS idx_daily_picks_date_tier ON api.daily_picks (pick_date, tier);
CREATE INDEX IF NOT EXISTS idx_daily_picks_player_id ON api.daily_picks (player_id);

ALTER TABLE api.daily_picks ENABLE ROW LEVEL SECURITY;

-- Read-only for all users; writes restricted to service role
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='api' AND tablename='daily_picks' AND policyname='daily_picks_read'
  ) THEN
    CREATE POLICY daily_picks_read ON api.daily_picks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='api' AND tablename='daily_picks' AND policyname='daily_picks_write'
  ) THEN
    CREATE POLICY daily_picks_write ON api.daily_picks FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ── api.pick_results ──────────────────────────────────────────────────────────
-- Outcome tracking table — one row per pick, settled after each game.
-- Written by cron/settle and cron/train.

CREATE TABLE IF NOT EXISTS api.pick_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id          BIGINT      NOT NULL REFERENCES api.daily_picks(id) ON DELETE CASCADE,
  player_id        BIGINT,
  pick_date        DATE        NOT NULL,
  predicted_prob   NUMERIC(6,4) NOT NULL CHECK (predicted_prob >= 0 AND predicted_prob <= 1),
  edge             NUMERIC(6,2),
  score            NUMERIC(6,2),
  tier             TEXT,
  sharp_boosted    BOOLEAN      DEFAULT FALSE,
  odds             INTEGER,
  best_book        TEXT,
  kelly_stake      NUMERIC(8,6),
  actual_result    BOOLEAN,
  settled_at       TIMESTAMPTZ,
  pnl              NUMERIC(10,2),
  recorded_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT pick_results_unique_pick UNIQUE (pick_id)
);

CREATE INDEX IF NOT EXISTS idx_pick_results_pick_date  ON api.pick_results (pick_date DESC);
CREATE INDEX IF NOT EXISTS idx_pick_results_unsettled  ON api.pick_results (pick_date) WHERE actual_result IS NULL;
CREATE INDEX IF NOT EXISTS idx_pick_results_settled    ON api.pick_results (settled_at DESC) WHERE actual_result IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pick_results_tier       ON api.pick_results (tier, pick_date DESC);

ALTER TABLE api.pick_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='api' AND tablename='pick_results' AND policyname='pick_results_service_write'
  ) THEN
    CREATE POLICY pick_results_service_write ON api.pick_results FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='api' AND tablename='pick_results' AND policyname='pick_results_auth_read'
  ) THEN
    CREATE POLICY pick_results_auth_read ON api.pick_results FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── api.user_preferences ──────────────────────────────────────────────────────
-- Per-user settings and custom AI instructions. Used by /api/init and /api/user/instructions.

CREATE TABLE IF NOT EXISTS api.user_preferences (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_sports       TEXT[]      NOT NULL DEFAULT ARRAY['NBA','NFL'],
  preferred_books      TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  theme                TEXT        NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light','system')),
  default_sport        TEXT        NOT NULL DEFAULT 'NBA',
  email_notifications  BOOLEAN     NOT NULL DEFAULT TRUE,
  push_notifications   BOOLEAN     NOT NULL DEFAULT FALSE,
  odds_alerts          BOOLEAN     NOT NULL DEFAULT TRUE,
  line_movement_alerts BOOLEAN     NOT NULL DEFAULT TRUE,
  arbitrage_alerts     BOOLEAN     NOT NULL DEFAULT TRUE,
  bankroll             NUMERIC     NOT NULL DEFAULT 0,
  risk_tolerance       TEXT        NOT NULL DEFAULT 'medium' CHECK (risk_tolerance IN ('conservative','medium','aggressive')),
  custom_instructions  TEXT        NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON api.user_preferences (user_id);

ALTER TABLE api.user_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='api' AND tablename='user_preferences' AND policyname='user_preferences_self'
  ) THEN
    CREATE POLICY user_preferences_self ON api.user_preferences FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── api.user_credits ──────────────────────────────────────────────────────────
-- Credit balance for authenticated users. Used by /api/init.

CREATE TABLE IF NOT EXISTS api.user_credits (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api.user_credits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='api' AND tablename='user_credits' AND policyname='user_credits_self'
  ) THEN
    CREATE POLICY user_credits_self ON api.user_credits FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='api' AND tablename='user_credits' AND policyname='user_credits_service'
  ) THEN
    CREATE POLICY user_credits_service ON api.user_credits FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── api.chat_threads ──────────────────────────────────────────────────────────
-- Chat conversation metadata. Used by /api/init and /api/chats/*.

CREATE TABLE IF NOT EXISTS api.chat_threads (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'New Chat',
  preview    TEXT        DEFAULT '',
  category   TEXT        DEFAULT 'all',
  tags       TEXT[]      DEFAULT '{}',
  starred    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON api.chat_threads (user_id, updated_at DESC);

ALTER TABLE api.chat_threads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='api' AND tablename='chat_threads' AND policyname='chat_threads_self'
  ) THEN
    CREATE POLICY chat_threads_self ON api.chat_threads FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Grant PostgREST-accessible SELECT on new tables to anon (public reads)
GRANT SELECT ON api.daily_picks TO anon;
GRANT ALL    ON api.daily_picks TO service_role;
GRANT ALL    ON SEQUENCE api.daily_picks_id_seq TO service_role;
