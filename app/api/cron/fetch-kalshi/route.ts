/**
 * /api/cron/fetch-kalshi — alias for /api/cron/kalshi
 *
 * pg_cron calls this path; the canonical handler lives at /api/cron/kalshi.
 * Route segment config must be declared directly (Turbopack constraint).
 */
export const runtime = 'nodejs';
export const maxDuration = 20;
export { GET } from '@/app/api/cron/kalshi/route';
