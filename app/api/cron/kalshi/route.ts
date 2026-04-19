/**
 * GET /api/cron/kalshi
 *
 * Ingest Layer — Kalshi markets refresh.
 * Fetches ALL open Kalshi markets (paginated, up to 1000), filters to
 * SPORTS-ONLY markets using series_ticker prefix matching, and upserts
 * them into api.kalshi_markets for card-generator cache reads.
 *
 * Key fixes vs. prior version:
 *  - 'Prediction Market' removed from filter (it's normalizeCategoryLabel's
 *    default fallback, causing 100% pass rate = filter did nothing)
 *  - Uses fetchAllKalshiMarkets (paginated) instead of limit:100 single page
 *  - Circuit breaker reset at START of run, not after success
 *  - "Cache miss" log no longer fires when useCache:false
 *
 * Vercel Cron schedule: every 5 minutes  (*\/5 * * * *)
 * Auth: CRON_SECRET query param or header
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 30; // increased from 20 — pagination needs extra time

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { db: { schema: 'api' } });
}

// Sports series-ticker prefixes — the ONLY reliable filter for Kalshi sports markets.
// normalizeCategoryLabel() maps these to readable names (NBA, MLB, etc.) but
// seriesTicker is the ground truth. We check both for belt-and-suspenders.
const SPORTS_SERIES_PREFIXES = [
  'NFL', 'NBA', 'MLB', 'NHL', 'NCAAB', 'NCAAF',
  'NASCAR', 'PGA', 'UFC', 'WNBA',
  'KXNFL', 'KXNBA', 'KXMLB', 'KXNHL', 'KXNCAAB', 'KXNCAAF',
  'KXNASCAR', 'KXPGA', 'KXUFC', 'KXWNBA', 'KXMMA', 'KXBOXING',
  'KXF1', 'KXGOLF', 'KXTENNIS', 'KXSOCCER',
];

// Normalized category strings that indicate a sports market
const SPORTS_CATEGORIES = new Set([
  'NFL', 'NBA', 'MLB', 'NHL',
  'NCAAB', 'College Basketball', 'NCAAF', 'College Football',
  'NASCAR', 'Golf', 'Formula 1', 'MMA', 'Boxing', 'WNBA',
  'Soccer', 'Tennis',
  'Sports', 'Baseball', 'Basketball', 'Football', 'Hockey',
]);

function isSportsMarket(m: { seriesTicker?: string; category?: string }): boolean {
  const series = (m.seriesTicker || '').toUpperCase();
  if (SPORTS_SERIES_PREFIXES.some(p => series.startsWith(p))) return true;
  return SPORTS_CATEGORIES.has(m.category || '');
}

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
    const { fetchAllKalshiMarkets, resetKalshiCircuitBreaker } = await import('@/lib/kalshi/index');

    // Reset the circuit breaker at the START of each cron run.
    // Rationale: crons are scheduled by Vercel — if the invocation fired, the API
    // is worth trying regardless of prior failures in the same Lambda instance.
    // Prior to this fix, resetKalshiCircuitBreaker() was called AFTER a successful
    // fetch, meaning an open breaker would block the fetch and never self-recover.
    resetKalshiCircuitBreaker();

    // Paginate through ALL open markets (up to 1000) instead of the previous
    // limit:100 single-page fetch. Sports markets for less-popular games
    // appear on pages 2–10 (Kalshi sorts by volume descending).
    const allMarkets = await fetchAllKalshiMarkets({ maxMarkets: 1000, useCache: false, status: 'open' });

    if (!allMarkets.length) {
      console.log('[v0] [cron/kalshi] No open markets returned from Kalshi API');
      return NextResponse.json({ ok: true, markets: 0, durationMs: Date.now() - startedAt });
    }

    // Category breakdown — diagnose filter drift in production logs
    const categoryCount: Record<string, number> = {};
    for (const m of allMarkets) {
      const cat = m.category || 'unknown';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
    console.log('[cron/kalshi] Category breakdown:', categoryCount);

    // Strict sports-only filter.
    // Primary check: seriesTicker prefix (ground truth — set by Kalshi).
    // Secondary check: normalized category string from normalizeCategoryLabel().
    // NOTE: 'Prediction Market' is intentionally NOT in this filter — it is
    // normalizeCategoryLabel()'s default fallback for unrecognized tickers,
    // which caused every market to pass the old filter (100% pass rate = no filter).
    const sportsMarkets = allMarkets.filter(isSportsMarket);

    console.log(`[cron/kalshi] ${sportsMarkets.length}/${allMarkets.length} sports markets after filter`);

    if (sportsMarkets.length === 0) {
      // Log sample titles so we can diagnose whether Kalshi changed their naming
      const sample = allMarkets.slice(0, 5).map(
        m => `${m.seriesTicker || '?'}:${m.category || '?'}:"${m.title.slice(0, 40)}"`,
      );
      console.warn('[cron/kalshi] Zero sports markets found. Sample markets:', sample);
      return NextResponse.json({
        ok: true,
        markets: 0,
        total: allMarkets.length,
        warning: 'No sports markets found — check seriesTicker prefix list',
        durationMs: Date.now() - startedAt,
      });
    }

    const now = new Date().toISOString();
    const rows = sportsMarkets.map(m => ({
      market_id:  m.ticker,
      title:      m.title,
      category:   m.category ?? null,
      yes_price:  m.yesPrice  != null ? m.yesPrice  / 100 : null,
      no_price:   m.noPrice   != null ? m.noPrice   / 100 : null,
      volume:     m.volume    ?? null,
      close_time: m.closeTime ?? null,
      cached_at:  now,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }));

    const supabase = getServiceClient();
    const { error } = await supabase
      .from('kalshi_markets')
      .upsert(rows, { onConflict: 'market_id' });

    if (error) {
      console.error('[cron/kalshi] Upsert error:', error);
      return NextResponse.json(
        { ok: false, error: error.message, durationMs: Date.now() - startedAt },
        { status: 500 },
      );
    }

    console.log(`[cron/kalshi] Upserted ${rows.length} sports markets in ${Date.now() - startedAt}ms`);

    return NextResponse.json({
      ok: true,
      markets: rows.length,
      total: allMarkets.length,
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
