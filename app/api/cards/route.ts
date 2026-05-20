import { NextRequest, NextResponse } from 'next/server';
import { generateContextualCards } from '@/lib/cards-generator';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants';
import { validateBenford } from '@/lib/benford-validator';
import { checkRateLimit, getRateLimitId } from '@/lib/middleware/rate-limit';
import { detectSportFromText } from '@/lib/sport-detection';

// In-memory inflight map: coalesces concurrent requests with identical params
// into a single generateContextualCards call. Auto-cleaned on promise settle.
const inflight = new Map<string, Promise<any[]>>();

function buildCardsResponse(cards: any[], category?: string): NextResponse {
  const allNums = cards.flatMap((c: any) =>
    Object.values(c.data ?? {}).filter((v): v is number => typeof v === 'number')
  );
  const benford = validateBenford(allNums);
  const fetchedAt = new Date().toISOString();
  const validatedCards = cards.map((c: any) => ({
    ...c,
    metadata: { ...c.metadata, benfordValid: benford.isValid, benfordScore: Math.round(benford.score * 100) / 100, benfordConfidence: benford.confidence, fetchedAt },
  }));
  // Props and player-specific queries must not be shared across CDN cache entries —
  // the CDN cache key is the URL only (not the POST body), so `public, s-maxage`
  // would serve the same response for every user regardless of their query.
  // Use `no-store` for props; allow short-lived CDN caching for generic card categories.
  const isQuerySpecific = category === 'props' || category === 'player_props' || category === 'player';
  const cacheControl = isQuerySpecific
    ? 'no-store'
    : 'public, s-maxage=30, stale-while-revalidate=60';
  return NextResponse.json(
    { success: true, cards: validatedCards, count: validatedCards.length, message: SUCCESS_MESSAGES.CARDS_GENERATED, benfordValidation: { isValid: benford.isValid, score: Math.round(benford.score * 100) / 100, confidence: benford.confidence } },
    { headers: { 'Cache-Control': cacheControl } },
  );
}

// ============================================================================
// POST /api/cards
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 30 req/min per IP — cards generation calls multiple external APIs
    const rl = checkRateLimit('cards-post', getRateLimitId(request), { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, cards: [], error: 'Too many requests — try again in a minute' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    const body = await request.json();
    const { sport: rawSport, category, limit = 6, userContext, draftGroupId, includeAllCards = false } = body;

    // Infer sport from the user's query text when the caller hasn't provided one
    const sport = rawSport || (userContext ? detectSportFromText(String(userContext)) || undefined : undefined);
    if (!rawSport && sport) {
      console.log(`[Cards] userContext: "${String(userContext).slice(0, 60)}" → sport: "${sport}"`);
    }

    const maxCards = includeAllCards ? 50 : 25;
    const clampedLimit = Math.min(Math.max(Number(limit) || 6, 1), maxCards);
    // Include userContext and draftGroupId in dedupeKey — different queries must not coalesce
    // into one in-flight promise even if category/sport/limit match.
    const dedupeKey = `${category ?? ''}::${sport ?? ''}::${clampedLimit}::${userContext ?? ''}::${draftGroupId ?? ''}`;

    // Return the in-flight promise if an identical request is already running
    if (inflight.has(dedupeKey)) {
      const cards = await inflight.get(dedupeKey)!;
      return buildCardsResponse(cards);
    }

    // 20s hard timeout — prevents this route from hanging until Vercel's 60s wall clock
    // if an upstream API (odds, weather, kalshi) is slow or unresponsive.
    const cardPromise = Promise.race([
      generateContextualCards(category ?? undefined, sport ?? undefined, clampedLimit, undefined, undefined, { userContext: userContext ?? undefined, draftGroupId: typeof draftGroupId === 'number' ? draftGroupId : undefined }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('card generation timed out')), 20_000),
      ),
    ]);

    inflight.set(dedupeKey, cardPromise);
    cardPromise.finally(() => inflight.delete(dedupeKey));

    const cards = await cardPromise;
    return buildCardsResponse(cards, category ?? undefined);
  } catch (error) {
    console.error('[API/cards] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = msg.toLowerCase().includes('timeout') || (error as any)?.name === 'AbortError';
    const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit');
    const userMessage = isTimeout
      ? 'Card generation timed out — try a more specific query'
      : isRateLimit
      ? 'API rate limit reached — try again in a minute'
      : ERROR_MESSAGES.INTERNAL_ERROR;
    return NextResponse.json(
      {
        success: false,
        cards: [],
        error: userMessage,
        details: msg,
      },
      { status: isTimeout ? 504 : isRateLimit ? 429 : HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
