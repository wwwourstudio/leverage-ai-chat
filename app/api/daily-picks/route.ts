/**
 * /api/daily-picks
 *
 * GET  — Return saved picks for a date (defaults to today ET).
 *         Query params: date (YYYY-MM-DD), minTier (ELITE|STRONG|LEAN|PASS)
 *
 * POST — Trigger pick generation.
 *         Called by Vercel cron (authenticated via CRON_SECRET header) or
 *         manually for testing.
 *         Body: { date?, minTier?, concurrency? }
 *
 * maxDuration: 60s — pick generation can take up to 45s on a cold call.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { BetTier } from '@/lib/card-pipeline';

export const maxDuration = 60;

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const date    = searchParams.get('date')    ?? undefined;
    const minTier = (searchParams.get('minTier') ?? 'LEAN') as BetTier;

    const { getSavedPicks } = await import('@/lib/picks-engine');
    const picks = await getSavedPicks(date, minTier);

    return NextResponse.json({
      success: true,
      data: picks,
      meta: {
        count:   picks.length,
        date:    date ?? getTodayDateET(),
        minTier,
      },
    });
  } catch (err) {
    console.error('[v0] [API/daily-picks] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load picks' },
      { status: 500 },
    );
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Authenticate cron / admin requests
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const cronHeader = req.headers.get('x-cron-secret');
    const provided   = authHeader?.replace('Bearer ', '') ?? cronHeader ?? '';
    if (provided !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await req.json().catch(() => ({})) as {
      date?:        string;
      minTier?:     BetTier;
      concurrency?: number;
      save?:        boolean;
    };

    const { date, minTier = 'LEAN', concurrency = 5, save = true } = body;

    console.log(`[v0] [API/daily-picks] Generating picks — date=${date ?? 'today'} minTier=${minTier}`);
    const t0 = Date.now();

    const { generateDailyPicks, savePicks } = await import('@/lib/picks-engine');
    const picks = await generateDailyPicks({ date, minTier, concurrency });

    if (save && picks.length > 0) {
      await savePicks(picks);
    }

    const elapsed = Date.now() - t0;
    console.log(`[v0] [API/daily-picks] Done — ${picks.length} picks in ${elapsed}ms`);

    return NextResponse.json({
      success:  true,
      data:     picks,
      meta: {
        count:     picks.length,
        elapsedMs: elapsed,
        saved:     save,
        minTier,
      },
    });
  } catch (err) {
    console.error('[v0] [API/daily-picks] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Pick generation failed' },
      { status: 500 },
    );
  }
}

// ── PATCH — Re-score existing picks with latest sharp signals ──────────────────
//   Body: { date?, sharpMultiplier?, recomputeModelProb? }
//   Auth: same CRON_SECRET header as POST

export async function PATCH(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const cronHeader = req.headers.get('x-cron-secret');
    const provided   = authHeader?.replace('Bearer ', '') ?? cronHeader ?? '';
    if (provided !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await req.json().catch(() => ({})) as {
      date?: string;
      sharpMultiplier?: number;
      recomputeModelProb?: boolean;
    };

    const { refreshPicksWithSharpSignals } = await import('@/lib/update-picks');
    const result = await refreshPicksWithSharpSignals({
      date:               body.date,
      sharpMultiplier:    body.sharpMultiplier,
      recomputeModelProb: body.recomputeModelProb,
    });

    console.log(`[v0] [API/daily-picks] PATCH refresh — ${result.picksUpdated}/${result.picksProcessed} updated, ${result.sharplyBoosted} sharp-boosted`);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error('[v0] [API/daily-picks] PATCH error:', err);
    return NextResponse.json(
      { success: false, error: 'Refresh failed' },
      { status: 500 },
    );
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function getTodayDateET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
