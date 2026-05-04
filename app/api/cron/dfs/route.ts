/**
 * GET /api/cron/dfs
 *
 * Ingest Layer — Daily DFS slate refresh.
 * Builds a DraftKings MLB DFS slate using the projection pipeline and caches
 * the result in `api.app_settings` under key `dfs_slate_today` so the UI
 * and card generator can read pre-computed slates without re-running the model.
 *
 * pg_cron schedule: daily at 10:00 UTC  (refresh-dfs-slates)
 * Auth: CRON_SECRET query param or x-cron-secret / Authorization header
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey, verifyCronSecret } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 45;

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { db: { schema: 'api' } });
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toISOString();

  try {
    const { buildDFSSlate } = await import('@/lib/mlb-projections/slate-builder');

    // Build DraftKings MLB slate (9-player lineup)
    const slate = await buildDFSSlate({ limit: 9, date: today });

    if (!slate || slate.length === 0) {
      console.warn('[v0] [cron/dfs] No DFS slate generated — no games today or projections unavailable');
      return NextResponse.json({
        success: true,
        note: 'No DFS slate available — no games or projections',
        players: 0,
        durationMs: Date.now() - startedAt,
        timestamp,
      });
    }

    console.log(`[v0] [cron/dfs] Built DFS slate with ${slate.length} players in ${Date.now() - startedAt}ms`);

    // Persist to app_settings so read paths don't need to re-run the model
    const supabase = getServiceClient();
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'dfs_slate_today',
          value: JSON.stringify({ date: today, players: slate, generatedAt: timestamp }),
        },
        { onConflict: 'key' },
      );

    if (error) {
      // Non-fatal: slate was built, just couldn't persist
      console.error('[v0] [cron/dfs] app_settings upsert error:', error.message);
    }

    return NextResponse.json({
      success: true,
      date: today,
      players: slate.length,
      durationMs: Date.now() - startedAt,
      timestamp,
    });
  } catch (err) {
    console.error('[v0] [cron/dfs] Fatal error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'DFS slate refresh failed',
        durationMs: Date.now() - startedAt,
        timestamp,
      },
      { status: 500 },
    );
  }
}
