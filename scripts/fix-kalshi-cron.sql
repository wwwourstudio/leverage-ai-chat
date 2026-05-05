-- Fix: /api/cron/kalshi returning 401
--
-- Root cause: A pg_cron job was calling /api/cron/fetch-kalshi (or /api/cron/kalshi)
-- via net.http_get() without an Authorization header. Once CRON_SECRET was set in
-- the Vercel environment, all calls without the secret started returning 401.
--
-- Fix applied in code: /api/cron/kalshi is now listed in vercel.json "crons" so
-- Vercel manages the schedule (every 15 minutes) and automatically injects the
-- Authorization: Bearer <CRON_SECRET> header on every invocation.
--
-- Action required in Supabase: Run this script in the Supabase SQL Editor to
-- remove the old pg_cron HTTP job so it stops producing 401 errors.
-- ============================================================================

-- List all current pg_cron jobs so you can confirm which one is calling the endpoint
SELECT jobid, jobname, schedule, command
FROM cron.job
ORDER BY jobname;

-- Remove any pg_cron job that was calling the Kalshi HTTP endpoint.
-- Common job names used when this was set up:
SELECT cron.unschedule('fetch-kalshi')    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-kalshi');
SELECT cron.unschedule('kalshi-refresh')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kalshi-refresh');
SELECT cron.unschedule('kalshi-ingest')   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kalshi-ingest');
SELECT cron.unschedule('cron-kalshi')     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-kalshi');

-- Verify the cleanup jobs (which are SQL-only and unaffected) are still present:
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'cleanup-%';
-- Expected: cleanup-live-odds, cleanup-arbitrage, cleanup-kalshi, cleanup-line-movement
