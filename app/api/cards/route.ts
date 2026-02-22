import { NextRequest, NextResponse } from 'next/server';
import { generateContextualCards } from '@/lib/cards-generator';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants';

// ============================================================================
// POST /api/cards
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sport, category, limit = 3 } = body;

    const clampedLimit = Math.min(Math.max(Number(limit) || 3, 1), 15);

    const cards = await generateContextualCards(
      category ?? undefined,
      sport ?? undefined,
      clampedLimit
    );

    return NextResponse.json({
      success: true,
      cards,
      count: cards.length,
      message: SUCCESS_MESSAGES.CARDS_GENERATED,
    });
  } catch (error) {
    console.error('[API/cards] Error:', error);
    return NextResponse.json(
      {
        success: false,
        cards: [],
        error: ERROR_MESSAGES.INTERNAL_ERROR,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
