/**
 * /api/cron/fetch-odds — alias for /api/cron/odds
 *
 * pg_cron calls this path; the canonical handler lives at /api/cron/odds.
 * Route segment config must be declared directly (Turbopack constraint).
 */
export const runtime = 'nodejs';
export const maxDuration = 20;
export { GET } from '@/app/api/cron/odds/route';
