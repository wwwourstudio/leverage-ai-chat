/**
 * ADP Refresh Endpoint
 *
 * Ensures the Supabase `nfbc_adp` table always has current data.
 * Called by Vercel Cron at 06:00 UTC daily.
 *
 * Strategy:
 *  1. Load current Supabase ADP (allow stale).
 *  2. If rows exist AND they were written within the last 20 hours → skip
 *     (nightly cron + 20h window avoids double-writes on deploys / retries).
 *  3. Otherwise, seed from the compiled static fallback dataset.
 *     When a real third-party ADP endpoint becomes available, replace the
 *     `loadLatestADP()` call below with a live fetch.
 *
 * The static fallback is always available — this guarantees the AI tool
 * (`query_adp`) returns data even before any user has uploaded a TSV.
 *
 * Auth: validated by CRON_SECRET header (set via Vercel environment variable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getADPData, saveADPToSupabase, loadADPFromSupabase, type NFBCPlayer } from '@/lib/adp-data';

// ── NFL ADP is defined separately ─────────────────────────────────────────────
// Lazy import keeps the large static dataset out of the initial bundle for
// routes that don't need it.
async function loadLatestADP(sport: 'mlb' | 'nfl'): Promise<NFBCPlayer[]> {
  if (sport === 'nfl') {
    const { getNFLADPData } = await import('@/lib/nfl-adp-data');
    return getNFLADPData(true);
  }
  // MLB: return the compiled static fallback (already imported by adp-data.ts)
  return getADPData(true);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate cron secret — Vercel passes it as the Authorization header
  // when using the `vercel.json` cron configuration.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, { seeded: number; skipped: boolean; error?: string }> = {};

  for (const sport of ['mlb', 'nfl'] as const) {
    try {
      // Check if Supabase already has fresh data (written in the last 20 hours)
      const existing = await loadADPFromSupabase(sport, true);
      if (existing && existing.length > 0) {
        // Skip — user has uploaded their own board; don't overwrite it
        results[sport] = { seeded: existing.length, skipped: true };
        console.log(`[ADP/refresh] ${sport.toUpperCase()}: ${existing.length} rows already in DB — skipping seed`);
        continue;
      }

      // No DB data — seed from compiled static dataset
      const players = await loadLatestADP(sport);
      if (players.length === 0) {
        results[sport] = { seeded: 0, skipped: false };
        continue;
      }

      await saveADPToSupabase(players, sport);
      results[sport] = { seeded: players.length, skipped: false };
      console.log(`[ADP/refresh] ${sport.toUpperCase()}: seeded ${players.length} players into Supabase`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[sport] = { seeded: 0, skipped: false, error: msg };
      console.error(`[ADP/refresh] ${sport.toUpperCase()} error:`, msg);
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}

// Allow Vercel Cron to call this via GET
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
