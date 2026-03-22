/**
 * GET /api/adp/refresh
 *
 * Seeds Supabase nfbc_adp from the local CSV or static fallback data.
 * Called by Vercel Cron at 06:00 UTC daily.
 *
 * Strategy for each sport:
 *  1. If DB already has data, keep it (skip re-seed to avoid unnecessary writes).
 *  2. If DB is empty, seed from the local CSV (public/adp/ADP.csv) via getADPData()
 *     which reads CSV → static fallback in that order.
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

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader  = request.headers.get('authorization');
    const querySecret = request.nextUrl.searchParams.get('secret');
    const validHeader = authHeader === `Bearer ${cronSecret}`;
    const validQuery  = querySecret === cronSecret;
    if (!validHeader && !validQuery) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const results: Record<string, { seeded: number; skipped: boolean; source: string; error?: string }> = {};

  for (const sport of ['mlb', 'nfl'] as const) {
    try {
      // If DB already has data for this sport, keep it — no need to re-seed
      const existing = await loadADPFromSupabase(sport, true);
      if (existing && existing.length > 0) {
        results[sport] = { seeded: existing.length, skipped: true, source: 'supabase_existing' };
        console.log(`[v0] [ADP/refresh] ${sport.toUpperCase()}: DB has ${existing.length} rows — keeping existing`);
        continue;
      }

      // DB is empty — seed from local CSV or static fallback
      let players;
      if (sport === 'nfl') {
        const { getNFLADPData } = await import('@/lib/nfl-adp-data');
        players = await getNFLADPData(true);
      } else {
        players = await getADPData(true);
      }

      if (players.length > 0) {
        await saveADPToSupabase(players, sport);
        clearADPCache();
        results[sport] = { seeded: players.length, skipped: false, source: 'local_csv_or_static' };
        console.log(`[v0] [ADP/refresh] ${sport.toUpperCase()}: seeded ${players.length} players from local data`);
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
