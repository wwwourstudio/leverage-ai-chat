-- ============================================================================
-- FIX: Missing api.user_alerts and api.user_credits tables
-- Run this in Supabase SQL Editor if you see 404 errors for these tables.
-- These tables are defined in master-schema.sql but may not exist yet if the
-- full migration has not been run against this Supabase project.
-- ============================================================================

SET search_path TO api;

-- ── user_alerts ─────────────────────────────────────────────────────────────
-- Stores per-user alert configurations (odds changes, line movement, etc.)

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

ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if re-running
DROP POLICY IF EXISTS "Own alerts only" ON user_alerts;
CREATE POLICY "Own alerts only" ON user_alerts FOR ALL USING (auth.uid() = user_id);

-- ── user_credits ─────────────────────────────────────────────────────────────
-- Tracks purchased credit balance per user (incremented by Stripe webhook)

CREATE TABLE IF NOT EXISTS api.user_credits (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE api.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can read own credits"       ON api.user_credits;
DROP POLICY IF EXISTS "Service role can manage credits" ON api.user_credits;

CREATE POLICY "User can read own credits"
  ON api.user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credits"
  ON api.user_credits FOR ALL
  USING (auth.role() = 'service_role');

-- RPC helper for atomic credit increments (used by Stripe webhook)
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

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Add user_alerts to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_alerts;
  END IF;
END $$;
