/**
 * GET /api/mlb-projections
 *
 * LeverageMetrics MLB Projection Engine API
 * Runs the full projection pipeline (Statcast + MLB Stats + Weather + Monte Carlo)
 * and returns cards ready for rendering.
 *
 * Query params:
 *   playerType: 'hitter' | 'pitcher' | 'all'   (default: 'all')
 *   outputFor:  'projections' | 'dfs' | 'fantasy' | 'betting'  (default: 'projections')
 *   player:     string  — specific player name (optional)
 *   limit:      number  — max cards to return (1–15, default 9)
 *   date:       string  — YYYY-MM-DD (default: today)
 */

import { NextRequest, NextResponse } from 'next/server';

const MAX_LIMIT = 15;
const DEFAULT_LIMIT = 9;
const TIMEOUT_MS = 20_000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const playerType = (searchParams.get('playerType') ?? searchParams.get('type') ?? 'all') as 'hitter' | 'pitcher' | 'all';
  const outputFor  = (searchParams.get('outputFor') ?? 'projections') as 'projections' | 'dfs' | 'fantasy' | 'betting';
  const player     = searchParams.get('player') ?? undefined;
  const dateParam  = searchParams.get('date') ?? undefined;
  const limit      = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));

  // Validate date format
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { success: false, error: 'Invalid date format. Use YYYY-MM-DD.', cards: [], count: 0 },
      { status: 400 },
    );
  }
  const date = dateParam;

  console.log('[API/mlb-projections] Request:', { playerType, outputFor, player, date, limit });

  try {
    const pipeline = async (): Promise<unknown[]> => {
      switch (outputFor) {
        case 'dfs': {
          const { buildDFSSlate } = await import('@/lib/mlb-projections/slate-builder');
          const cards = await buildDFSSlate({ limit, date });
          return (cards as any[]).map(c => ({ ...c, ...c.data, type: c.type }));
        }

        case 'fantasy': {
          const { buildFantasyCards } = await import('@/lib/mlb-projections/fantasy-adapter');
          const raw = await buildFantasyCards({ limit, date });
          return raw.map(c => ({ ...c, ...c.data, type: c.type }));
        }

        case 'betting': {
          const { buildBettingEdgeCards } = await import('@/lib/mlb-projections/betting-edges');
          return await buildBettingEdgeCards({ limit, date });
        }

        default: {
          if (player) {
            const { projectSinglePlayer } = await import('@/lib/mlb-projections/projection-pipeline');
            const type = playerType === 'all' ? 'hitter' : playerType;
            const card = await projectSinglePlayer(player, type);
            return card ? [card] : [];
          }
          const { runProjectionPipeline } = await import('@/lib/mlb-projections/projection-pipeline');
          return await runProjectionPipeline({ playerType, limit, date });
        }
      }
    };

    const cards = await Promise.race([
      pipeline(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MLB projections timed out after 20s')), TIMEOUT_MS),
      ),
    ]);

    return NextResponse.json({
      success: true,
      cards,
      count: cards.length,
      date: date ?? new Date().toISOString().slice(0, 10),
      source: 'LeverageMetrics',
      outputFor,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = msg.includes('timed out');
    console.error('[API/mlb-projections] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg, cards: [], count: 0 },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
