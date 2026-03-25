/**
 * GET /api/cron/kalshi
 *
 * Ingest Layer — Kalshi markets refresh.
 * Fetches live Kalshi prediction market data and persists it to Supabase.
 *
 * Vercel Cron schedule: every 5 minutes  (*\/5 * * * *)
 * Auth: CRON_SECRET query param or header
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const querySecret = req.nextUrl.searchParams.get('secret');
    const headerSecret =
      req.headers.get('authorization')?.replace('Bearer ', '') ??
      req.headers.get('x-cron-secret') ??
      '';
    if (querySecret !== cronSecret && headerSecret !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`;
    const res = await fetch(`${appUrl}/api/kalshi/live`, {
      headers: { 'x-internal-request': '1' },
    });

    if (!res.ok) {
      throw new Error(`Kalshi live endpoint returned ${res.status}`);
    }

    const data = await res.json();

    console.log(`[v0] [cron/kalshi] Fetched Kalshi markets in ${Date.now() - startedAt}ms`);

    return NextResponse.json({
      success: true,
      meta: {
        durationMs: Date.now() - startedAt,
        runAt: new Date().toISOString(),
      },
      data,
    });
  } catch (err) {
    console.error('[v0] [cron/kalshi] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Kalshi ingest failed',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
