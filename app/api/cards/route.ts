import { NextRequest, NextResponse } from 'next/server';
import { generateContextualCards } from '@/lib/cards-generator';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants';

// ============================================================================
// GET /api/cards?sport=<sport>&category=<category>&limit=<limit>
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') ?? undefined;
    const category = searchParams.get('category') ?? undefined;
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 3, 1), 15);

    const cards = await generateContextualCards(category, sport, limit);

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
