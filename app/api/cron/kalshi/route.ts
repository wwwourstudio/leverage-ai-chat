/**
 * GET /api/cron/kalshi
 *
 * Ingest Layer — Kalshi markets refresh.
 * Fetches open Kalshi markets, filters to tracked categories (sports +
 * politics + finance), and upserts them into api.kalshi_markets for
 * card-generator cache reads.
 *
 * Category matching uses two complementary strategies:
 *  1. TRACKED_CATEGORIES  — matches the Kalshi `category` string directly.
 *  2. POLITICAL_SERIES    — matches against `series_ticker` for political
 *     markets (KXUSSENATE, KXUSHOUSE, KXUSGOV, PRES, POTUS) which Kalshi
 *     may not label with a "Politics" category string in all API versions.
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

// ── Tracked category strings (Kalshi `category` field) ────────────────────────
// Extend this set whenever Kalshi introduces new category label variants.
const TRACKED_CATEGORIES = new Set([
  // Sports
  'Sports', 'sports',
  'Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer',
  'Golf', 'Tennis', 'MMA', 'Boxing', 'NFL', 'NBA', 'MLB', 'NHL',
  'NCAAB', 'NCAAF',
  // Politics — Kalshi uses these strings inconsistently across API versions;
  // the POLITICAL_SERIES prefix allowlist below is the canonical path for
  // political markets (series_ticker is always populated and exact).
  'Politics', 'politics', 'Elections', 'elections',
  'Government', 'government',
]);

// ── Political series-ticker prefixes ─────────────────────────────────────────
// Kalshi political markets always carry one of these series_ticker prefixes.
// This list is the authoritative allowlist — it catches markets regardless of
// what the `category` field says, and bypasses the hex-segment quality filter
// in lib/kalshi/index.ts for known-valid political event tickers.
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
    const { getKalshiClient } = await import('@/lib/kalshi/kalshiClient');
    const client = getKalshiClient();

    // Fetch open markets (up to 100 at a time)
    const { markets } = await client.getMarkets({ status: 'open', limit: 100 });

    if (!markets?.length) {
      console.log('[v0] [cron/kalshi] No open markets returned');
      return NextResponse.json({ ok: true, markets: 0, durationMs: Date.now() - startedAt });
    }

    // Filter to tracked categories (sports + politics + finance).
    //
    // Strategy A: direct `category` field match against TRACKED_CATEGORIES.
    // Strategy B: series_ticker prefix match against POLITICAL_SERIES_PREFIXES —
    //   this is the reliable path for political markets; the `category` field is
    //   not consistently populated for political markets across Kalshi API versions.
    function isTrackedMarket(m: { category?: string; series_ticker?: string }): boolean {
      if (m.category && TRACKED_CATEGORIES.has(m.category)) return true;
      if (m.series_ticker) {
        const s = m.series_ticker.toUpperCase();
        if (POLITICAL_SERIES_PREFIXES.some(prefix => s.startsWith(prefix))) return true;
      }
      return false;
    }

    const trackedMarkets = markets.filter(isTrackedMarket);

    console.log(`[cron/kalshi] ${trackedMarkets.length}/${markets.length} tracked markets to upsert`);

    if (trackedMarkets.length === 0) {
      // Fallback: upsert a broad slice if neither the category nor any political
      // series prefix matched. This can happen when Kalshi changes internal field
      // names; the fallback ensures the DB is never completely empty after a run.
      console.log('[cron/kalshi] No tracked category / series match — upserting first 50 open markets as fallback');
    }

    const targetMarkets = trackedMarkets.length > 0 ? trackedMarkets : markets.slice(0, 50);
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
