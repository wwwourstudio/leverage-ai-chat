-- ============================================================================
-- MIGRATION: Fix user_alerts schema + add expired-row cleanup jobs
-- Run ONCE in Supabase SQL Editor (safe to re-run — all statements are idempotent)
-- ============================================================================

-- 1. Add notify_channels column to user_alerts
--    Stores delivery channels as a text array (e.g. ['in_app', 'webhook', 'email']).
--    Defaults to in_app so existing rows are unaffected.
ALTER TABLE api.user_alerts
  ADD COLUMN IF NOT EXISTS notify_channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'];

-- 2. Expand alert_type CHECK constraint to include 'market_intelligence'
--    Postgres requires DROP + re-ADD to modify a CHECK constraint.
ALTER TABLE api.user_alerts
  DROP CONSTRAINT IF EXISTS user_alerts_alert_type_check;
ALTER TABLE api.user_alerts
  ADD CONSTRAINT user_alerts_alert_type_check
  CHECK (alert_type IN (
    'odds_change',
    'line_movement',
    'player_prop',
    'arbitrage',
    'kalshi_price',
    'game_start',
    'market_intelligence'
  ));

-- ============================================================================
-- 3. Expired-row cleanup via pg_cron
--    pg_cron is pre-installed on all Supabase projects.
--    Jobs are idempotent: cron.schedule() replaces an existing job with the same name.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Delete live_odds_cache rows that expired more than 1 hour ago (every hour at :00)
SELECT cron.schedule(
  'cleanup-live-odds',
  '0 * * * *',
  $$DELETE FROM api.live_odds_cache WHERE expires_at < NOW() - INTERVAL '1 hour'$$
);

-- Delete arbitrage_opportunities rows that expired more than 1 hour ago (every hour at :05)
SELECT cron.schedule(
  'cleanup-arbitrage',
  '5 * * * *',
  $$DELETE FROM api.arbitrage_opportunities WHERE expires_at < NOW() - INTERVAL '1 hour'$$
);

-- Delete kalshi_markets rows that expired more than 1 hour ago (every hour at :10)
SELECT cron.schedule(
  'cleanup-kalshi',
  '10 * * * *',
  $$DELETE FROM api.kalshi_markets WHERE expires_at < NOW() - INTERVAL '1 hour'$$
);

-- Keep line_movement to 7 days (no expires_at; uses timestamp column)
-- Runs daily at 02:30 UTC to avoid peak hours
SELECT cron.schedule(
  'cleanup-line-movement',
  '30 2 * * *',
  $$DELETE FROM api.line_movement WHERE timestamp < NOW() - INTERVAL '7 days'$$
);

-- ============================================================================
-- Verification queries — run after applying to confirm success
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'api' AND table_name = 'user_alerts'
--   ORDER BY ordinal_position;
-- → Should include notify_channels

-- SELECT * FROM cron.job WHERE jobname LIKE 'cleanup-%';
-- → Should show 4 cleanup jobs

-- SELECT COUNT(*) FROM api.live_odds_cache WHERE expires_at < NOW();
-- → Should return 0 within an hour of running the first cron job
