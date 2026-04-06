/**
 * GET /api/cron/kalshi
 *
 * Ingest Layer — Kalshi markets refresh.
 * Fetches open Kalshi markets, filters to tracked categories (sports +
 * politics + finance + crypto + weather + entertainment), and upserts
 * them into api.kalshi_markets for card-generator cache reads.
 *
 * Uses fetchKalshiMarkets() from lib/kalshi/index.ts so markets are
 * normalised through parseMarket() / normalizeCategoryLabel() before
 * category matching — raw Kalshi API returns empty category strings and
 * relies on series_ticker (e.g. "KXMLB25APR6-Y1") for identification.
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

// ── Tracked category strings (normalizeCategoryLabel() output) ─────────────
// Includes every label that normalizeCategoryLabel() can return so no live
// market type is silently dropped.  Extend this set if Kalshi adds new
// series prefixes and normalizeCategoryLabel() is updated accordingly.
const TRACKED_CATEGORIES = new Set([
  // Sports — individual leagues
  'NFL', 'NBA', 'MLB', 'NHL',
  'NCAAB', 'College Basketball', 'NCAAF', 'College Football',
  'NASCAR', 'Golf', 'Formula 1', 'MMA', 'Boxing', 'WNBA',
  'Soccer', 'Tennis',
  // Broader sports strings (raw API fallback values)
  'Sports', 'sports', 'Baseball', 'Basketball', 'Football', 'Hockey',
  // Politics
  'Politics', 'politics', 'Elections', 'elections', 'Government', 'government',
  // Finance / Economics / Crypto
  'Finance', 'finance', 'Crypto', 'crypto', 'Economics', 'economics',
  // Other normalizeCategoryLabel outputs
  'Weather', 'Entertainment', 'Prediction Market',
]);

// ── Political series-ticker prefixes (belt-and-suspenders fallback) ──────
// Catches political markets when normalizeCategoryLabel() returns 'Politics'
// AND as a direct series_ticker check in case the normalized category
// somehow diverges from the expected value.
const POLITICAL_SERIES_PREFIXES = [
  'KXUSSENATE',
  'KXUSHOUSE',
  'KXUSGOV',
  'PRES',
  'POTUS',
];

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
    const { fetchKalshiMarkets, resetKalshiCircuitBreaker } = await import('@/lib/kalshi/index');

    // useCache: false — cron always fetches fresh data; don't pollute the
    // 60 s in-memory cache used by the card generators.
    const markets = await fetchKalshiMarkets({ limit: 100, status: 'open', useCache: false });

    // ── Step 2 instrumentation (temporary debug logs) ───────────────────
    console.log('[kalshi-debug] markets count before filter:', markets.length);
    console.log('[kalshi-debug] sample categories:', markets.slice(0, 5).map(m => m.category));
    console.log('[kalshi-debug] sample statuses:', markets.slice(0, 5).map(m => m.status));

    if (!markets?.length) {
      console.log('[v0] [cron/kalshi] No open markets returned');
      return NextResponse.json({ ok: true, markets: 0, durationMs: Date.now() - startedAt });
    }

    // API is clearly responding — reset circuit breaker if it was open
    resetKalshiCircuitBreaker();

    // Filter to tracked categories.
    //
    // Strategy A: normalized category from parseMarket() / normalizeCategoryLabel()
    //   covers sports leagues (MLB → 'MLB'), crypto (KXBT → 'Crypto'), etc.
    // Strategy B: series_ticker prefix match for political markets — belt-and-suspenders
    //   in case normalizeCategoryLabel produces an unexpected string variant.
    function isTrackedMarket(m: { category?: string; seriesTicker?: string }): boolean {
      if (m.category && TRACKED_CATEGORIES.has(m.category)) return true;
      if (m.seriesTicker) {
        const s = m.seriesTicker.toUpperCase();
        if (POLITICAL_SERIES_PREFIXES.some(prefix => s.startsWith(prefix))) return true;
      }
      return false;
    }

    const trackedMarkets = markets.filter(isTrackedMarket);

    console.log(`[cron/kalshi] ${trackedMarkets.length}/${markets.length} tracked markets to upsert`);

    if (trackedMarkets.length === 0) {
      // Fallback: upsert all markets with a valid ticker when category matching
      // produces no results.  This can happen transiently while Kalshi changes
      // internal category/series naming — keeps the DB populated either way.
      console.log('[cron/kalshi] No tracked category / series match — upserting all markets as fallback');
    }

    // Widen fallback from first-50 to ALL markets with valid ticker
    const targetMarkets = trackedMarkets.length > 0 ? trackedMarkets : markets.filter(m => m.ticker);
    const now = new Date().toISOString();

    // Field names come from lib/kalshi/index.ts KalshiMarket (camelCase, normalized)
    const rows = targetMarkets.map(m => ({
      market_id:  m.ticker,
      title:      m.title,
      category:   m.category ?? null,
      yes_price:  m.yesPrice  != null ? m.yesPrice  / 100 : null,  // yesPrice is 0–99 cents
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

    console.log(`[cron/kalshi] Upserted ${rows.length} Kalshi markets in ${Date.now() - startedAt}ms`);

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
