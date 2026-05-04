/**
 * GET /api/cron/all
 *
 * Consolidated daily cron — runs all data-refresh jobs in parallel.
 * Replace 9 individual Vercel cron entries with this single endpoint
 * to stay within the Hobby plan's cron-job limit.
 *
 * Auth: CRON_SECRET header (same as individual routes)
 * maxDuration: 60s (Hobby plan max)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 60;

const JOBS = [
  '/api/cron/settle',
  '/api/cron/odds',
  '/api/cron/statcast',
  '/api/cron/picks',
  '/api/cron/weather',
  '/api/cron/dfs',
  '/api/cron/projections',
  '/api/cron/kalshi',
  '/api/cron/props',
];

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET ?? '';
  const headers: HeadersInit = secret ? { Authorization: `Bearer ${secret}` } : {};

  // Build the base URL from the incoming request so it works in all environments
  const { origin } = new URL(req.url);

  const startedAt = Date.now();
  const results = await Promise.allSettled(
    JOBS.map(async (path) => {
      const jobStart = Date.now();
      try {
        const res = await fetch(`${origin}${path}`, {
          headers,
          signal: AbortSignal.timeout(50_000),
        });
        const body = await res.json().catch(() => ({}));
        return { path, status: res.status, ok: res.ok, ms: Date.now() - jobStart, body };
      } catch (err) {
        return { path, status: 0, ok: false, ms: Date.now() - jobStart, error: (err as Error).message };
      }
    }),
  );

  const summary = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { path: '?', ok: false, error: r.reason?.message },
  );

  const failed = summary.filter((s) => !s.ok);
  console.log(
    `[v0] [cron/all] Completed ${summary.length} jobs in ${Date.now() - startedAt}ms.` +
      (failed.length ? ` ${failed.length} failed: ${failed.map((f) => f.path).join(', ')}` : ' All OK.'),
  );

  return NextResponse.json({
    success: failed.length === 0,
    jobs: summary,
    durationMs: Date.now() - startedAt,
    runAt: new Date().toISOString(),
  });
}
