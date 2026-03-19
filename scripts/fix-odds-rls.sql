-- =============================================================================
-- Fix: Enable RLS on api.odds
-- Lint: "RLS Disabled in Public Entity: api.odds"
-- =============================================================================
-- api.odds stores per-bookmaker odds snapshots (sport, market_type, bookmaker,
-- odds JSONB) linked to api.games via game_id. No user_id column —
-- shared catalog data, not user-owned.
-- Access model mirrors live_odds_cache, api.markets, and all sport-specific
-- odds tables (mlb_odds, nfl_odds, nba_odds, nhl_odds):
--   • SELECT — public (anon + authenticated) — odds data is not sensitive
--   • INSERT / UPDATE / DELETE — service_role only (cron / ingest jobs)
-- =============================================================================

-- Step 1: Enable RLS (idempotent — no-op if already enabled)
ALTER TABLE api.odds ENABLE ROW LEVEL SECURITY;

-- Step 2: Public read access
DROP POLICY IF EXISTS "odds_read" ON api.odds;
CREATE POLICY "odds_read"
  ON api.odds
  FOR SELECT
  USING (true);

-- Step 3: Restrict writes to service_role only
DROP POLICY IF EXISTS "odds_write" ON api.odds;
CREATE POLICY "odds_write"
  ON api.odds
  FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- Verify
-- =============================================================================
SELECT
  c.relname                                          AS table_name,
  c.relrowsecurity                                   AS rls_enabled,
  p.polname                                          AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    ELSE 'ALL'
  END                                                AS command,
  pg_get_expr(p.polqual, p.polrelid)                AS using_expr
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'api'
  AND c.relname = 'odds'
ORDER BY p.polname;

DO $$
BEGIN
  RAISE NOTICE 'RLS enabled on api.odds with read=public, write=service_role.';
END $$;
