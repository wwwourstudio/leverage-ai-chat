/**
 * GET /api/market-intelligence/anomalies
 *
 * Returns recent market anomalies from the `market_anomalies` table.
 *
 * Query params:
 *   sport    — filter by sport key (optional)
 *   severity — filter by severity: low|medium|high (optional)
 *   limit    — max rows (default 20, max 100)
 *   since    — ISO timestamp to filter anomalies after (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, LogCategory } from '@/lib/logger';
import { HTTP_STATUS } from '@/lib/constants';

export const maxDuration = 10;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport') ?? undefined;
    const severity = searchParams.get('severity') ?? undefined;
    const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
    const since = searchParams.get('since') ?? undefined;

    const supabase = await createClient();

    let query = supabase
      .from('market_anomalies')
      .select(`
        id,
        event_id,
        sport,
        anomaly_score,
        severity,
        affected_markets,
        cluster_id,
        benford_trust,
        signal_strength,
        detected_at
      `)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (sport) query = query.eq('sport', sport);
    if (severity) query = query.eq('severity', severity);
    if (since) query = query.gte('detected_at', since);

    const { data, error } = await query;

    if (error) {
      logger.info(LogCategory.API, '[market-intelligence/anomalies] DB error', { metadata: { error: error.message } });
      return NextResponse.json(
        { success: false, error: error.message, anomalies: [] },
        { status: HTTP_STATUS.INTERNAL_ERROR }
      );
    }

    return NextResponse.json({
      success: true,
      anomalies: data ?? [],
      count: data?.length ?? 0,
    });
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence/anomalies] error', { error: err instanceof Error ? err : String(err) });
    return NextResponse.json(
      { success: false, error: 'Internal server error', anomalies: [] },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
