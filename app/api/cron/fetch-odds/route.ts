/**
 * /api/cron/fetch-odds — alias for /api/cron/odds
 *
 * pg_cron calls this path; the canonical handler lives at /api/cron/odds.
 * Re-exporting keeps auth, Supabase writes, and response shape identical.
 */
export { GET, runtime, maxDuration } from '@/app/api/cron/odds/route';
