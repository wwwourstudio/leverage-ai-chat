-- Fix: /api/cron/kalshi returning 401
--
-- Root cause: A pg_cron job was calling /api/cron/kalshi (or /api/cron/fetch-kalshi)
-- via net.http_get() without an Authorization header. Once CRON_SECRET was set in
-- the Vercel environment, every call from that job started failing with 401.
--
-- This script:
--   1. Removes the old (unauthenticated) pg_cron HTTP job
--   2. Re-creates it with the CRON_SECRET passed as a query param (?secret=...)
--      so verifyCronSecret() accepts the request.
--
-- BEFORE RUNNING:
--   Replace  <YOUR_CRON_SECRET>  below with the actual value of CRON_SECRET
--   from your Vercel project's Environment Variables.
--   (Vercel Dashboard → Project → Settings → Environment Variables → CRON_SECRET)
-- ============================================================================

-- Step 1: Remove any existing HTTP-based pg_cron jobs that call the Kalshi endpoint.
--         Run the SELECT first to see which names exist, then unschedule accordingly.
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE command ILIKE '%kalshi%' OR jobname ILIKE '%kalshi%'
ORDER BY jobname;

-- Unschedule common job names (safe to run even if the job doesn't exist):
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE (jobname ILIKE '%kalshi%' OR command ILIKE '%cron/kalshi%' OR command ILIKE '%fetch-kalshi%')
  AND command NOT ILIKE '%DELETE%';   -- don't touch the cleanup-kalshi DELETE job

-- Step 2: Re-create the Kalshi refresh job with proper auth.
--         Runs every 15 minutes. Replace <YOUR_CRON_SECRET> with the real value.
SELECT cron.schedule(
  'fetch-kalshi',
  '*/15 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://v0-leverage-ai-chat.vercel.app/api/cron/fetch-kalshi?secret=<YOUR_CRON_SECRET>',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Step 3: Verify — the new job should appear with the updated command
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname = 'fetch-kalshi';

-- Step 4: Confirm the cleanup job (SQL DELETE, no auth needed) is still intact
SELECT jobname, schedule FROM cron.job WHERE jobname = 'cleanup-kalshi';
