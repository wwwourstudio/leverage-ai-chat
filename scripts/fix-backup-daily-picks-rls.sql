-- =============================================================================
-- Fix: Enable RLS on api.backup_daily_picks
-- Lint: "RLS Disabled in Public Entity: api.backup_daily_picks"
-- =============================================================================
-- backup_daily_picks is a snapshot copy of daily_picks (shared catalog data,
-- no user_id column). Access model mirrors the primary table:
--   • SELECT — public (anon + authenticated) — picks are not sensitive
--   • INSERT / UPDATE / DELETE — service_role only (cron / admin)
-- =============================================================================

-- Step 1: Enable RLS (safe even if already enabled — no-op if so)
ALTER TABLE api.backup_daily_picks ENABLE ROW LEVEL SECURITY;

-- Step 2: Allow any role to read rows (picks are public information)
DROP POLICY IF EXISTS "backup_daily_picks_read" ON api.backup_daily_picks;
CREATE POLICY "backup_daily_picks_read"
  ON api.backup_daily_picks
  FOR SELECT
  USING (true);

-- Step 3: Restrict writes to service_role (cron / admin only)
DROP POLICY IF EXISTS "backup_daily_picks_write" ON api.backup_daily_picks;
CREATE POLICY "backup_daily_picks_write"
  ON api.backup_daily_picks
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
  AND c.relname = 'backup_daily_picks'
ORDER BY p.polname;

DO $$
BEGIN
  RAISE NOTICE 'RLS enabled on api.backup_daily_picks with read=public, write=service_role.';
END $$;
