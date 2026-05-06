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
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'api' } });
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!getSupabaseUrl() || !getSupabaseServiceKey()) {
    return NextResponse.json({ success: true, skipped: true, reason: 'service-role-not-configured' }, { status: 200 });
  }

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toISOString();

  try {
    const { buildDFSSlateMulti } = await import('@/lib/mlb-projections/slate-builder');

    // Build DraftKings MLB slate (9-player lineup) targeting the Main slate.
    const multi = await buildDFSSlateMulti({ limit: 9, date: today });
    const slate = multi.slateForCard;
    const draftGroupId = multi.metadata.slate?.draftGroupId;

    if (!slate || slate.length === 0) {
      console.warn(
        `[v0] [cron/dfs] No DFS slate generated — degradedMode=${multi.metadata.degradedMode === true}` +
        (multi.metadata.degradedReason ? ` reason="${multi.metadata.degradedReason}"` : ''),
      );
      return NextResponse.json({
        success: true,
        note: multi.metadata.degradedMode
          ? 'DraftKings feed unavailable — no contest-validated lineup built'
          : multi.metadata.insufficientPool
            ? 'Slate pool too thin to build a full lineup'
            : 'No DFS slate available — no games or projections',
        players: 0,
        draftGroupId: draftGroupId ?? null,
        degradedMode: multi.metadata.degradedMode === true,
        durationMs: Date.now() - startedAt,
        timestamp,
      });
    }

    console.log(
      `[v0] [cron/dfs] Built DFS slate with ${slate.length} players (slate=${multi.metadata.slate?.slateLabel ?? 'unknown'} #${draftGroupId ?? '—'}) in ${Date.now() - startedAt}ms`,
    );

    // Persist to app_settings so read paths don't need to re-run the model.
    // Cache key includes the draftGroupId so multiple slates can coexist; the
    // canonical `dfs_slate_today` row mirrors the Main slate.
    const supabase = getServiceClient()!;
    const payload = JSON.stringify({
      date: today,
      players: slate,
      generatedAt: timestamp,
      slate: multi.metadata.slate ?? null,
      degradedMode: multi.metadata.degradedMode === true,
    });
    const writes = [
      supabase.from('app_settings').upsert({ key: 'dfs_slate_today', value: payload }, { onConflict: 'key' }),
    ];
    if (draftGroupId != null) {
      writes.push(
        supabase.from('app_settings').upsert(
          { key: `dfs_slate_${today}_${draftGroupId}`, value: payload },
          { onConflict: 'key' },
        ),
      );
    }
    const writeResults = await Promise.all(writes);
    const error = writeResults.find(r => r.error)?.error;

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
