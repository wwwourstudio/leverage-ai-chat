-- =============================================================================
-- Fix: Enable RLS on api.backup_live_odds
-- Lint: "RLS Disabled in Public Entity: api.backup_live_odds"
-- =============================================================================
-- backup_live_odds is a snapshot copy of live_odds_cache (shared market data,
-- no user_id column). Access model mirrors the primary table and all sport-
-- specific odds tables (mlb_odds, nfl_odds, nba_odds, nhl_odds):
--   • SELECT — public (anon + authenticated) — odds are not sensitive
--   • INSERT / UPDATE / DELETE — service_role only (cron / odds fetcher)
-- =============================================================================

-- Step 1: Enable RLS (idempotent — no-op if already enabled)
ALTER TABLE api.backup_live_odds ENABLE ROW LEVEL SECURITY;

-- Step 2: Public read access
DROP POLICY IF EXISTS "backup_live_odds_read" ON api.backup_live_odds;
CREATE POLICY "backup_live_odds_read"
  ON api.backup_live_odds
  FOR SELECT
  USING (true);

-- Step 3: Restrict writes to service_role only
DROP POLICY IF EXISTS "backup_live_odds_write" ON api.backup_live_odds;
CREATE POLICY "backup_live_odds_write"
  ON api.backup_live_odds
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
  AND c.relname = 'backup_live_odds'
ORDER BY p.polname;

DO $$
BEGIN
  RAISE NOTICE 'RLS enabled on api.backup_live_odds with read=public, write=service_role.';
END $$;
