/**
 * GET /api/adp/refresh
 *
 * Seeds Supabase nfbc_adp with live ADP from FantasyPros and ESPN.
 * Called by Vercel Cron at 06:00 UTC daily.
 *
 * Strategy for each sport:
 *  1. Try FantasyPros CSV export (consensus ADP, most widely-used source).
 *  2. If FantasyPros fails, try ESPN Fantasy JSON API.
 *  3. If both live sources fail and DB is empty, seed from static fallback.
 *
 * Live data always overwrites stale cron-seeded rows so ADP stays current.
 * Scraper logic lives in lib/adp-fetcher.server.ts (shared with on-demand path).
 *
 * Auth: validated by CRON_SECRET header (Vercel env var).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getADPData,
  saveADPToSupabase,
  loadADPFromSupabase,
  clearADPCache,
} from '@/lib/adp-data';
import { fetchLiveADP } from '@/lib/adp-fetcher.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const results: Record<string, { seeded: number; skipped: boolean; source: string; error?: string }> = {};

  for (const sport of ['mlb', 'nfl'] as const) {
    try {
      let source: string;
      let players;

      try {
        const live = await fetchLiveADP(sport);
        players = live.players;
        source  = live.source;
      } catch (liveErr) {
        // Both live sources failed — only seed static if DB is empty
        console.warn(`[v0] [ADP/refresh] Both live sources failed for ${sport.toUpperCase()}:`, liveErr instanceof Error ? liveErr.message : liveErr);
        const existing = await loadADPFromSupabase(sport, true);
        if (existing && existing.length > 0) {
          results[sport] = { seeded: existing.length, skipped: true, source: 'supabase_existing' };
          console.log(`[v0] [ADP/refresh] ${sport.toUpperCase()}: DB has ${existing.length} rows — keeping existing`);
          continue;
        }
        // DB is also empty — seed static fallback
        if (sport === 'nfl') {
          const { getNFLADPData } = await import('@/lib/nfl-adp-data');
          players = await getNFLADPData(true);
        } else {
          players = await getADPData(true);
        }
        source = 'static_fallback';
      }

      if (players.length > 0) {
        await saveADPToSupabase(players, sport);
        clearADPCache();
        results[sport] = { seeded: players.length, skipped: false, source };
        console.log(`[v0] [ADP/refresh] ${sport.toUpperCase()}: saved ${players.length} players from ${source}`);
      } else {
        results[sport] = { seeded: 0, skipped: false, source: 'empty' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[sport] = { seeded: 0, skipped: false, source: 'error', error: msg };
      console.error(`[v0] [ADP/refresh] ${sport.toUpperCase()} error:`, msg);
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    results,
  });
}
