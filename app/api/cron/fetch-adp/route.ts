/**
 * /api/cron/fetch-adp — alias for /api/adp/refresh
 *
 * pg_cron calls this path; the canonical handler lives at /api/adp/refresh.
 * Route segment config must be declared directly (Turbopack constraint).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export { GET } from '@/app/api/adp/refresh/route';
