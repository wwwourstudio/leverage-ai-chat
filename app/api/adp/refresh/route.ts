/**
 * ADP Refresh Endpoint
 *
 * Scrapes live ADP data from nfc.shgn.com/adp/baseball and persists it to
 * the Supabase `nfbc_adp` table. Called by Vercel Cron at 06:00 UTC daily
 * and by GitHub Actions for manual/scheduled runs.
 *
 * Strategy:
 *  1. Scrape https://nfc.shgn.com/adp/baseball (HTML table parse, no API key needed).
 *  2. If scrape succeeds and returns ≥ 50 players → save to Supabase (overwrites stale data).
 *  3. If scrape fails → only seed from static fallback when Supabase is empty
 *     (preserves any previously-scraped or user-uploaded board).
 *
 * Auth: validated by CRON_SECRET header (set via Vercel environment variable).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getADPData,
  saveADPToSupabase,
  loadADPFromSupabase,
  clearADPCache,
  type NFBCPlayer,
} from '@/lib/adp-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── HTML helpers ───────────────────────────────────────────────────────────────

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses the NFC SHGN ADP HTML table into NFBCPlayer records.
 *
 * Column detection is header-driven so it survives minor layout changes.
 * Expected columns (case-insensitive): Rank, Player, Team, Pos, ADP
 * Optional columns: Min, Max, % Drafted
 */
function parseShgnHtml(html: string): NFBCPlayer[] {
  const players: NFBCPlayer[] = [];

  // Find the first <table> that contains ADP data (look for "adp" in the table text)
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  let table = tableMatches.find(t => /adp/i.test(t)) ?? tableMatches[0];
  if (!table) {
    console.warn('[v0] [ADP/scrape] No <table> found in SHGN HTML');
    return players;
  }

  // Extract all <tr> rows
  const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  if (rows.length < 2) {
    console.warn('[v0] [ADP/scrape] Table has fewer than 2 rows');
    return players;
  }

  // ── Parse header row ────────────────────────────────────────────────────────
  const headerCells = (rows[0].match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map(c =>
    stripHtml(c).toLowerCase(),
  );

  const colIdx = (terms: string[]): number =>
    headerCells.findIndex(h => terms.some(t => h.includes(t)));

  const rankIdx   = colIdx(['rank', '#', 'overall']);
  const playerIdx = colIdx(['player', 'name']);
  const teamIdx   = colIdx(['team', 'tm']);
  const posIdx    = colIdx(['pos', 'elig', 'position']);
  const adpIdx    = colIdx(['adp', 'avg pick', 'average']);

  if (playerIdx === -1 || adpIdx === -1) {
    console.warn(
      '[v0] [ADP/scrape] Could not locate Player or ADP column in headers:',
      headerCells,
    );
    return players;
  }

  console.log(`[v0] [ADP/scrape] Column map — rank:${rankIdx} player:${playerIdx} team:${teamIdx} pos:${posIdx} adp:${adpIdx}`);

  // ── Parse data rows ─────────────────────────────────────────────────────────
  for (let i = 1; i < rows.length; i++) {
    const cells = (rows[i].match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map(c =>
      stripHtml(c),
    );
    if (cells.length < 2) continue;

    const rawName  = cells[playerIdx] ?? '';
    const rawAdp   = cells[adpIdx]    ?? '';

    if (!rawName || rawName.toLowerCase() === 'player') continue; // skip sub-headers

    const adp  = parseFloat(rawAdp);
    if (isNaN(adp) || adp <= 0) continue;

    const rank = rankIdx !== -1
      ? parseInt(cells[rankIdx] ?? '', 10) || i
      : i;

    const team      = teamIdx !== -1 ? (cells[teamIdx] ?? '').toUpperCase().trim() : '';
    const positions = posIdx  !== -1 ? (cells[posIdx]  ?? '').trim()               : '';

    // Normalise name: SHGN uses "First Last", also handle "Last, First"
    const displayName = rawName.includes(',')
      ? rawName.split(',').map(s => s.trim()).reverse().join(' ')
      : rawName;

    // playerName stored in "Last, First" for compatibility with existing NFBCPlayer type
    const playerName = rawName.includes(',')
      ? rawName
      : (() => {
          const parts = rawName.trim().split(/\s+/);
          return parts.length >= 2
            ? `${parts.slice(1).join(' ')}, ${parts[0]}`
            : rawName;
        })();

    const safeRank   = rank > 0 ? rank : i;
    const safeAdp    = adp;
    const valueDelta = Math.round((safeAdp - safeRank) * 10) / 10;

    players.push({
      rank:        safeRank,
      playerName,
      displayName,
      adp:         safeAdp,
      positions,
      team,
      valueDelta,
      isValuePick: valueDelta > 15,
    });
  }

  return players.sort((a, b) => a.rank - b.rank);
}

// ── Scraper ────────────────────────────────────────────────────────────────────

async function scrapeShgnADP(): Promise<NFBCPlayer[]> {
  const url = 'https://nfc.shgn.com/adp/baseball';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LeverageAI/1.0; +https://leverage.ai)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    // 15-second hard timeout — Vercel function max is 30s
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`SHGN returned HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  console.log(`[v0] [ADP/scrape] Fetched ${html.length} bytes from SHGN`);

  const players = parseShgnHtml(html);
  console.log(`[v0] [ADP/scrape] Parsed ${players.length} players from SHGN HTML`);

  return players;
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
