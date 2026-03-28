/**
 * GET /api/cron/weather
 *
 * Ingest Layer — Weather data refresh for today's outdoor MLB games.
 * Reads today's scheduled games from `api.mlb_games`, fetches weather
 * forecasts from Open-Meteo (no API key required) for each outdoor venue,
 * and writes the forecast back to `mlb_games.weather` (jsonb).
 *
 * pg_cron schedule: every 6 hours  (refresh-weather)
 * Auth: CRON_SECRET query param or x-cron-secret / Authorization header
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
  const today = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toISOString();

  try {
    const { getGameTimeForecast } = await import('@/lib/weather/index');
    const supabase = getServiceClient();

    // Load today's games that have a known home team (need team name for stadium lookup)
    const { data: games, error: gamesErr } = await supabase
      .from('mlb_games')
      .select('id, home_team, away_team, start_time, venue')
      .eq('game_date', today)
      .not('home_team', 'is', null);

    if (gamesErr) {
      console.error('[v0] [cron/weather] Failed to load games:', gamesErr.message);
      return NextResponse.json(
        { ok: false, error: `DB read failed: ${gamesErr.message}`, durationMs: Date.now() - startedAt, timestamp },
        { status: 500 },
      );
    }

    if (!games || games.length === 0) {
      console.log('[v0] [cron/weather] No games scheduled today');
      return NextResponse.json({
        ok: true,
        note: 'No games scheduled today',
        updated: 0,
        durationMs: Date.now() - startedAt,
        timestamp,
      });
    }

    let updated = 0;
    let skipped = 0;

    // Fetch and persist weather for each game (serial to avoid hammering Open-Meteo)
    for (const game of games) {
      const gameTime = game.start_time ? new Date(game.start_time) : new Date();

      try {
        const forecast = await getGameTimeForecast(game.home_team, gameTime);

        if (!forecast) {
          // Stadium not found or domed — skip silently
          skipped++;
          continue;
        }

        const { error: updateErr } = await supabase
          .from('mlb_games')
          .update({ weather: forecast, updated_at: new Date().toISOString() })
          .eq('id', game.id);

        if (updateErr) {
          console.error(
            `[v0] [cron/weather] Update failed for game ${game.id} (${game.away_team} @ ${game.home_team}):`,
            updateErr.message,
          );
        } else {
          updated++;
        }
      } catch (gameErr) {
        console.warn(
          `[v0] [cron/weather] Weather fetch failed for ${game.home_team}:`,
          gameErr instanceof Error ? gameErr.message : gameErr,
        );
        skipped++;
      }
    }

    console.log(
      `[v0] [cron/weather] Updated ${updated}/${games.length} games (${skipped} skipped — domed/unknown) in ${Date.now() - startedAt}ms`,
    );

    return NextResponse.json({
      ok: true,
      games: games.length,
      updated,
      skipped,
      durationMs: Date.now() - startedAt,
      timestamp,
    });
  } catch (err) {
    console.error('[v0] [cron/weather] Fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Weather refresh failed',
        durationMs: Date.now() - startedAt,
        timestamp,
      },
      { status: 500 },
    );
  }
}
