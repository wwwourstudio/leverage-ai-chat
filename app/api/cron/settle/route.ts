/**
 * GET /api/cron/settle
 *
 * Settlement Layer — Settle yesterday's picks.
 * Reads unsettled `pick_results` rows for yesterday, fetches actual HR
 * outcomes from the MLB Stats API, computes P&L, and writes settled rows back.
 *
 * Runs after games finish (~4 AM UTC / midnight ET).
 *
 * pg_cron schedule: daily at 04:00 UTC  (settle-picks-daily)
 * Auth: CRON_SECRET query param or x-cron-secret / Authorization header
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const startedAt = Date.now();
  // Optional override: ?date=YYYY-MM-DD (defaults to yesterday UTC)
  const dateParam = req.nextUrl.searchParams.get('date') ?? undefined;
  const timestamp = new Date().toISOString();

  try {
    const { recordPickResults } = await import('@/lib/tracking/recordResults');

    const result = await recordPickResults(dateParam);

    console.log(
      `[v0] [cron/settle] Settled ${result.picksSettled}/${result.picksScanned} picks for ${result.date}` +
        (result.errors.length > 0 ? ` — ${result.errors.length} errors` : '') +
        ` in ${Date.now() - startedAt}ms`,
    );

    if (result.errors.length > 0) {
      console.warn('[v0] [cron/settle] Settlement errors:', result.errors);
    }

    return NextResponse.json({
      ok: true,
      date: result.date,
      picksScanned: result.picksScanned,
      picksSettled: result.picksSettled,
      errors: result.errors,
      durationMs: Date.now() - startedAt,
      timestamp,
    });
  } catch (err) {
    const errMsg   = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack   : undefined;
    console.error('[v0] [cron/settle] Fatal error:', errMsg);
    if (errStack) console.error('[v0] [cron/settle] Stack:', errStack);
    console.error('[v0] [cron/settle] Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return NextResponse.json(
      {
        ok: false,
        error: errMsg,
        durationMs: Date.now() - startedAt,
        timestamp,
      },
      { status: 500 },
    );
  }
}
