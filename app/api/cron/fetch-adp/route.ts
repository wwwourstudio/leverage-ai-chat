/**
 * /api/cron/fetch-adp — alias for /api/adp/refresh
 *
 * pg_cron calls this path; the canonical handler lives at /api/adp/refresh.
 * Re-exporting keeps auth, Supabase writes, and response shape identical.
 */
export { GET, dynamic, maxDuration } from '@/app/api/adp/refresh/route';
