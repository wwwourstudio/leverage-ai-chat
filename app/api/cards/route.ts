import { NextRequest, NextResponse } from 'next/server';
import { generateContextualCards } from '@/lib/cards-generator';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants';
import { validateBenford } from '@/lib/benford-validator';

// ============================================================================
// POST /api/cards
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sport, category, limit = 3 } = body;

    const clampedLimit = Math.min(Math.max(Number(limit) || 3, 1), 15);

    // 20s hard timeout — prevents this route from hanging until Vercel's 60s wall clock
    // if an upstream API (odds, weather, kalshi) is slow or unresponsive.
    const cards = await Promise.race([
      generateContextualCards(category ?? undefined, sport ?? undefined, clampedLimit),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('card generation timed out')), 20_000),
      ),
    ]);

    // Run Benford's Law validation on all numeric values across the card batch
    const allNums = cards.flatMap((c: any) =>
      Object.values(c.data ?? {}).filter((v): v is number => typeof v === 'number')
    );
    const benford = validateBenford(allNums);

    // Attach Benford result to each card's metadata
    const validatedCards = cards.map((c: any) => ({
      ...c,
      metadata: {
        ...c.metadata,
        benfordValid: benford.isValid,
        benfordScore: Math.round(benford.score * 100) / 100,
        benfordConfidence: benford.confidence,
      },
    }));

    return NextResponse.json({
      success: true,
      cards: validatedCards,
      count: validatedCards.length,
      message: SUCCESS_MESSAGES.CARDS_GENERATED,
      benfordValidation: {
        isValid: benford.isValid,
        score: Math.round(benford.score * 100) / 100,
        confidence: benford.confidence,
      },
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
