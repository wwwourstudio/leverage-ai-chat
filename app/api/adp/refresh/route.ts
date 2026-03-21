/**
 * GET /api/adp/refresh
 *
 * Ensures the Supabase `nfbc_adp` table always has current data.
 * Called by Vercel Cron at 06:00 UTC daily and by GitHub Actions.
 *
 * Strategy:
 *  1. If Supabase already has rows for the sport → skip (preserve user-uploaded data).
 *  2. Otherwise seed from the compiled static fallback dataset so the AI
 *     query_adp tool always returns something meaningful.
 *
 * Note: nfc.shgn.com uses a JavaScript-triggered download button with no
 * server-accessible URL.  Live ADP data must be uploaded manually via the
 * ADP upload UI (POST /api/adp/upload) after downloading the TSV from SHGN.
 *
 * Auth: validated by CRON_SECRET header (set via Vercel environment variable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getADPData, saveADPToSupabase, loadADPFromSupabase, clearADPCache } from '@/lib/adp-data';

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

  // ── MLB ───────────────────────────────────────────────────────────────────────
  try {
    const existing = await loadADPFromSupabase('mlb', true);
    if (existing && existing.length > 0) {
      results.mlb = { seeded: existing.length, skipped: true, source: 'supabase_existing' };
      console.log(`[v0] [ADP/refresh] MLB: ${existing.length} rows already in DB — skipping seed`);
    } else {
      const players = await getADPData(true);
      await saveADPToSupabase(players, 'mlb');
      clearADPCache();
      results.mlb = { seeded: players.length, skipped: false, source: 'static_fallback' };
      console.log(`[v0] [ADP/refresh] MLB: seeded ${players.length} players from static fallback`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.mlb = { seeded: 0, skipped: false, source: 'error', error: msg };
    console.error('[v0] [ADP/refresh] MLB error:', msg);
  }

  // ── NFL ───────────────────────────────────────────────────────────────────────
  try {
    const existing = await loadADPFromSupabase('nfl', true);
    if (existing && existing.length > 0) {
      results.nfl = { seeded: existing.length, skipped: true, source: 'supabase_existing' };
    } else {
      const { getNFLADPData } = await import('@/lib/nfl-adp-data');
      const players = await getNFLADPData(true);
      if (players.length > 0) {
        await saveADPToSupabase(players, 'nfl');
        results.nfl = { seeded: players.length, skipped: false, source: 'static_fallback' };
        console.log(`[v0] [ADP/refresh] NFL: seeded ${players.length} players from static fallback`);
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
