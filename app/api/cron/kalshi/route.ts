/**
 * GET /api/cron/kalshi
 *
 * Ingest Layer — Kalshi markets refresh.
 * Fetches open Kalshi markets, filters to sports-related categories, and
 * upserts them into api.kalshi_markets for card-generator cache reads.
 *
 * Vercel Cron schedule: every 5 minutes  (*\/5 * * * *)
 * Auth: CRON_SECRET query param or header
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 20;

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { db: { schema: 'api' } });
}

// Kalshi category strings that map to sports content
const SPORTS_CATEGORIES = new Set([
  'Sports',
  'sports',
  'Baseball',
  'Basketball',
  'Football',
  'Hockey',
  'Soccer',
  'Golf',
  'Tennis',
  'MMA',
  'Boxing',
  'NFL',
  'NBA',
  'MLB',
  'NHL',
  'NCAAB',
  'NCAAF',
]);

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

  // ── Kalshi key guard ────────────────────────────────────────────────────
  const hasKey =
    process.env.KALSHI_ACCESS_KEY ||
    process.env.KALSHI_API_KEY_ID ||
    process.env.KALSHI_API_KEY;
  if (!hasKey) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'KALSHI_API_KEY not set' });
  }

  const startedAt = Date.now();

  try {
    const { getKalshiClient } = await import('@/lib/kalshi/kalshiClient');
    const client = getKalshiClient();

    // Fetch open markets (up to 100 at a time)
    const { markets } = await client.getMarkets({ status: 'open', limit: 100 });

    if (!markets?.length) {
      console.log('[v0] [cron/kalshi] No open markets returned');
      return NextResponse.json({ ok: true, markets: 0, durationMs: Date.now() - startedAt });
    }

    // Filter to sports-related categories
    const sportsMarkets = markets.filter(
      m => m.category && SPORTS_CATEGORIES.has(m.category),
    );

    console.log(`[v0] [cron/kalshi] ${sportsMarkets.length}/${markets.length} sports markets to upsert`);

    if (sportsMarkets.length === 0) {
      // Fallback: upsert all markets if none matched sports category strings
      // (category names may vary by Kalshi API version)
      console.log('[v0] [cron/kalshi] No sports category match — upserting all open markets');
    }

    const targetMarkets = sportsMarkets.length > 0 ? sportsMarkets : markets.slice(0, 50);
    const now = new Date().toISOString();

    const rows = targetMarkets.map(m => ({
      market_id: m.ticker,
      title: m.title,
      category: m.category ?? null,
      yes_price: m.yes_bid != null ? m.yes_bid / 100 : null,   // Kalshi prices are in cents
      no_price: m.no_bid != null ? m.no_bid / 100 : null,
      volume: m.volume ?? null,
      close_time: m.expiration_time ?? null,
      cached_at: now,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }));

    const supabase = getServiceClient();
    const { error } = await supabase
      .from('kalshi_markets')
      .upsert(rows, { onConflict: 'market_id' });

    if (error) {
      console.error('[v0] [cron/kalshi] Upsert error:', error);
      return NextResponse.json(
        { ok: false, error: error.message, durationMs: Date.now() - startedAt },
        { status: 500 },
      );
    }

    console.log(`[v0] [cron/kalshi] Upserted ${rows.length} Kalshi markets in ${Date.now() - startedAt}ms`);

    return NextResponse.json({
      ok: true,
      markets: rows.length,
      durationMs: Date.now() - startedAt,
      runAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[v0] [cron/kalshi] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Kalshi ingest failed', durationMs: Date.now() - startedAt },
      { status: 500 },
    );
  }
}
