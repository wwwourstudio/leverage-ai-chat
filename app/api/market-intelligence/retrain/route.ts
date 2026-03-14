/**
 * POST /api/market-intelligence/retrain
 *
 * Triggers the 24h retraining pipeline:
 * - Joins resolved predictions with outcomes
 * - Computes Brier scores per signal
 * - Updates signal weights
 * - Creates new model version if Brier improves by >3%
 * - Rolls back if performance worsens
 *
 * Protected by x-retrain-key header matching SUPABASE_SERVICE_ROLE_KEY.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runRetraining } from '@/lib/market-intelligence/signal-tracker';
import { logger, LogCategory } from '@/lib/logger';
import { HTTP_STATUS } from '@/lib/constants';

export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth guard
  const authHeader = req.headers.get('x-retrain-key');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || authHeader !== serviceKey) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: HTTP_STATUS.UNAUTHORIZED }
    );
  }

  const start = Date.now();
  logger.info(LogCategory.API, '[market-intelligence/retrain] starting retraining job');

  try {
    const result = await runRetraining();

    logger.info(LogCategory.API, '[market-intelligence/retrain] complete', { metadata: { ...result, durationMs: Date.now() - start } });

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence/retrain] error', { error: err instanceof Error ? err : String(err) });
    return NextResponse.json(
      { success: false, error: 'Retraining failed' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
