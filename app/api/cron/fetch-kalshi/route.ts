/**
 * /api/cron/fetch-kalshi — alias for /api/cron/kalshi
 *
 * pg_cron calls this path; the canonical handler lives at /api/cron/kalshi.
 * Re-exporting keeps auth, Supabase writes, and response shape identical.
 */
export { GET, runtime, maxDuration } from '@/app/api/cron/kalshi/route';
