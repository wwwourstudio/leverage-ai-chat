/**
 * POST /api/market-intelligence/snapshot
 *
 * Ingests a market snapshot: normalizes, runs full intelligence pipeline,
 * stores results to Supabase, and returns the MarketIntelligenceReport.
 *
 * Called every 30 seconds by the client-side MarketIntelligencePanel.
 * Designed to complete in <3s. Uses 15s Vercel timeout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeMarket } from '@/lib/market-intelligence';
import { logger, LogCategory } from '@/lib/logger';
import { HTTP_STATUS } from '@/lib/constants';

export const maxDuration = 15;

interface SnapshotRequestBody {
  eventId: string;
  sport: string;
  oddsEvent: Record<string, unknown>;
  kalshiMarkets?: Array<Record<string, unknown>>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  try {
    const body: SnapshotRequestBody = await req.json();
    const { eventId, sport, oddsEvent, kalshiMarkets = [] } = body;

    if (!eventId || !sport || !oddsEvent) {
      return NextResponse.json(
        { success: false, error: 'eventId, sport, and oddsEvent are required' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const report = await analyzeMarket(eventId, sport, oddsEvent, kalshiMarkets);

    logger.info(LogCategory.API, '[market-intelligence/snapshot] complete', { metadata: { eventId, sport, severity: report.severity, anomalyScore: report.anomalyScore, durationMs: Date.now() - start } });

    return NextResponse.json({ success: true, report });
  } catch (err) {
    logger.info(LogCategory.API, '[market-intelligence/snapshot] error', { error: err instanceof Error ? err : String(err) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
