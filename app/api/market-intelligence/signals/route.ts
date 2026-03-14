/**
 * GET  /api/market-intelligence/signals — Return current signal weights + active model
 * PATCH /api/market-intelligence/signals — Manually override a signal weight (service role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadActiveModel } from '@/lib/market-intelligence/signal-tracker';
import { logger, LogCategory } from '@/lib/logger';
import { HTTP_STATUS } from '@/lib/constants';

export const maxDuration = 10;

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    const [signalsRes, activeModel] = await Promise.all([
      supabase
        .from('signal_performance')
        .select('signal_name, wins, losses, accuracy, weight, brier_score, last_updated')
        .order('weight', { ascending: false }),
      loadActiveModel(),
    ]);

    return NextResponse.json({
      success: true,
      signals: signalsRes.data ?? [],
      activeModel: activeModel ?? null,
    });
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence/signals] GET error', { error: err instanceof Error ? err : String(err) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  // Guard: require service role key in header
  const authHeader = req.headers.get('x-service-role-key');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || authHeader !== serviceKey) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: HTTP_STATUS.UNAUTHORIZED }
    );
  }

  try {
    const { signal_name, weight } = await req.json();

    if (!signal_name || typeof weight !== 'number' || weight < 0 || weight > 1) {
      return NextResponse.json(
        { success: false, error: 'signal_name (string) and weight (0-1) are required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('signal_performance')
      .update({ weight, last_updated: new Date().toISOString() })
      .eq('signal_name', signal_name)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    logger.info(LogCategory.API, '[market-intelligence/signals] weight updated', { metadata: { signal_name, weight } });
    return NextResponse.json({ success: true, signal: data });
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence/signals] PATCH error', { error: err instanceof Error ? err : String(err) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
