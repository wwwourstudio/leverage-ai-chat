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
import { requireServiceRole, internalError } from '@/lib/api/route-helpers';

export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authErr = requireServiceRole(req, 'x-retrain-key');
  if (authErr) return authErr;

  const start = Date.now();
  logger.info(LogCategory.API, '[market-intelligence/retrain] starting retraining job');

  try {
    const result = await runRetraining();
    const durationMs = Date.now() - start;

    logger.info(LogCategory.API, '[market-intelligence/retrain] complete', { metadata: { ...result, durationMs } });

    return NextResponse.json({ success: true, ...result, durationMs });
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence/retrain] error', { error: err instanceof Error ? err : String(err) });
    return internalError('Retraining failed');
  }
}
