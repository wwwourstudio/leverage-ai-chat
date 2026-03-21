/**
 * ADP Refresh Endpoint
 *
 * Scrapes live ADP data from nfc.shgn.com/adp/baseball and persists it to
 * the Supabase `nfbc_adp` table. Called by Vercel Cron at 06:00 UTC daily
 * and by GitHub Actions for manual/scheduled runs.
 *
 * Strategy:
 *  1. Scrape https://nfc.shgn.com/adp/baseball — fetches the TSV download, no API key needed.
 *  2. If scrape succeeds and returns ≥ 50 players → save to Supabase (overwrites stale data).
 *  3. If scrape fails → only seed from static fallback when Supabase is empty
 *     (preserves any previously-scraped or user-uploaded board).
 *
 * Auth: validated by CRON_SECRET header (set via Vercel environment variable).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getADPData,
  parseTSV,
  saveADPToSupabase,
  loadADPFromSupabase,
  clearADPCache,
  type NFBCPlayer,
} from '@/lib/adp-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Scraper ────────────────────────────────────────────────────────────────────

const SHGN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; LeverageAI/1.0; +https://leverage.ai)',
  Accept: 'text/tab-separated-values, text/csv, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.5',
};

/**
 * Fetch TSV from SHGN and parse with the existing parseTSV() parser.
 *
 * Tries candidate URLs in order; the first response that looks like a valid
 * TSV (contains tabs, has ≥ 2 lines) wins.  Falls back to fetching the HTML
 * page and scanning for a TSV/CSV download link if none of the direct
 * endpoints respond.
 */
async function scrapeShgnADP(): Promise<NFBCPlayer[]> {
  const base = 'https://nfc.shgn.com/adp/baseball';

  // ── 1. Try known TSV endpoint patterns ─────────────────────────────────────
  const candidates = [
    `${base}.tsv`,
    `${base}/download`,
    `${base}/export`,
    `${base}?format=tsv`,
    `${base}?export=1`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: SHGN_HEADERS,
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;

      const text = await res.text();
      if (!text.includes('\t') || text.split('\n').length < 5) continue;

      const players = parseTSV(text);
      if (players.length >= 50) {
        console.log(`[v0] [ADP/scrape] Got ${players.length} players from ${url}`);
        return players;
      }
    } catch {
      // try next candidate
    }
  }

  // ── 2. Fetch HTML and look for a TSV/CSV download link ─────────────────────
  const htmlRes = await fetch(base, {
    headers: { ...SHGN_HEADERS, Accept: 'text/html,*/*' },
    signal: AbortSignal.timeout(12_000),
  });

  if (!htmlRes.ok) {
    throw new Error(`SHGN returned HTTP ${htmlRes.status} ${htmlRes.statusText}`);
  }

  const html = await htmlRes.text();

  // Find href attributes that point to tsv/csv/download/export endpoints
  const linkRe = /href="([^"]*(?:tsv|csv|download|export)[^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html)) !== null) {
    const href = match[1];
    const downloadUrl = href.startsWith('http')
      ? href
      : `https://nfc.shgn.com${href.startsWith('/') ? '' : '/'}${href}`;

    try {
      const dlRes = await fetch(downloadUrl, {
        headers: SHGN_HEADERS,
        signal: AbortSignal.timeout(12_000),
      });
      if (!dlRes.ok) continue;

      const text = await dlRes.text();
      const players = parseTSV(text);
      if (players.length >= 50) {
        console.log(`[v0] [ADP/scrape] Got ${players.length} players from linked file ${downloadUrl}`);
        return players;
      }
    } catch {
      // try next link
    }
  }

  throw new Error('Could not locate SHGN TSV — no candidate URL returned valid data');
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate cron secret — Vercel passes it as the Authorization header
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const results: Record<
    string,
    { seeded: number; skipped: boolean; source: string; error?: string }
  > = {};

  // ── MLB: scrape SHGN live ────────────────────────────────────────────────────
  try {
    let mlbPlayers: NFBCPlayer[] = [];
    let source = 'static_fallback';

    try {
      mlbPlayers = await scrapeShgnADP();
      if (mlbPlayers.length >= 50) {
        source = 'shgn_live';
      } else {
        console.warn(
          `[v0] [ADP/scrape] Only got ${mlbPlayers.length} players from SHGN — falling back`,
        );
        mlbPlayers = [];
      }
    } catch (scrapeErr) {
      const msg = scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr);
      console.warn(`[v0] [ADP/scrape] SHGN scrape failed (will use fallback): ${msg}`);
    }

    if (mlbPlayers.length > 0) {
      // Live scrape succeeded — always overwrite to keep data current
      await saveADPToSupabase(mlbPlayers, 'mlb');
      clearADPCache();
      results.mlb = { seeded: mlbPlayers.length, skipped: false, source };
      console.log(`[v0] [ADP/refresh] MLB: saved ${mlbPlayers.length} players from ${source}`);
    } else {
      // Scrape failed — only seed static if Supabase is empty (don't overwrite good data)
      const existing = await loadADPFromSupabase('mlb', true);
      if (existing && existing.length > 0) {
        results.mlb = { seeded: existing.length, skipped: true, source: 'supabase_existing' };
        console.log(`[v0] [ADP/refresh] MLB: ${existing.length} rows already in DB — skipping static seed`);
      } else {
        const fallback = await getADPData(true);
        await saveADPToSupabase(fallback, 'mlb');
        clearADPCache();
        results.mlb = { seeded: fallback.length, skipped: false, source: 'static_fallback' };
        console.log(`[v0] [ADP/refresh] MLB: seeded ${fallback.length} players from static fallback`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.mlb = { seeded: 0, skipped: false, source: 'error', error: msg };
    console.error('[v0] [ADP/refresh] MLB error:', msg);
  }

  // ── NFL: seed from static (no live source yet) ────────────────────────────────
  try {
    const existing = await loadADPFromSupabase('nfl', true);
    if (existing && existing.length > 0) {
      results.nfl = { seeded: existing.length, skipped: true, source: 'supabase_existing' };
    } else {
      const { getNFLADPData } = await import('@/lib/nfl-adp-data');
      const nflPlayers = await getNFLADPData(true);
      if (nflPlayers.length > 0) {
        await saveADPToSupabase(nflPlayers, 'nfl');
        results.nfl = { seeded: nflPlayers.length, skipped: false, source: 'static_fallback' };
        console.log(`[v0] [ADP/refresh] NFL: seeded ${nflPlayers.length} players from static fallback`);
      } else {
        results.nfl = { seeded: 0, skipped: false, source: 'empty' };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.nfl = { seeded: 0, skipped: false, source: 'error', error: msg };
    console.error('[v0] [ADP/refresh] NFL error:', msg);
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    results,
  });
}
