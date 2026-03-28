/**
 * GET /api/cron/statcast
 *
 * Ingest Layer — Daily Statcast leaderboard refresh.
 * Fetches season-level hitter and pitcher Statcast metrics from Baseball Savant
 * (public, no API key required) and upserts into `api.statcast_current`.
 *
 * pg_cron schedule: daily at 07:00 UTC  (fetch-statcast-daily)
 * Auth: CRON_SECRET query param or x-cron-secret / Authorization header
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 45;

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error('Supabase service role not configured');
  return createClient(url, key, { db: { schema: 'api' } });
}

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
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const season = new Date().getFullYear();
  const fetchedAt = new Date().toISOString();

  try {
    const { fetchStatcastHitters, fetchStatcastPitchers } = await import(
      '@/lib/mlb-projections/statcast-client'
    );

    // Fetch both leaderboards in parallel (Baseball Savant public endpoint)
    const [hitters, pitchers] = await Promise.all([
      fetchStatcastHitters(100).catch((err: unknown) => {
        console.error('[v0] [cron/statcast] fetchStatcastHitters error:', err);
        return [] as Awaited<ReturnType<typeof fetchStatcastHitters>>;
      }),
      fetchStatcastPitchers(60).catch((err: unknown) => {
        console.error('[v0] [cron/statcast] fetchStatcastPitchers error:', err);
        return [] as Awaited<ReturnType<typeof fetchStatcastPitchers>>;
      }),
    ]);

    console.log(
      `[v0] [cron/statcast] Fetched ${hitters.length} hitters, ${pitchers.length} pitchers in ${Date.now() - startedAt}ms`,
    );

    if (hitters.length === 0 && pitchers.length === 0) {
      return NextResponse.json({
        ok: true,
        note: 'Baseball Savant returned no data — likely off-season',
        hitters: 0,
        pitchers: 0,
        durationMs: Date.now() - startedAt,
        timestamp: fetchedAt,
      });
    }

    const supabase = getServiceClient();

    // Build upsert rows for hitters
    const hitterRows = hitters.map((h) => ({
      player_id: String(h.playerId),
      player_name: h.playerName,
      player_type: 'hitter',
      season,
      pa: h.pa ?? null,
      barrel_rate: h.barrelPct ?? null,
      hard_hit_pct: h.hardHitPct ?? null,
      avg_exit_velocity: h.avgExitVelocity ?? null,
      launch_angle: h.launchAngle ?? null,
      sweet_spot_pct: h.sweetSpotPct ?? null,
      xba: h.xBA ?? null,
      xslg: h.xSLG ?? null,
      woba: null,
      xwoba: h.xwOBA ?? null,
      data_source: 'baseball_savant',
      fetched_at: fetchedAt,
    }));

    // Build upsert rows for pitchers
    const pitcherRows = pitchers.map((p) => ({
      player_id: String(p.playerId),
      player_name: p.playerName,
      player_type: 'pitcher',
      season,
      pa: null,
      barrel_rate: null,
      hard_hit_pct: null,
      avg_exit_velocity: p.avgVelocity ?? null,
      launch_angle: null,
      sweet_spot_pct: null,
      xba: null,
      xslg: null,
      woba: null,
      xwoba: null,
      data_source: 'baseball_savant',
      fetched_at: fetchedAt,
    }));

    const allRows = [...hitterRows, ...pitcherRows];
    let upserted = 0;
    let errors = 0;

    // Upsert in batches of 100 — unique on (player_id, player_type, season)
    const BATCH = 100;
    for (let i = 0; i < allRows.length; i += BATCH) {
      const { error } = await supabase
        .from('statcast_current')
        .upsert(allRows.slice(i, i + BATCH), {
          onConflict: 'player_id,player_type,season',
        });

      if (error) {
        console.error(`[v0] [cron/statcast] Upsert batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
        errors += Math.min(BATCH, allRows.length - i);
      } else {
        upserted += Math.min(BATCH, allRows.length - i);
      }
    }

    console.log(
      `[v0] [cron/statcast] Upserted ${upserted} rows (${errors} errors) in ${Date.now() - startedAt}ms`,
    );

    return NextResponse.json({
      ok: true,
      hitters: hitters.length,
      pitchers: pitchers.length,
      upserted,
      errors,
      durationMs: Date.now() - startedAt,
      timestamp: fetchedAt,
    });
  } catch (err) {
    console.error('[v0] [cron/statcast] Fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Statcast ingest failed',
        durationMs: Date.now() - startedAt,
        timestamp: fetchedAt,
      },
      { status: 500 },
    );
  }
}
