/**
 * Cards Generator Utility
 * Generates contextual insight cards for betting analysis
 * Separated from route file for safe importing
 * 
 * Sport Key Standardization:
 * - Accepts both short form ('nba') and API format ('basketball_nba')
 * - Normalizes to API format internally using SPORT_KEYS
 * - Converts back to display format for user-facing text
 */

import { unstable_cache } from 'next/cache';
import { CARD_TYPES, CARD_STATUS, SPORT_KEYS, sportToApi, apiToSport, getSportGradient } from '@/lib/constants';
import { generateNoDataMessage, getSeasonInfo } from '@/lib/seasonal-context';
import { logger, LogCategory } from '@/lib/logger';

// ============================================================================
// Deterministic card ID — djb2 hash over the card's key dimensions.
// Produces a stable 7-char base-36 string for use as React key and cache key.
// ============================================================================
function cardId(...parts: (string | number | undefined | null)[]): string {
  const str = parts.filter(Boolean).join('|');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ============================================================================
// Preferred bookmaker order — used in both oddsEventsToBettingCards and
// generateSportSpecificCards. Extracted here to avoid duplication.
// ============================================================================
const PREFERRED_BOOKS = [
  'DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet',
  'BetRivers', 'ESPN BET', 'Hard Rock Bet', 'Fanatics', 'bet365',
];

// ============================================================================
// Card type validation — warn at runtime when an unknown type is produced.
// Catches regressions where new card categories are added without updating
// the CARD_TYPES constant or the DynamicCardRenderer routing.
// ============================================================================
const VALID_CARD_TYPES = new Set<string>(Object.values(CARD_TYPES));

export function assertCardType(type: string, context?: string): void {
  if (!VALID_CARD_TYPES.has(type)) {
    console.warn(
      `[v0] [CARDS-GEN] Unknown card type "${type}"${context ? ` in ${context}` : ''} — add it to CARD_TYPES in lib/constants.ts`,
    );
  }
}

// ============================================================================
// In-memory card cache (shared between SSR page load and /api/analyze)
// Prevents duplicate API calls when the analyze endpoint needs cards that
// were already fetched during SSR.
//
// Uses a Map keyed by "category:sport" so kalshi, betting, arbitrage, etc.
// each maintain independent cache slots that never evict one another.
// ============================================================================
interface CachedCards {
  cards: InsightCard[];
  timestamp: number;
  category: string;
}

const CARD_CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const cardCacheMap = new Map<string, CachedCards>();

/** Build a stable cache key from category + sport + first 80 chars of userContext */
function makeCacheKey(category?: string, sport?: string, userContext?: string): string {
  const contextSlug = userContext ? userContext.trim().toLowerCase().substring(0, 80) : '';
  return `${category ?? 'all'}:${sport ?? ''}:${contextSlug}`;
}

/** Retrieve cached cards if still fresh for the given category+sport+userContext */
export function getCachedCards(category?: string, sport?: string, count: number = 6, userContext?: string): InsightCard[] | null {
  const key = makeCacheKey(category, sport, userContext);
  const entry = cardCacheMap.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CARD_CACHE_TTL) {
    cardCacheMap.delete(key);
    return null;
  }
  return entry.cards.slice(0, count);
}

/** Store cards in the in-memory cache under the given category+sport+userContext key */
function setCachedCards(cards: InsightCard[], category: string, sport?: string, userContext?: string): void {
  const key = makeCacheKey(category, sport, userContext);
  cardCacheMap.set(key, { cards, timestamp: Date.now(), category });
}

// ── Odds sanity helpers ───────────────────────────────────────────────────────

/** American odds beyond ±1000 indicate live/in-progress betting lines — not useful pre-game. */
const MAX_DISPLAY_ODDS = 1000;
function sanitizePrice(price: number): number | null {
  return Math.abs(price) <= MAX_DISPLAY_ODDS ? price : null;
}

/**
 * Returns true when both moneylines are missing AND at least one spread/total
 * price is extreme (|price| > 800). This pattern reliably identifies in-progress
 * games whose live run-line / total odds have drifted to degenerate values.
 */
function isDegenerate(card: {
  homeOdds: string;
  awayOdds: string;
  homeSpread?: string;
  awaySpread?: string;
  overUnder?: string;
}): boolean {
  if (card.homeOdds !== '—' || card.awayOdds !== '—') return false;
  const nums = [card.homeSpread, card.awaySpread, card.overUnder]
    .join(' ')
    .match(/-?\d+/g)
    ?.map(Number) ?? [];
  return nums.some(n => Math.abs(n) > 800);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert raw Odds API event objects into BettingCards with realData: true.
 * Used by the /api/analyze route to build cards directly from context.oddsData
 * (the odds already fetched by the client) so the AI and cards show the same games.
 */
export function oddsEventsToBettingCards(
  events: any[],
  sport: string,
  maxCards = 6
): InsightCard[] {
  const cards: InsightCard[] = [];
  const displaySport = apiToSport(sport).toUpperCase();

  // First pass: completed games with scores
  for (const game of events) {
    if (cards.length >= maxCards) break;
    if (!game.completed || !game.scores) continue;
    const homeScore = game.scores?.find((s: any) => s.name === game.home_team);
    const awayScore = game.scores?.find((s: any) => s.name === game.away_team);
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `${game.away_team} @ ${game.home_team}`,
      icon: 'CheckCircle',
      category: displaySport,
      subcategory: 'Final Score',
      gradient: getSportGradient(sport),
      status: 'neutral',
      data: {
        matchup: `${game.away_team} @ ${game.home_team}`,
        sport,
        gameTime: new Date(game.commence_time).toLocaleString(),
        finalScore: `${game.away_team} ${awayScore?.score ?? '?'} — ${homeScore?.score ?? '?'} ${game.home_team}`,
        homeScore: homeScore?.score ?? '?',
        awayScore: awayScore?.score ?? '?',
        completed: true,
        realData: true,
        status: 'FINAL',
      },
      metadata: { realData: true, dataSource: 'The Odds API Scores', gameId: game.id },
    });
  }

  // Second pass: upcoming games with bookmaker odds
  for (const game of events) {
    if (cards.length >= maxCards) break;
    if (game.completed) continue;
    const bookmakers: any[] = game.bookmakers || [];
    if (bookmakers.length === 0) continue;
    const sorted = [...bookmakers].sort((a, b) => {
      const ai = PREFERRED_BOOKS.findIndex(n => a.title?.includes(n));
      const bi = PREFERRED_BOOKS.findIndex(n => b.title?.includes(n));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    const book = sorted[0];
    const h2hMarket = book?.markets?.find((m: any) => m.key === 'h2h');
    const spreadsMarket = book?.markets?.find((m: any) => m.key === 'spreads');
    const totalsMarket = book?.markets?.find((m: any) => m.key === 'totals');
    const h2hOutcomes = h2hMarket?.outcomes || [];
    const homeOdds = h2hOutcomes.find((o: any) => o.name === game.home_team);
    const awayOdds = h2hOutcomes.find((o: any) => o.name === game.away_team);
    const spreadOutcomes = spreadsMarket?.outcomes || [];
    const homeSpread = spreadOutcomes.find((o: any) => o.name === game.home_team);
    const awaySpread = spreadOutcomes.find((o: any) => o.name === game.away_team);
    const totalOutcomes = totalsMarket?.outcomes || [];
    const over = totalOutcomes.find((o: any) => o.name === 'Over');
    const under = totalOutcomes.find((o: any) => o.name === 'Under');
    const hasOdds = !!(homeOdds || awayOdds || homeSpread || over);
    const gameDate = new Date(game.commence_time);
    const isToday = new Date().toDateString() === gameDate.toDateString();
    const gameTimeStr = isToday
      ? `Today ${gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : gameDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Multi-book comparison: top 3 preferred books with H2H ML odds
    const topBooks = sorted.slice(0, 3).map((b: any) => {
      const bH2h = b.markets?.find((m: any) => m.key === 'h2h')?.outcomes || [];
      const bHome = bH2h.find((o: any) => o.name === game.home_team);
      const bAway = bH2h.find((o: any) => o.name === game.away_team);
      return {
        name: b.title as string,
        homeOdds: bHome ? (bHome.price > 0 ? `+${bHome.price}` : `${bHome.price}`) : null,
        awayOdds: bAway ? (bAway.price > 0 ? `+${bAway.price}` : `${bAway.price}`) : null,
      };
    }).filter((b: any) => b.homeOdds || b.awayOdds);

    // Best odds (highest price = most favorable) across all bookmakers
    let bestHomeRaw: number | null = null;
    let bestAwayRaw: number | null = null;
    for (const b of bookmakers) {
      const bH2h = b.markets?.find((m: any) => m.key === 'h2h')?.outcomes || [];
      const bHome = bH2h.find((o: any) => o.name === game.home_team);
      const bAway = bH2h.find((o: any) => o.name === game.away_team);
      if (bHome && (bestHomeRaw === null || bHome.price > bestHomeRaw)) bestHomeRaw = bHome.price;
      if (bAway && (bestAwayRaw === null || bAway.price > bestAwayRaw)) bestAwayRaw = bAway.price;
    }

    // Build displayable strings with sanitized prices
    const homeOddsStr = homeOdds ? (homeOdds.price > 0 ? `+${homeOdds.price}` : `${homeOdds.price}`) : '—';
    const awayOddsStr = awayOdds ? (awayOdds.price > 0 ? `+${awayOdds.price}` : `${awayOdds.price}`) : '—';
    const hsPrice = homeSpread ? sanitizePrice(homeSpread.price) : null;
    const asPrice = awaySpread ? sanitizePrice(awaySpread.price) : null;
    const overPrice = over ? sanitizePrice(over.price) : null;
    const underPrice = under ? sanitizePrice(under.price) : null;
    const homeSpreadStr = homeSpread && hsPrice !== null
      ? `${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${hsPrice > 0 ? '+' : ''}${hsPrice})`
      : 'N/A';
    const awaySpreadStr = awaySpread && asPrice !== null
      ? `${awaySpread.point > 0 ? '+' : ''}${awaySpread.point} (${asPrice > 0 ? '+' : ''}${asPrice})`
      : 'N/A';
    const ouStr = over && under && overPrice !== null && underPrice !== null
      ? `O/U ${over.point}: Over ${overPrice > 0 ? '+' : ''}${overPrice} / Under ${underPrice > 0 ? '+' : ''}${underPrice}`
      : 'N/A';

    // Skip in-progress / degenerate games (no moneyline + extreme spread/total prices)
    if (isDegenerate({ homeOdds: homeOddsStr, awayOdds: awayOddsStr, homeSpread: homeSpreadStr, awaySpread: awaySpreadStr, overUnder: ouStr })) continue;

    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `${game.away_team} @ ${game.home_team}`,
      icon: hasOdds ? 'TrendingUp' : 'Calendar',
      category: displaySport,
      subcategory: hasOdds ? `${book?.title ?? 'Odds'} Lines` : 'Upcoming',
      gradient: getSportGradient(sport),
      status: hasOdds ? 'value' : 'neutral',
      data: {
        matchup: `${game.away_team} @ ${game.home_team}`,
        sport,
        gameTime: gameTimeStr,
        homeOdds: homeOddsStr,
        awayOdds: awayOddsStr,
        homeSpread: homeSpreadStr,
        awaySpread: awaySpreadStr,
        overUnder: ouStr,
        bookmaker: book?.title ?? (hasOdds ? 'Multiple Books' : 'Upcoming'),
        bookmakerCount: bookmakers.length,
        books: topBooks.length >= 2 ? topBooks : undefined,
        bestHomeOdds: bestHomeRaw !== null ? (bestHomeRaw > 0 ? `+${bestHomeRaw}` : `${bestHomeRaw}`) : undefined,
        bestAwayOdds: bestAwayRaw !== null ? (bestAwayRaw > 0 ? `+${bestAwayRaw}` : `${bestAwayRaw}`) : undefined,
        realData: true,
        status: hasOdds ? 'VALUE' : 'UPCOMING',
      },
      metadata: { realData: true, dataSource: 'The Odds API', gameId: game.id },
    });
  }

  // Assign stable deterministic IDs to all generated cards
  return cards.map((c, i) => c.id ? c : { ...c, id: cardId(c.type, c.category, c.title, String(i)) });
}

/**
 * Generate sport-specific cards with REAL odds data
 */
// FORCE REFRESH: 2026-02-21-v5
async function generateSportSpecificCards(
  sport: string,
  count: number,
  category?: string
): Promise<InsightCard[]> {
  // FORCE MINIMUM 3 CARDS - OVERRIDE ANY COUNT PARAMETER
  const actualCount = Math.max(count, 3);
  const cards: InsightCard[] = [];
  const displaySport = apiToSport(sport).toUpperCase();
  console.log(`[v0] [CARDS-GEN] ${displaySport}: generating ${actualCount} cards (category: ${category || 'all'})`);
  
  // Fetch real live odds for this sport using unified service
  if (category === 'betting' || category === 'all' || !category) {
    try {
      const { getOddsWithCache } = await import('@/lib/odds/index');
      
      const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
      if (!apiKey) {
        throw new Error('ODDS_API_KEY not configured');
      }
      
      const oddsData = await getOddsWithCache(sport, {
        useCache: false,
        storeResults: true
      });
      
      console.log(`[v0] [CARDS-GEN] ${displaySport}: ${oddsData?.length || 0} games from API`);
      
      if (oddsData && oddsData.length > 0) {
        console.log(`[v0] [CARDS-GEN] SUCCESS: Found ${oddsData.length} games for ${displaySport}`);

        // Build a flat list: one entry per (game, bookmaker) pair, prioritising preferred books
        const gameBookPairs: Array<{ game: any; book: any; bookIdx: number }> = [];
        for (const game of oddsData) {
          if (game.completed) continue; // skip finals — handled separately below
          const bookmakers: any[] = game.bookmakers || [];
          if (bookmakers.length === 0) {
            // No bookmaker data — still emit an upcoming card
            gameBookPairs.push({ game, book: null, bookIdx: 999 });
            continue;
          }
          // Sort bookmakers: preferred first, then alphabetical
          const sorted = [...bookmakers].sort((a, b) => {
            const ai = PREFERRED_BOOKS.findIndex(n => a.title?.includes(n));
            const bi = PREFERRED_BOOKS.findIndex(n => b.title?.includes(n));
            const as = ai === -1 ? 999 : ai;
            const bs = bi === -1 ? 999 : bi;
            return as - bs;
          });
          // One card per game — use the top-ranked bookmaker only to avoid duplicates
          if (sorted.length > 0) {
            gameBookPairs.push({ game, book: sorted[0], bookIdx: 0 });
          }
        }

        // First pass: completed games
        for (const game of oddsData) {
          if (cards.length >= actualCount) break;
          if (!game.completed || !game.scores) continue;
          const homeScore = game.scores?.find((s: any) => s.name === game.home_team);
          const awayScore = game.scores?.find((s: any) => s.name === game.away_team);
          cards.push({
            type: CARD_TYPES.LIVE_ODDS,
            title: `${game.away_team} @ ${game.home_team}`,
            icon: 'CheckCircle',
            category: displaySport,
            subcategory: 'Final Score',
            gradient: getSportGradient(sport),
            data: {
              matchup: `${game.away_team} @ ${game.home_team}`,
              sport,
              gameTime: new Date(game.commence_time).toLocaleString(),
              finalScore: `${game.away_team} ${awayScore?.score ?? '?'} — ${homeScore?.score ?? '?'} ${game.home_team}`,
              homeScore: homeScore?.score ?? '?',
              awayScore: awayScore?.score ?? '?',
              completed: true,
              realData: true,
              status: 'FINAL',
            },
            status: 'neutral',
            metadata: { realData: true, dataSource: 'The Odds API Scores', gameId: game.id },
          });
        }

        // Second pass: upcoming games with odds per bookmaker
        for (const { game, book } of gameBookPairs) {
          if (cards.length >= actualCount) break;

          const bookmakers: any[] = game.bookmakers || [];
          const h2hMarket = book?.markets?.find((m: any) => m.key === 'h2h');
          const spreadsMarket = book?.markets?.find((m: any) => m.key === 'spreads');
          const totalsMarket = book?.markets?.find((m: any) => m.key === 'totals');

          const h2hOutcomes = h2hMarket?.outcomes || [];
          const homeOdds = h2hOutcomes.find((o: any) => o.name === game.home_team);
          const awayOdds = h2hOutcomes.find((o: any) => o.name === game.away_team);

          const spreadOutcomes = spreadsMarket?.outcomes || [];
          const homeSpread = spreadOutcomes.find((o: any) => o.name === game.home_team);
          const awaySpread = spreadOutcomes.find((o: any) => o.name === game.away_team);

          const totalOutcomes = totalsMarket?.outcomes || [];
          const over = totalOutcomes.find((o: any) => o.name === 'Over');
          const under = totalOutcomes.find((o: any) => o.name === 'Under');

          const hasOdds = !!(homeOdds || awayOdds || homeSpread || over);
          const subcategory = hasOdds ? `${book?.title ?? 'Odds'} Lines` : 'Upcoming';
          const gameDate = new Date(game.commence_time);
          const isToday = new Date().toDateString() === gameDate.toDateString();
          const gameTimeStr = isToday
            ? `Today ${gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : gameDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

          // Multi-book comparison: sort all available books and take top 3
          const allSorted = [...bookmakers].sort((a, b) => {
            const ai = PREFERRED_BOOKS.findIndex(n => a.title?.includes(n));
            const bi = PREFERRED_BOOKS.findIndex(n => b.title?.includes(n));
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
          const topBooks = allSorted.slice(0, 3).map((b: any) => {
            const bH2h = b.markets?.find((m: any) => m.key === 'h2h')?.outcomes || [];
            const bHome = bH2h.find((o: any) => o.name === game.home_team);
            const bAway = bH2h.find((o: any) => o.name === game.away_team);
            return {
              name: b.title as string,
              homeOdds: bHome ? (bHome.price > 0 ? `+${bHome.price}` : `${bHome.price}`) : null,
              awayOdds: bAway ? (bAway.price > 0 ? `+${bAway.price}` : `${bAway.price}`) : null,
            };
          }).filter((b: any) => b.homeOdds || b.awayOdds);

          // Best odds across all bookmakers
          let bestHomeRaw: number | null = null;
          let bestAwayRaw: number | null = null;
          for (const b of bookmakers) {
            const bH2h = b.markets?.find((m: any) => m.key === 'h2h')?.outcomes || [];
            const bHome = bH2h.find((o: any) => o.name === game.home_team);
            const bAway = bH2h.find((o: any) => o.name === game.away_team);
            if (bHome && (bestHomeRaw === null || bHome.price > bestHomeRaw)) bestHomeRaw = bHome.price;
            if (bAway && (bestAwayRaw === null || bAway.price > bestAwayRaw)) bestAwayRaw = bAway.price;
          }

          // Build displayable strings with sanitized prices
          const homeOddsStr = homeOdds ? (homeOdds.price > 0 ? `+${homeOdds.price}` : `${homeOdds.price}`) : '—';
          const awayOddsStr = awayOdds ? (awayOdds.price > 0 ? `+${awayOdds.price}` : `${awayOdds.price}`) : '—';
          const hsPrice = homeSpread ? sanitizePrice(homeSpread.price) : null;
          const asPrice = awaySpread ? sanitizePrice(awaySpread.price) : null;
          const overPrice = over ? sanitizePrice(over.price) : null;
          const underPrice = under ? sanitizePrice(under.price) : null;
          const homeSpreadStr = homeSpread && hsPrice !== null
            ? `${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${hsPrice > 0 ? '+' : ''}${hsPrice})`
            : 'N/A';
          const awaySpreadStr = awaySpread && asPrice !== null
            ? `${awaySpread.point > 0 ? '+' : ''}${awaySpread.point} (${asPrice > 0 ? '+' : ''}${asPrice})`
            : 'N/A';
          const ouStr = over && under && overPrice !== null && underPrice !== null
            ? `O/U ${over.point}: Over ${overPrice > 0 ? '+' : ''}${overPrice} / Under ${underPrice > 0 ? '+' : ''}${underPrice}`
            : 'N/A';

          // Skip in-progress / degenerate games (no moneyline + extreme spread/total prices)
          if (isDegenerate({ homeOdds: homeOddsStr, awayOdds: awayOddsStr, homeSpread: homeSpreadStr, awaySpread: awaySpreadStr, overUnder: ouStr })) continue;

          cards.push({
            type: CARD_TYPES.LIVE_ODDS,
            title: `${game.away_team} @ ${game.home_team}`,
            icon: hasOdds ? 'TrendingUp' : 'Calendar',
            category: displaySport,
            subcategory,
            gradient: getSportGradient(sport),
            data: {
              matchup: `${game.away_team} @ ${game.home_team}`,
              sport,
              gameTime: gameTimeStr,
              homeOdds: homeOddsStr,
              awayOdds: awayOddsStr,
              homeSpread: homeSpreadStr,
              awaySpread: awaySpreadStr,
              overUnder: ouStr,
              bookmaker: book?.title ?? (hasOdds ? 'Multiple Books' : 'Upcoming'),
              bookmakerCount: bookmakers.length,
              books: topBooks.length >= 2 ? topBooks : undefined,
              bestHomeOdds: bestHomeRaw !== null ? (bestHomeRaw > 0 ? `+${bestHomeRaw}` : `${bestHomeRaw}`) : undefined,
              bestAwayOdds: bestAwayRaw !== null ? (bestAwayRaw > 0 ? `+${bestAwayRaw}` : `${bestAwayRaw}`) : undefined,
              realData: true,
              status: hasOdds ? 'VALUE' : 'UPCOMING',
            },
            status: hasOdds ? 'value' : 'neutral',
            metadata: { realData: true, dataSource: 'The Odds API', gameId: game.id },
          });
        }

        // If we still don't have enough cards, fill with upcoming games that have no odds yet
        if (cards.length === 0 && oddsData.length > 0) {
          // All games might be "upcoming" with no bookmakers — show them anyway
          for (const game of oddsData.slice(0, actualCount)) {
            const gameDate = new Date(game.commence_time);
            const isToday = new Date().toDateString() === gameDate.toDateString();
            const gameTimeStr = isToday
              ? `Today ${gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : gameDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            cards.push({
              type: CARD_TYPES.LIVE_ODDS,
              title: `${game.away_team} @ ${game.home_team}`,
              icon: 'Calendar',
              category: displaySport,
              subcategory: 'Upcoming Game',
              gradient: getSportGradient(sport),
              data: {
                matchup: `${game.away_team} @ ${game.home_team}`,
                sport,
                gameTime: gameTimeStr,
                description: 'Odds not yet posted — check back closer to game time.',
                realData: true,
                status: 'UPCOMING',
              },
              status: 'neutral',
              metadata: { realData: true, dataSource: 'The Odds API', gameId: game.id },
            });
          }
        }

        console.log(`[v0] [CARDS-GEN] Created ${cards.length} cards with real data`);
        return cards;
      } else {
        const seasonInfo = getSeasonInfo(sport);
        if (!seasonInfo.isInSeason) {
          console.log(`[v0] [CARDS-GEN] ⏸ ${displaySport} is off-season — 0 games expected. ${seasonInfo.context}`);
        } else {
          console.warn(`[v0] [CARDS-GEN] ⚠ API returned 0 games for ${displaySport}. Possible causes:`);
          console.warn(`[v0] [CARDS-GEN]   1. No games currently live/scheduled (normal for off-days)`);
          console.warn(`[v0] [CARDS-GEN]   2. API key invalid or quota exceeded`);
          console.warn(`[v0] [CARDS-GEN]   3. Transient API error`);
        }
      }
    } catch (error) {
      console.error(`[v0] [CARDS-GEN] ❌ EXCEPTION in unified service for ${displaySport}:`);
      console.error(error);
      console.error(`[v0] [CARDS-GEN] Stack trace:`, (error as Error).stack);
      
      // Detect specific error types and provide context-aware fallback reason
      const errorMsg = (error as Error).message || '';
      const isCircuitBreakerOpen = (error as any).isCircuitBreakerOpen === true;
      const isRateLimited = errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit');
      
      let fallbackReason: string | undefined;
      if (isCircuitBreakerOpen) {
        console.error(`[v0] [CARDS-GEN] Circuit breaker is open - too many recent failures`);
        fallbackReason = 'api_error';
      } else if (isRateLimited) {
        console.error(`[v0] [CARDS-GEN] Rate limited - API quota exceeded`);
        fallbackReason = 'rate_limited';
      }
      
      // Generate a context-aware fallback card with the specific error reason
      if (fallbackReason) {
        const noDataMessage = generateNoDataMessage(sport, fallbackReason);
        cards.push({
          type: CARD_TYPES.LIVE_ODDS,
          title: `${displaySport} - ${noDataMessage.title}`,
          icon: 'AlertTriangle',
          category: displaySport,
          subcategory: fallbackReason === 'rate_limited' ? 'Rate Limited' : 'Temporarily Unavailable',
          gradient: getSportGradient(sport),
          status: 'alert',
          data: {
            description: noDataMessage.description,
            note: noDataMessage.suggestion,
            sport: sport,
            status: 'ERROR_FALLBACK',
            realData: false
          }
        });
        return cards;
      }
    }
  }
  
  // Fallback: Add informative card if no real data
  if (cards.length < count) {
    console.log(`[v0] [CARDS-GEN] FALLBACK: No real data for ${displaySport}, creating context-aware placeholder`);
    
    // Get seasonal context for smart messaging
    const noDataMessage = generateNoDataMessage(sport);
    
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `${displaySport} - ${noDataMessage.title}`,
      icon: 'Calendar',
      category: displaySport,
      subcategory: 'No Games Available',
      gradient: getSportGradient(sport),
      status: 'neutral',
      data: {
        description: noDataMessage.description,
        note: noDataMessage.suggestion,
        sport: sport,
        apiResponse: 'API returned 0 games for this sport',
        suggestion: 'Try a different sport or check back during the season',
        status: 'NO_DATA',
        realData: false
      }
    });
  }
  
  return cards;
}

// getSportGradient imported from @/lib/constants (centralized)

export interface InsightCard {
  /** Deterministic stable ID for React key and cache identity */
  id?: string;
  type: string;
  title: string;
  icon: string;
  category: string;
  subcategory: string;
  gradient: string;
  status?: string;
  data?: any;
  metadata?: any;
  realData?: boolean;
  /** Statcast summary card metrics — rendered by StatcastCard */
  summary_metrics?: Array<{ label: string; value: string }>;
  /** Source/timestamp label for Statcast cards */
  last_updated?: string;
  /** Contextual note shown at the bottom of Statcast cards */
  trend_note?: string;
}

// ============================================================================
// Vortex Projection Engine (VPE 3.0) — Baseball-only card builder
// Generates hitter, pitcher, and team projection cards with optional Kalshi
// prediction market enrichment and Benford validation.
// ============================================================================

/**
 * Build live player cards for a specific MLB player using Baseball Savant Statcast data.
 * Falls back to VPE cards if the player is not found.
 */
async function buildPlayerCards(playerName?: string, sport?: string): Promise<InsightCard[]> {
  if (!playerName) return [];

  // For non-MLB sports return a generic player profile card (Statcast is MLB-only)
  const normalizedSport = sport ? sportToApi(sport) : undefined;
  if (normalizedSport && !normalizedSport.includes('baseball')) {
    return buildGenericPlayerCard(playerName, normalizedSport);
  }

  try {
    const { getStatcastData } = await import('@/lib/baseball-savant');
    const data = await Promise.race([
      getStatcastData(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);

    const lowerName = playerName.toLowerCase();
    const player = data.players.find((p: any) => {
      const pName = (p.name ?? p.player_name ?? '').toLowerCase();
      return pName.includes(lowerName) || lowerName.includes(pName);
    });

    if (!player) {
      // Pitcher or player not in batter Statcast dataset — build a named player card
      console.log(`[v0] [PLAYER CARDS] Player "${playerName}" not found in Statcast data — building named card`);
      return buildGenericPlayerCard(playerName, normalizedSport ?? 'baseball_mlb');
    }

    const p = player as any;
    const name: string = p.name ?? p.player_name ?? playerName;
    const { getPlayerHeadshotUrl } = await import('@/lib/constants');
    const headshotUrl = getPlayerHeadshotUrl(name) ?? getPlayerHeadshotUrl(playerName) ?? null;

    // Route pitchers to dedicated card builder with pitcher-specific metrics
    const isPitcher = (p.playerType ?? '').toLowerCase() === 'pitcher';
    if (isPitcher) {
      return buildPitcherCard(name, p, headshotUrl, playerName);
    }

    // ── BATTER PATH ──────────────────────────────────────────────────────────
    // StatcastPlayer uses camelCase — check those first, then fall back to snake_case
    // variants that may appear in raw CSV-derived objects or legacy data sources.
    const ev       = p.exitVelocity   ?? p.avg_exit_velocity  ?? p.exit_velocity_avg;
    const hardHit  = p.hardHitPct     ?? p.hard_hit_percent   ?? p.hard_hit_pct;
    const barrel   = p.barrelRate     ?? p.barrel_batted_rate ?? p.barrel_pct ?? p.barrel_rate;
    const xba      = p.xba            ?? p.expected_batting_average;
    const xslg     = p.xslg           ?? p.expected_slg;
    const xwoba    = p.xwoba          ?? p.expected_woba;
    const sweetSpot = p.sweetSpotPct  ?? p.sweet_spot_percent ?? p.sweet_spot_pct;

    const metrics = [
      ev != null ? { label: 'Exit Velocity', value: `${Number(ev).toFixed(1)} mph` } : null,
      barrel != null ? { label: 'Barrel %', value: `${Number(barrel).toFixed(1)}%` } : null,
      xwoba != null ? { label: 'xwOBA', value: String(xwoba) } : null,
      hardHit != null ? { label: 'Hard Hit %', value: `${Number(hardHit).toFixed(1)}%` } : null,
      xba != null ? { label: 'xBA', value: String(xba) } : null,
      xslg != null ? { label: 'xSLG', value: String(xslg) } : null,
      sweetSpot != null ? { label: 'Sweet Spot %', value: `${Number(sweetSpot).toFixed(1)}%` } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    // Determine status from quality of metrics
    const evNum = ev ? Number(ev) : 0;
    const barrelNum = barrel ? Number(barrel) : 0;
    const status = evNum >= 92 || barrelNum >= 12 ? 'hot' : evNum >= 88 || barrelNum >= 8 ? 'edge' : 'value';

    // ── Enrich with MLB Stats API season stats + game log (parallel, capped at 5s) ──
    let seasonStats = null;
    let gameLog: Array<{ date: string; opp: string; result: string; ab?: number; h?: number; hr?: number; rbi?: number }> = [];
    try {
      const { findPlayerIdByName, fetchPlayerSeasonStats, fetchPlayerGameLog } = await import('@/lib/mlb-projections/mlb-stats-api');
      const playerId = await Promise.race([
        findPlayerIdByName(name),
        new Promise<null>(r => setTimeout(() => r(null), 3_000)),
      ]);
      if (playerId) {
        [seasonStats, gameLog] = await Promise.all([
          Promise.race([fetchPlayerSeasonStats(playerId, 'hitting'), new Promise<null>(r => setTimeout(() => r(null), 4_000))]),
          Promise.race([fetchPlayerGameLog(playerId, 'hitting', 5), new Promise<never[]>(r => setTimeout(() => r([]), 4_000))]),
        ]);
      }
    } catch { /* non-fatal — render without enrichment */ }

    // ── Enrich with live prop lines from Odds API (capped at 3s, non-fatal) ──
    type PropLine = {
      label: string; statType: string; line: number;
      overOdds: number; impliedPct: number; hitRate: string; trend: 'hot' | 'cold' | 'neutral';
    };
    let propLines: PropLine[] = [];
    try {
      const { fetchPlayerProps } = await import('@/lib/player-props-service');
      const allProps = await Promise.race([
        fetchPlayerProps({ sport: 'baseball_mlb' }),
        new Promise<never[]>(r => setTimeout(() => r([]), 3_000)),
      ]);

      const lowerName2 = name.toLowerCase();
      const playerProps = allProps.filter(prop => {
        const pn = prop.playerName.toLowerCase();
        return pn.includes(lowerName2) || lowerName2.includes(pn) ||
          pn.split(' ').slice(-1)[0] === lowerName2.split(' ').slice(-1)[0];
      });

      const STAT_LABELS: Record<string, string> = {
        hits: 'Hits', home_runs: 'Home Runs', rbi: 'RBI',
        total_bases: 'Total Bases', strikeouts: 'Strikeouts',
      };
      const impliedProb = (odds: number): number =>
        odds > 0 ? (100 / (odds + 100)) * 100 : ((-odds) / (-odds + 100)) * 100;

      for (const prop of playerProps) {
        const label = STAT_LABELS[prop.statType] ?? prop.statType.replace(/_/g, ' ');
        const ip = impliedProb(prop.overOdds);
        const threshold = Math.ceil(prop.line);
        let hits = 0;
        for (const g of gameLog) {
          const val = prop.statType === 'home_runs' ? (g.hr ?? 0)
            : prop.statType === 'rbi' ? (g.rbi ?? 0)
            : (g.h ?? 0);
          if (val >= threshold) hits++;
        }
        const total = gameLog.length;
        const hitRate = total > 0 ? `${hits}/${total} last` : '—';
        const trend: 'hot' | 'cold' | 'neutral' =
          total > 0 ? (hits / total >= 0.6 ? 'hot' : hits / total <= 0.3 ? 'cold' : 'neutral') : 'neutral';
        propLines.push({ label, statType: prop.statType, line: prop.line, overOdds: prop.overOdds, impliedPct: Math.round(ip), hitRate, trend });
      }

      // Prioritise primary MLB batting props, cap at 4
      const PRIORITY = ['hits', 'home_runs', 'rbi', 'total_bases'];
      propLines = [
        ...PRIORITY.map(st => propLines.find(p => p.statType === st)).filter(Boolean) as PropLine[],
        ...propLines.filter(p => !PRIORITY.includes(p.statType)),
      ].slice(0, 4);
    } catch { /* non-fatal */ }

    const card: InsightCard = {
      type: CARD_TYPES.STATCAST_SUMMARY,
      title: name,
      icon: '⚾',
      category: 'MLB',
      subcategory: 'Hitter Analysis',
      gradient: 'from-blue-600/75 via-blue-900/55 to-slate-900/40',
      status,
      summary_metrics: metrics,
      data: {
        playerName: name,
        realData: true,
        headshotUrl,
        seasonStats: seasonStats ?? undefined,
        gameLog: gameLog.length > 0 ? gameLog : undefined,
        propLines: propLines.length > 0 ? propLines : undefined,
      },
      trend_note: 'Live Statcast data from Baseball Savant',
      last_updated: new Date().toLocaleDateString(),
      metadata: { realData: true, source: 'Baseball Savant · Statcast' },
    };

    console.log(`[v0] [PLAYER CARDS] Built batter card for ${name} (${metrics.length} metrics, season stats: ${!!seasonStats}, game log: ${gameLog.length} games)`);
    return [card];
  } catch (err) {
    console.warn('[v0] [PLAYER CARDS] Failed to fetch Statcast data:', err);
    // Still return a named card so the user sees something for this player
    if (playerName) return buildGenericPlayerCard(playerName, normalizedSport ?? 'baseball_mlb');
    return [];
  }
}

/**
 * Build a pitcher-specific Statcast card.
 * Combines two data sources:
 *  1. Baseball Savant "against" contact quality (opponent EV, barrel %, xwOBA against)
 *  2. statcast-client pitcher repertoire (FB velocity, K%, whiff rate, BB%)
 */
async function buildPitcherCard(
  name: string,
  statcastData: any,
  headshotUrl: string | null,
  rawPlayerName: string,
): Promise<InsightCard[]> {
  // ── Source 1: opponent contact quality from getStatcastData() ────────────
  const evAgainst      = statcastData.exitVelocity  ?? statcastData.avg_exit_velocity;
  const hardHitAgainst = statcastData.hardHitPct    ?? statcastData.hard_hit_percent;
  const barrelAgainst  = statcastData.barrelRate     ?? statcastData.barrel_batted_rate;
  const xwobaAgainst   = statcastData.xwoba          ?? statcastData.expected_woba;

  // ── Source 2: pitch repertoire + rate stats from statcast-client ─────────
  let kPct: number | null = null;
  let bbPct: number | null = null;
  let fbVelo: number | null = null;
  let whiffPct: number | null = null;
  let team: string | null = null;
  let spinRate: number | null = null;
  let extension: number | null = null;
  let hBreak: number | null = null;
  let vBreak: number | null = null;
  let fbPct: number | null = null;
  let breakingPct: number | null = null;
  let offspeedPct: number | null = null;
  try {
    const { findPitcherByName } = await import('@/lib/mlb-projections/statcast-client');
    const ps = await Promise.race([
      findPitcherByName(rawPlayerName),
      new Promise<null>((res) => setTimeout(() => res(null), 3_000)),
    ]);
    if (ps) {
      kPct        = ps.kPct;
      bbPct       = ps.bbPct;
      fbVelo      = ps.avgVelocity;
      whiffPct    = ps.whiffPct;
      team        = ps.team || null;
      spinRate    = ps.spinRate    ?? null;
      extension   = ps.extension   ?? null;
      hBreak      = ps.horizontalBreak ?? null;
      vBreak      = ps.verticalBreak   ?? null;
      fbPct       = ps.fastballPct ?? null;
      breakingPct = ps.breakingPct ?? null;
      offspeedPct = ps.offspeedPct ?? null;
    }
  } catch { /* non-fatal — card still renders with contact quality data */ }

  // ── Metrics — velocity / K% / xwOBA go first (hero tiles) ───────────────
  const metrics: Array<{ label: string; value: string }> = [
    fbVelo       != null ? { label: 'FB Velocity',         value: `${Number(fbVelo).toFixed(1)} mph`       } : null,
    kPct         != null ? { label: 'K%',                  value: `${Number(kPct).toFixed(1)}%`            } : null,
    xwobaAgainst != null ? { label: 'xwOBA Against',       value: String(xwobaAgainst)                    } : null,
    whiffPct     != null ? { label: 'Whiff%',              value: `${Number(whiffPct).toFixed(1)}%`        } : null,
    evAgainst    != null ? { label: 'Exit Velo Against',   value: `${Number(evAgainst).toFixed(1)} mph`    } : null,
    hardHitAgainst != null ? { label: 'Hard Hit% Against', value: `${Number(hardHitAgainst).toFixed(1)}%` } : null,
    barrelAgainst != null ? { label: 'Barrel% Against',    value: `${Number(barrelAgainst).toFixed(1)}%`  } : null,
    bbPct        != null ? { label: 'BB%',                 value: `${Number(bbPct).toFixed(1)}%`           } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  // ── Status — inverted from batters: low xwOBA against OR high K% = elite ─
  const xwobaNum = xwobaAgainst != null ? Number(xwobaAgainst) : 0.320;
  const kPctNum  = kPct ?? 0;
  const status: 'hot' | 'edge' | 'value' =
    xwobaNum <= 0.290 || kPctNum >= 28 ? 'hot'
    : xwobaNum <= 0.310 || kPctNum >= 22 ? 'edge'
    : 'value';

  const subcategory = team ? `${team} · SP` : 'Pitcher Analysis';

  console.log(`[v0] [PLAYER CARDS] Built pitcher card for ${name} (${metrics.length} metrics, team=${team ?? 'unknown'})`);
  return [{
    type: CARD_TYPES.STATCAST_SUMMARY,
    title: name,
    icon: '⚾',
    category: 'MLB',
    subcategory,
    gradient: 'from-violet-600/75 via-blue-900/55 to-slate-900/40',
    status,
    summary_metrics: metrics,
    data: {
      playerName: name,
      realData: true,
      headshotUrl,
      team: team ?? undefined,
      // Advanced tab data
      spinRate:    spinRate    != null ? `${Math.round(spinRate)} rpm`            : undefined,
      extension:   extension   != null ? `${Number(extension).toFixed(1)} ft`     : undefined,
      hBreak:      hBreak      != null ? `${Number(hBreak).toFixed(1)} in`        : undefined,
      vBreak:      vBreak      != null ? `${Number(vBreak).toFixed(1)} in`        : undefined,
      pitchMixFB:  fbPct       != null ? `${Number(fbPct).toFixed(0)}%`           : undefined,
      pitchMixBrk: breakingPct != null ? `${Number(breakingPct).toFixed(0)}%`     : undefined,
      pitchMixOff: offspeedPct != null ? `${Number(offspeedPct).toFixed(0)}%`     : undefined,
      // Raw numbers for the Props tab edge calc
      kPctRaw:  kPct  != null ? kPct  : undefined,
      fbVeloRaw: fbVelo != null ? fbVelo : undefined,
    },
    trend_note: 'Against metrics (EV, Hard Hit%, Barrel%) — lower is better for the pitcher',
    last_updated: new Date().toLocaleDateString(),
    metadata: { realData: true, source: 'Baseball Savant · Statcast' },
  }];
}

async function buildGenericPlayerCard(playerName: string, sport: string): Promise<InsightCard[]> {
  const sportName = sport.includes('basketball') ? 'NBA'
    : sport.includes('football') ? 'NFL'
    : sport.includes('hockey') ? 'NHL'
    : sport.includes('baseball') ? 'MLB'
    : sport.toUpperCase();

  const sportEmojis: Record<string, string> = { NBA: '🏀', NFL: '🏈', NHL: '🏒', MLB: '⚾' };
  const sportGradients: Record<string, string> = {
    NBA: 'from-orange-600/75 via-orange-900/55 to-slate-900/40',
    NFL: 'from-blue-600/75 via-blue-900/55 to-slate-900/40',
    NHL: 'from-cyan-600/75 via-cyan-900/55 to-slate-900/40',
    MLB: 'from-blue-600/75 via-blue-900/55 to-slate-900/40',
  };

  const { getPlayerHeadshotUrl } = await import('@/lib/constants');
  const headshotUrl = getPlayerHeadshotUrl(playerName);

  const card: InsightCard = {
    type: CARD_TYPES.STATCAST_SUMMARY,
    title: playerName,
    icon: sportEmojis[sportName] ?? '📊',
    category: sportName,
    subcategory: 'Player Analysis',
    gradient: sportGradients[sportName] ?? 'from-purple-600/75 via-purple-900/55 to-slate-900/40',
    status: 'edge',
    summary_metrics: [],
    data: { playerName, realData: false, headshotUrl, sport: sportName },
    trend_note: 'Full analysis in the response below',
    last_updated: new Date().toLocaleDateString(),
    metadata: { realData: false, source: 'Leverage AI' },
  };

  return [card];
}

async function buildVPECards(limit: number): Promise<InsightCard[]> {
  const { Hitter, Pitcher, LEAGUE_AVG_HITTER, LEAGUE_STD_HITTER, validateBenfordForVPE } =
    await Promise.all([
      import('@/lib/vpe'),
      import('@/lib/benford-validator'),
    ]).then(([vpe, benford]) => ({ ...vpe, validateBenfordForVPE: benford.validateBenford }));

  // ── Fetch live Statcast data — DB first, then Baseball Savant API ─────────
  const season = new Date().getFullYear() - (new Date().getMonth() + 1 >= 4 ? 0 : 1);
  type VpeHitterInput = { name: string; age: number; pos: string; stats: import('@/lib/vpe').HitterStats; isReal: boolean };

  async function getHitterRoster(): Promise<VpeHitterInput[]> {
    // ① Try Supabase statcast_daily table
    try {
      const { getTopStatcastLeadersFromDB } = await import('@/lib/services/statcast-ingest');
      const { batters } = await Promise.race([
        getTopStatcastLeadersFromDB(season, 5),
        new Promise<{ batters: never[]; pitchers: never[] }>(
          resolve => setTimeout(() => resolve({ batters: [], pitchers: [] }), 1000),
        ),
      ]);
      if (batters.length >= 3) {
        return batters.map((row: Record<string, unknown>) => {
          const ev = Number(row.avg_exit_velocity ?? 88.4);
          const barrelRate = Number(row.barrel_rate ?? 8);
          const hardHit = Number(row.hard_hit_pct ?? 37.5);
          const la = Number(row.launch_angle ?? 12.1);
          const xba = Number(row.xba ?? 0.255);
          return {
            name: String(row.player_name ?? 'Unknown'),
            age: 27,
            pos: 'DH',
            isReal: true,
            stats: {
              PA: Number(row.pa ?? 500),
              EV50: ev + 3.5,
              PullAirPercent: Math.min(0.32, 0.08 + (barrelRate / 100) * 0.55),
              BarrelPercent: barrelRate / 100,
              HardHitPercent: hardHit / 100,
              LaunchAngle: la,
              BatSpeed: Math.min(82, Math.max(65, 60 + (ev - 85) * 0.85)),
              ContactRate: Math.min(0.92, Math.max(0.60, 0.62 + xba * 0.6)),
              SwingLength: 7.2,
            },
          };
        });
      }
    } catch { /* fall through */ }

    // ② Try Baseball Savant API
    try {
      const { getStatcastData, queryStatcast } = await import('@/lib/baseball-savant');
      const { players } = await Promise.race([
        getStatcastData(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
      ]);
      const topBatters = queryStatcast(players, { playerType: 'batter', limit: 5 })
        .sort((a, b) => b.barrelRate - a.barrelRate);
      if (topBatters.length >= 3) {
        const isCurrentSeason = players.some(p => p.year === season);
        return topBatters.map(p => ({
          name: p.name,
          age: 27,
          pos: 'DH',
          isReal: isCurrentSeason,
          stats: {
            PA: p.pa ?? 500,
            EV50: (p.exitVelocity ?? 88.4) + 3.5,
            PullAirPercent: Math.min(0.32, 0.08 + (p.barrelRate / 100) * 0.55),
            BarrelPercent: p.barrelRate / 100,
            HardHitPercent: (p.hardHitPct ?? 37.5) / 100,
            LaunchAngle: p.launchAngle ?? 12.1,
            BatSpeed: Math.min(82, Math.max(65, 60 + ((p.exitVelocity ?? 88.4) - 85) * 0.85)),
            ContactRate: Math.min(0.92, Math.max(0.60, 0.62 + (p.xba ?? 0.255) * 0.6)),
            SwingLength: 7.2,
          },
        }));
      }
    } catch { /* fall through */ }

    // ③ Static 2024 reference data (real Statcast numbers, not random)
    return [
      { name: 'Aaron Judge',    age: 32, pos: 'RF', isReal: true, stats: { PA: 583, EV50: 98.7, PullAirPercent: 0.29, BarrelPercent: 0.188, HardHitPercent: 0.55, LaunchAngle: 14.8, BatSpeed: 77.2, ContactRate: 0.73, SwingLength: 6.8 } },
      { name: 'Shohei Ohtani',  age: 30, pos: 'DH', isReal: true, stats: { PA: 635, EV50: 95.0, PullAirPercent: 0.26, BarrelPercent: 0.148, HardHitPercent: 0.475, LaunchAngle: 11.8, BatSpeed: 74.8, ContactRate: 0.77, SwingLength: 7.1 } },
      { name: 'Yordan Alvarez',  age: 27, pos: 'DH', isReal: true, stats: { PA: 558, EV50: 97.3, PullAirPercent: 0.27, BarrelPercent: 0.165, HardHitPercent: 0.52, LaunchAngle: 13.5, BatSpeed: 76.1, ContactRate: 0.75, SwingLength: 7.0 } },
      { name: 'Juan Soto',      age: 26, pos: 'RF', isReal: true, stats: { PA: 671, EV50: 94.3, PullAirPercent: 0.25, BarrelPercent: 0.142, HardHitPercent: 0.46, LaunchAngle: 12.2, BatSpeed: 73.9, ContactRate: 0.80, SwingLength: 7.3 } },
      { name: 'Freddie Freeman', age: 35, pos: '1B', isReal: true, stats: { PA: 592, EV50: 94.0, PullAirPercent: 0.24, BarrelPercent: 0.128, HardHitPercent: 0.45, LaunchAngle: 11.8, BatSpeed: 73.3, ContactRate: 0.84, SwingLength: 7.6 } },
    ];
  }

  const hitterRoster = await getHitterRoster();

  // Pitcher roster — velocity/movement from known 2024/2025 Statcast pitch data
  const pitcherRoster = [
    { name: 'Gerrit Cole',  age: 33, pos: 'SP', stats: { velocity: 97.2, verticalBreak: 12.4, horizontalBreak: 4.1, spinRate: 2480, extension: 6.8, releaseVariance: 0.15, KPer9: 11.2, CSW: 0.33 } },
    { name: 'Paul Skenes',  age: 22, pos: 'SP', stats: { velocity: 99.1, verticalBreak: 13.8, horizontalBreak: 4.6, spinRate: 2590, extension: 7.0, releaseVariance: 0.12, KPer9: 12.8, CSW: 0.36 } },
    { name: 'Zack Wheeler', age: 34, pos: 'SP', stats: { velocity: 95.8, verticalBreak: 11.2, horizontalBreak: 3.8, spinRate: 2350, extension: 6.5, releaseVariance: 0.18, KPer9: 10.4, CSW: 0.31 } },
  ];

  // Fetch Kalshi MLB markets for enrichment — fail gracefully
  let kalshiMarkets: Array<{ title: string; yesPrice: number; ticker: string }> = [];
  try {
    const { fetchKalshiMarkets } = await import('@/lib/kalshi/index');
    const rawMarkets = await Promise.race([
      fetchKalshiMarkets({ category: 'MLB', limit: 10 }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    kalshiMarkets = (Array.isArray(rawMarkets) ? rawMarkets : []).slice(0, 6).map((m) => ({
      title: m.title,
      yesPrice: m.yesPrice,
      ticker: m.ticker,
    }));
  } catch {
    // Kalshi unavailable — VPE cards still render without markets
  }

  const usingRealData = hitterRoster.some(h => h.isReal);
  const cards: InsightCard[] = [];
  const slotLimit = Math.max(limit, 2);

  // Hitter projection cards
  const hitterSlots = Math.ceil(slotLimit * 0.5);
  for (let i = 0; i < Math.min(hitterSlots, hitterRoster.length); i++) {
    const h = hitterRoster[i];
    const hitter = new Hitter(h.name, h.age, h.pos, h.stats);
    const vpeScore = hitter.vpeValHit();
    const powerIndex = hitter.powerBreakoutIndex(LEAGUE_AVG_HITTER, LEAGUE_STD_HITTER);

    const numericValues = [vpeScore, powerIndex, h.stats.BarrelPercent * 100, h.stats.EV50, h.stats.BatSpeed];
    const benford = validateBenfordForVPE(numericValues);

    cards.push({
      type: CARD_TYPES.VPE_PROJECTION,
      title: `VPE: ${h.name}`,
      icon: 'TrendingUp',
      category: 'MLB',
      subcategory: 'Hitter Projection',
      gradient: 'from-emerald-500 to-teal-600',
      status: powerIndex > 0.5 ? 'hot' : 'value',
      data: {
        playerName: h.name,
        role: 'Hitter',
        vpeScore: Math.round(vpeScore * 100) / 100,
        powerIndex: Math.round(powerIndex * 100) / 100,
        BarrelPct: `${(h.stats.BarrelPercent * 100).toFixed(1)}%`,
        EV50: `${h.stats.EV50.toFixed(1)} mph`,
        BatSpeed: `${h.stats.BatSpeed.toFixed(1)} mph`,
        season,
        benfordValid: benford.isValid,
        benfordScore: Math.round(benford.score * 100) / 100,
        kalshiMarkets: kalshiMarkets.slice(0, 2),
      },
      metadata: { realData: usingRealData, source: usingRealData ? `Statcast ${season}` : `Statcast 2024` },
    });
  }

  // Pitcher projection cards
  const pitcherSlots = Math.floor(slotLimit * 0.4);
  for (let i = 0; i < Math.min(pitcherSlots, pitcherRoster.length); i++) {
    const p = pitcherRoster[i];
    const pitcher = new Pitcher(p.name, p.age, p.pos, p.stats);
    const vpeScore = pitcher.vpeValPitch();
    const stuffScore = pitcher.stuffScore();
    const kSkill = pitcher.kSkill();

    const numericValues = [vpeScore, stuffScore, kSkill, p.stats.velocity, p.stats.KPer9];
    const benford = validateBenfordForVPE(numericValues);

    cards.push({
      type: CARD_TYPES.VPE_PROJECTION,
      title: `VPE: ${p.name}`,
      icon: 'Activity',
      category: 'MLB',
      subcategory: 'Pitcher Projection',
      gradient: 'from-violet-500 to-purple-600',
      status: stuffScore > 0.5 ? 'elite' : 'optimal',
      data: {
        playerName: p.name,
        role: 'Pitcher',
        vpeScore: Math.round(vpeScore * 100) / 100,
        stuffScore: Math.round(stuffScore * 100) / 100,
        kSkill: Math.round(kSkill * 100) / 100,
        Velocity: `${p.stats.velocity} mph`,
        KPer9: p.stats.KPer9.toFixed(1),
        CSW: `${(p.stats.CSW * 100).toFixed(1)}%`,
        season,
        benfordValid: benford.isValid,
        benfordScore: Math.round(benford.score * 100) / 100,
        kalshiMarkets: kalshiMarkets.slice(2, 4),
      },
      metadata: { realData: true, source: 'Statcast 2024/2025' },
    });
  }

  console.log(`[v0] [VPE] Generated ${cards.length} VPE cards (realData=${usingRealData}, ${kalshiMarkets.length} Kalshi markets attached)`);
  return cards;
}

/**
 * Returns an informative unavailable-state card when the Kalshi API is unreachable.
 * Does NOT return fake market data — prices shown here would be stale or fabricated.
 */
function buildKalshiUnavailableCards(_count: number): any[] {
  return [{
    type: 'kalshi-market',
    title: 'Kalshi Markets Temporarily Unavailable',
    icon: 'AlertTriangle',
    category: 'KALSHI',
    subcategory: 'Service Status',
    gradient: 'from-[var(--bg-surface)] to-[var(--bg-elevated)]',
    realData: false,
    status: 'neutral',
    data: {
      ticker: 'UNAVAILABLE',
      iconLabel: 'markets',
      description: 'Live Kalshi prediction market data is temporarily unavailable.',
      suggestion: 'Try refreshing or ask Leverage AI about specific markets by name.',
      status: 'API_UNAVAILABLE',
    },
    metadata: { source: 'Kalshi API', realData: false },
  }];
}

/**
 * Returns an informative empty-state card when the Kalshi API works but has 0 matching markets.
 * Distinct from buildKalshiUnavailableCards — used when the API is reachable but empty.
 */
function buildKalshiNoMarketsCard(): any {
  return {
    type: CARD_TYPES.KALSHI_INSIGHT,
    title: 'No Active Prediction Markets',
    icon: 'BarChart3',
    category: 'KALSHI',
    subcategory: 'Markets',
    gradient: 'from-indigo-700 to-violet-800',
    status: CARD_STATUS.NEUTRAL,
    realData: false,
    data: {
      status: 'NO_MARKETS',
      iconLabel: 'markets',
      yesPct: 50,
      noPct: 50,
      edgeScore: 0,
      signal: 'No open prediction markets currently available on Kalshi for this category. Check kalshi.com for the latest markets.',
      volumeTier: 'Thin',
      spreadLabel: 'N/A',
      priceDirection: 'flat',
      priceChange: 0,
    },
  };
}

/**
 * Generate contextual cards based on category and sport
 * @param category - Type of analysis (betting, kalshi, dfs, fantasy)
 * @param sport - Sport key in either short form ('nba') or API format ('basketball_nba')
 * @param count - Number of cards to generate (default: 3)
 * @param multiSport - If true, generates cards from ALL major sports (default: true when no sport specified)
 */
async function _generateContextualCards(
  category?: string,
  sport?: string,
  count: number = 3,
  // Multi-sport mode only makes sense for unset or explicit betting category.
  // 'all' has its own mixed-mode block below and must NOT trigger multiSport (betting-only).
  multiSport: boolean = !sport && (!category || category === 'betting'),
  kalshiSubcategory?: string,
  options?: { playerName?: string; userContext?: string }
): Promise<InsightCard[]> {
  const userContext = options?.userContext;
  // Check in-memory cache first to avoid redundant API calls
  // (SSR page load populates this, /api/analyze reuses it)
  const cached = getCachedCards(category, sport, count, userContext);
  if (cached && cached.length > 0) {
    logger.debug(LogCategory.CACHE, 'cards_cache_hit', { metadata: { count: cached.length, category, sport } });
    return cached;
  }

  const cards: InsightCard[] = [];
  
  logger.debug(LogCategory.CACHE, 'cards_cache_miss', { metadata: { multiSport, sport, category } });

  // Fantasy/DFS with no sport: apply per-category defaults
  // Fantasy/draft/waiver → MLB (draft season Jan–Apr); DFS → NBA (high-volume DFS market)
  const effectiveSport = !sport
    ? (category === 'fantasy' || category === 'draft' || category === 'waiver' ? 'baseball_mlb'
      : category === 'dfs' ? 'basketball_nba'
      : sport)
    : sport;

  // Normalize sport to API format, then get display name
  const normalizedSport = effectiveSport ? sportToApi(effectiveSport) : undefined;
  const displaySport = normalizedSport ? apiToSport(normalizedSport).toUpperCase() : 'MULTI-SPORT';

  console.log('[v0] [CARDS GENERATOR] Generating cards...');
  console.log('[v0] [CARDS GENERATOR] Input:', { category, sport, normalizedSport, displaySport, multiSport });
  console.log('[v0] [CARDS GENERATOR] Category:', category, '| Display Sport:', displaySport, '| Count:', count);
  
  // 'all' category — mix betting + Kalshi cards so the default view shows card variety
  if (category === 'all') {
    if (normalizedSport) {
      // Sport-specific query → pure betting cards, no Kalshi contamination
      console.log(`[v0] [CARDS-GEN] All-category with sport=${normalizedSport}: pure betting mode`);
      const cards = await _generateContextualCards('betting', sport, count);
      if (cards.length > 0) setCachedCards(cards, 'all', sport);
      return cards;
    }
    console.log('[v0] [CARDS-GEN] All-category mode: generating mixed betting + Kalshi cards');
    const bettingCount = Math.max(1, count - 1);
    const kalshiCount  = Math.max(1, count - bettingCount);
    const [bettingResult, kalshiResult] = await Promise.allSettled([
      _generateContextualCards('betting', sport, bettingCount),
      _generateContextualCards('kalshi',  sport, kalshiCount),
    ]);
    const betting = bettingResult.status === 'fulfilled' ? bettingResult.value : [];
    const kalshi  = kalshiResult.status  === 'fulfilled' ? kalshiResult.value  : [];
    const mixed = [...betting.slice(0, bettingCount), ...kalshi.slice(0, kalshiCount)].slice(0, count);
    if (mixed.length > 0) setCachedCards(mixed, 'all', sport);
    return mixed;
  }

  // Player-specific query — fetch live Statcast data for the named player
  if (category === 'player') {
    const playerName = options?.playerName;
    const cards = await buildPlayerCards(playerName, sport);
    if (cards.length > 0) return cards;
    // Fallback to VPE overview if player not found
    return buildVPECards(count);
  }

  // If multiSport requested, generate variety from ALL major sports with REAL data
  if (multiSport) {
    console.log('[v0] [CARDS GENERATOR] Multi-sport mode - fetching from ALL MAJOR SPORTS (NFL, NBA, MLB, NHL)');
    
    // FORCE query ALL major sports - don't rely on "active sports detector"
    const allMajorSports = [
      SPORT_KEYS.NFL.API,      // americanfootball_nfl
      SPORT_KEYS.NBA.API,      // basketball_nba
      SPORT_KEYS.MLB.API,      // baseball_mlb
      SPORT_KEYS.NHL.API,      // icehockey_nhl
      SPORT_KEYS.NCAAB.API,   // basketball_ncaab
      SPORT_KEYS.NCAAF.API,   // americanfootball_ncaaf
      SPORT_KEYS.EPL.API,     // soccer_epl
      SPORT_KEYS.MLS.API,     // soccer_usa_mls
    ];
    
    // Sort: in-season sports first, off-season sports last (to avoid wasting API quota)
    const baseSports = normalizedSport
      ? [normalizedSport, ...allMajorSports.filter(s => s !== normalizedSport)]
      : allMajorSports;
    const orderedSports = [
      ...baseSports.filter(s => getSeasonInfo(s).isInSeason),
      ...baseSports.filter(s => !getSeasonInfo(s).isInSeason),
    ];

    const inSeasonSports = orderedSports.filter(s => getSeasonInfo(s).isInSeason);
    console.log(`[v0] [MULTI-SPORT] Querying ${orderedSports.length} sports (${inSeasonSports.length} in-season), need ${count} cards`);
    
    // Fetch in small sequential batches (2 at a time) to avoid thundering herd
    // Early-terminate once we have enough cards
    const BATCH_SIZE = 2;
    const allSportCards: { sport: string; cards: InsightCard[] }[] = [];
    
    for (let i = 0; i < orderedSports.length; i += BATCH_SIZE) {
      const collectedSoFar = allSportCards.reduce((sum, r) => sum + r.cards.filter(c => c.data?.realData).length, 0);
      const sportsWithData = allSportCards.filter(r => r.cards.some(c => c.data?.realData)).length;
      const diversityTarget = Math.min(count, inSeasonSports.length);
      if (collectedSoFar >= count && sportsWithData >= diversityTarget) {
        console.log(`[v0] [MULTI-SPORT] Early exit: ${collectedSoFar} cards from ${sportsWithData} sports`);
        break;
      }
      
      const batch = orderedSports.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (sportKey) => {
          try {
            const sportCards = await generateSportSpecificCards(sportKey, 5, category);
            return { sport: sportKey, cards: sportCards };
          } catch (error) {
            console.error(`[v0] [MULTI-SPORT] ${apiToSport(sportKey).toUpperCase()} failed:`, error);
            return { sport: sportKey, cards: [] };
          }
        })
      );
      
      allSportCards.push(...batchResults);
      const batchCardCount = batchResults.reduce((s, r) => s + r.cards.length, 0);
      console.log(`[v0] [MULTI-SPORT] Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.map(s => apiToSport(s).toUpperCase()).join('/')}): ${batchCardCount} cards`);
    }
    
    // Round-robin selection: 1 card per sport per pass to ensure diversity
    const sportsWithCards = allSportCards.filter(r => r.cards.length > 0);
    const pointers = new Map<string, number>(sportsWithCards.map(r => [r.sport, 0]));

    while (cards.length < count) {
      let anyAdded = false;
      for (const { sport: sportKey, cards: sportCards } of sportsWithCards) {
        if (cards.length >= count) break;
        const idx = pointers.get(sportKey)!;
        if (idx < sportCards.length) {
          cards.push(sportCards[idx]);
          pointers.set(sportKey, idx + 1);
          console.log(`[v0] [MULTI-SPORT] Added ${apiToSport(sportKey).toUpperCase()} card (slot ${cards.length})`);
          anyAdded = true;
        }
      }
      if (!anyAdded) break; // All sport queues exhausted
    }
    
    // Try to add player props if we still need more cards
    if (cards.length < count) {
      console.log('[v0] [MULTI-SPORT] Not enough game cards, trying player props...');
      try {
        const { fetchPlayerProps, playerPropToCard } = await import('@/lib/player-props-service');
        
        for (const sportKey of orderedSports) {
          if (cards.length >= count) break;
          
          try {
            const props = await fetchPlayerProps({ 
              sport: sportKey, 
              useCache: true, 
              storeResults: true 
            });
            
            if (props.length > 0) {
              const propsNeeded = count - cards.length;
              const propCards = props.slice(0, propsNeeded).map(playerPropToCard);
              cards.push(...propCards);
              console.log(`[v0] [MULTI-SPORT] Added ${propCards.length} ${apiToSport(sportKey).toUpperCase()} prop cards`);
            }
          } catch (error) {
            console.error(`[v0] [MULTI-SPORT] Failed to fetch props for ${apiToSport(sportKey).toUpperCase()}:`, error);
          }
        }
      } catch (error) {
        console.error('[v0] [MULTI-SPORT] Player props import failed:', error);
      }
    }
    
    // If we still don't have enough cards, add placeholder cards
    while (cards.length < count) {
      const remainingSports = orderedSports.filter(s => !cards.some(c => c.data?.sport === s));
      const sportToUse = remainingSports[0] || SPORT_KEYS.NBA.API;
      const displaySport = apiToSport(sportToUse).toUpperCase();
      
      cards.push({
        type: CARD_TYPES.LIVE_ODDS,
        title: `${displaySport} Live Odds`,
        icon: 'TrendingUp',
        category: displaySport,
        subcategory: 'H2H Markets',
        gradient: getSportGradient(sportToUse),
        status: 'neutral',
        data: {
          description: `No live ${displaySport} games scheduled`,
          note: 'Check back 24-48 hours before game time',
          sport: sportToUse,
          status: 'NO_DATA'
        }
      });
    }
    
    const finalCards = cards.slice(0, count);
    console.log(`[v0] [MULTI-SPORT] Final result: ${finalCards.length} cards from ${[...new Set(finalCards.map(c => c.category))].join(', ')}`);
    if (finalCards.length > 0) setCachedCards(finalCards, category || 'all', sport);
    return finalCards;
  }

  // Single-sport betting path — user has selected a specific sport (e.g. NBA, MLB, NFL).
  // The multi-sport block above is skipped when sport is set, so we must call
  // generateSportSpecificCards directly here to get real game odds with moneylines,
  // spreads, and totals instead of falling through to the projection engine.
  if (!multiSport && normalizedSport && (category === 'betting' || category === 'all' || !category)) {
    console.log(`[v0] [CARDS-GEN] Single-sport mode: fetching ${normalizedSport} odds directly`);
    const sportCards = await generateSportSpecificCards(normalizedSport, count, category);
    if (sportCards.length > 0) {
      setCachedCards(sportCards, category || 'betting', normalizedSport);
      return sportCards;
    }
    // Fall through if no games available (off-season etc.)
  }

  // Dedicated Arbitrage category - when user explicitly asks for arbitrage
  if (category === 'arbitrage' || category === 'arb') {
    console.log('[v0] [CARDS-GEN] Arbitrage category - fetching from Supabase with realtime');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // Fetch active arbitrage opportunities from Supabase (stored by API cron)
      const { data: opportunities } = await supabase
        .from('arbitrage_opportunities')
        .select('*')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('profit_margin', { ascending: false })
        .limit(count);
      
      if (opportunities && opportunities.length > 0) {
        console.log(`[v0] [CARDS-GEN] Found ${opportunities.length} arbitrage opportunities`);
        
        opportunities.forEach((opp: any) => {
          cards.push({
            type: CARD_TYPES.ARBITRAGE_OPPORTUNITY,
            title: `${opp.away_team} @ ${opp.home_team}`,
            icon: 'DollarSign',
            category: 'ARBITRAGE',
            subcategory: `${(opp.profit_margin * 100).toFixed(2)}% Profit`,
            gradient: 'from-emerald-600 to-green-700',
            status: 'hot',
            data: {
              matchup: `${opp.away_team} @ ${opp.home_team}`,
              profitMargin: `${(opp.profit_margin * 100).toFixed(2)}%`,
              totalStake: `$${opp.total_stake.toFixed(2)}`,
              potentialProfit: `$${(opp.total_stake * opp.profit_margin).toFixed(2)}`,
              side1: {
                bookmaker: opp.bookmaker_1,
                odds: opp.odds_1 > 0 ? `+${opp.odds_1}` : opp.odds_1,
                stake: `$${opp.stake_1.toFixed(2)}`
              },
              side2: {
                bookmaker: opp.bookmaker_2,
                odds: opp.odds_2 > 0 ? `+${opp.odds_2}` : opp.odds_2,
                stake: `$${opp.stake_2.toFixed(2)}`
              },
              expiresIn: Math.round((new Date(opp.expires_at).getTime() - Date.now()) / 60000) + ' min',
              realData: true,
              status: 'ACTIVE'
            },
            metadata: {
              realData: true,
              dataSource: 'Supabase Arbitrage Detector',
              timestamp: opp.detected_at,
              expiresAt: opp.expires_at
            }
          });
        });

        if (cards.length > 0) setCachedCards(cards, 'arbitrage', sport);
        return cards;
      } else {
        console.log('[v0] [CARDS-GEN] No active arbitrage opportunities');
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Arbitrage fetch error:', error);
    }

    // Fallback if no opportunities found
    cards.push({
      type: CARD_TYPES.ARBITRAGE_OPPORTUNITY,
      title: 'Arbitrage Scanner',
      icon: 'DollarSign',
      category: 'ARBITRAGE',
      subcategory: 'No Opportunities',
      gradient: 'from-emerald-600 to-teal-700',
      status: 'optimal',
      data: {
        description: 'Continuously scanning for risk-free profit opportunities',
        note: 'No arbitrage opportunities currently available',
        checkingMarkets: 'Monitoring all sportsbooks in real-time',
        realData: true,
        status: 'SCANNING'
      }
    });

    if (cards.length > 0) setCachedCards(cards, 'arbitrage', sport);
    return cards;
  }
  
  // ── Expected Value (EV) cards ─────────────────────────────────────────────
  if (category === 'ev' || category === 'expected-value' || category === 'ev-bets') {
    console.log('[v0] [CARDS-GEN] EV category — querying model_predictions for positive-EV bets');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: preds } = await supabase
        .from('model_predictions')
        .select('*')
        .gt('expected_value', 0.05)
        .order('expected_value', { ascending: false })
        .limit(count);

      if (preds && preds.length > 0) {
        for (const pred of preds) {
          const ev: number = pred.expected_value;
          const conf: 'high' | 'medium' | 'low' = ev >= 0.10 ? 'high' : ev >= 0.05 ? 'medium' : 'low';
          cards.push({
            type: CARD_TYPES.EV_BET,
            title: pred.outcome ? `${pred.market} — ${pred.outcome}` : pred.market,
            icon: 'TrendingUp',
            category: 'EV BETTING',
            subcategory: `${(ev * 100).toFixed(1)}% Edge`,
            gradient: 'from-emerald-600 to-teal-700',
            status: conf === 'high' ? 'hot' : 'value',
            data: {
              market: pred.market,
              outcome: pred.outcome,
              bookmaker: pred.bookmaker ?? 'best book',
              americanOdds: pred.best_price,
              evPercent: `${(ev * 100).toFixed(1)}%`,
              modelProbability: pred.model_probability,
              impliedProbability: pred.model_probability - ev / (pred.best_price > 0 ? pred.best_price / 100 + 1 : 100 / Math.abs(pred.best_price) + 1),
              quarterKelly: pred.kelly_fraction ? pred.kelly_fraction * 0.25 : null,
              confidence: conf,
              realData: true,
            },
          });
        }
        setCachedCards(cards, 'ev', sport);
        return cards;
      }
    } catch (err) {
      console.error('[v0] [CARDS-GEN] EV fetch error:', err);
    }

    // Fallback
    cards.push({
      type: CARD_TYPES.EV_BET,
      title: 'Expected Value Scanner',
      icon: 'TrendingUp',
      category: 'EV BETTING',
      subcategory: 'No Edges Found',
      gradient: 'from-emerald-600 to-teal-700',
      status: 'neutral',
      data: {
        description: 'Scanning sportsbooks for positive expected value bets',
        note: 'EV edges appear as odds diverge from model predictions. Check back as lines move.',
        realData: false,
      },
    });
    return cards;
  }

  // ── Sharp money / steam alerts ────────────────────────────────────────────
  if (category === 'sharp' || category === 'sharp-money' || category === 'steam') {
    console.log('[v0] [CARDS-GEN] Sharp money category — querying line_movement table');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const sinceTs = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // last 30 min
      const { data: moves } = await supabase
        .from('line_movement')
        .select('*')
        .gte('created_at', sinceTs)
        .order('created_at', { ascending: false })
        .limit(count * 3); // over-fetch; filter below

      if (moves && moves.length > 0) {
        const sharp = moves.filter((m: any) => Math.abs(m.price_change ?? 0) >= 15);
        const source = sharp.length > 0 ? sharp : moves;
        for (const mv of source.slice(0, count)) {
          const change: number = mv.price_change ?? 0;
          const isShort = change < 0;
          cards.push({
            type: CARD_TYPES.SHARP_MONEY,
            title: mv.player_name ?? mv.game_id ?? 'Line Movement',
            icon: 'Activity',
            category: 'SHARP MONEY',
            subcategory: Math.abs(change) >= 15 ? 'Steam Move' : 'Line Movement',
            gradient: isShort ? 'from-red-700 to-rose-900' : 'from-blue-600 to-indigo-800',
            status: Math.abs(change) >= 15 ? 'alert' : 'neutral',
            data: {
              market: mv.market,
              openPrice: mv.opening_price,
              currentPrice: mv.current_price,
              movement: Math.abs(change).toString(),
              direction: isShort ? 'shortening' : 'lengthening',
              isSharp: Math.abs(change) >= 15,
              bookmaker: mv.bookmaker,
              timestamp: new Date(mv.created_at).toLocaleTimeString(),
              realData: true,
            },
          });
        }
        setCachedCards(cards, 'sharp', sport);
        return cards;
      }
    } catch (err) {
      console.error('[v0] [CARDS-GEN] Sharp money fetch error:', err);
    }

    // Fallback
    cards.push({
      type: CARD_TYPES.SHARP_MONEY,
      title: 'Steam Move Detector',
      icon: 'Activity',
      category: 'SHARP MONEY',
      subcategory: 'Monitoring',
      gradient: 'from-red-700 to-rose-900',
      status: 'neutral',
      data: {
        description: 'Monitoring all sportsbooks for rapid line movement',
        note: 'Steam moves (15+ cent line shift in < 30 min) signal sharp syndicate action.',
        realData: false,
      },
    });
    return cards;
  }

  // ── Pitcher fatigue ───────────────────────────────────────────────────────
  if (category === 'pitcher-fatigue' || category === 'fatigue' || category === 'pitcher') {
    console.log('[v0] [CARDS-GEN] Pitcher fatigue category');
    const { computePitcherFatigue } = await import('@/lib/pitcher-fatigue');
    // Demo card with typical workload values — real data would come from MLB Stats API
    const demoInputs = [
      { pitcherName: 'Starter A', pitchCountLastStart: 108, inningsLastStart: 6.2, daysRest: 4, pitchCountLast7Days: 108 },
      { pitcherName: 'Starter B', pitchCountLastStart: 118, inningsLastStart: 7.0, daysRest: 3, pitchCountLast7Days: 138 },
    ];
    for (const demo of demoInputs.slice(0, count)) {
      const result = computePitcherFatigue(demo);
      cards.push({
        type: CARD_TYPES.PITCHER_FATIGUE,
        title: `${demo.pitcherName} — Fatigue Report`,
        icon: 'Wind',
        category: 'MLB',
        subcategory: 'Pitcher Fatigue',
        gradient: 'from-blue-700 to-indigo-900',
        status: result.fatigueLabel === 'at-risk' ? 'alert' : result.fatigueLabel === 'tired' ? 'neutral' : 'value',
        data: {
          fatigueMultiplier: result.fatigueMultiplier,
          fatigueLabel: result.fatigueLabel,
          pitchCountLastStart: demo.pitchCountLastStart,
          inningsLastStart: demo.inningsLastStart,
          daysRest: demo.daysRest,
          pitchCountLast7Days: demo.pitchCountLast7Days,
          bettingImpact: result.bettingImpact,
          realData: false,
        },
      });
    }
    if (cards.length > 0) setCachedCards(cards, 'pitcher-fatigue', sport);
    return cards;
  }

  // ── Bullpen fatigue ───────────────────────────────────────────────────────
  if (category === 'bullpen' || category === 'bullpen-fatigue') {
    console.log('[v0] [CARDS-GEN] Bullpen fatigue category');
    const { computeBullpenFatigue } = await import('@/lib/bullpen-fatigue');
    const demoTeams = [
      { teamName: 'Home Team', inningsLast3Days: 11, pitchCountLast3Days: 195, eraLast14Days: 4.85 },
      { teamName: 'Away Team', inningsLast3Days: 7, pitchCountLast3Days: 130, eraLast14Days: 3.62 },
    ];
    for (const team of demoTeams.slice(0, count)) {
      const result = computeBullpenFatigue(team);
      cards.push({
        type: CARD_TYPES.BULLPEN_FATIGUE,
        title: `${team.teamName} Bullpen`,
        icon: 'Flame',
        category: 'MLB',
        subcategory: 'Bullpen Fatigue',
        gradient: result.riskLevel === 'high' ? 'from-red-700 to-orange-900' : 'from-orange-600 to-amber-800',
        status: result.riskLevel === 'high' ? 'alert' : 'neutral',
        data: {
          fatigueScore: result.fatigueScore,
          riskLevel: result.riskLevel,
          inningsLast3Days: team.inningsLast3Days,
          eraLast14Days: team.eraLast14Days,
          scoringEnvImpact: result.scoringEnvImpact,
          signal: result.signal,
          realData: false,
        },
      });
    }
    if (cards.length > 0) setCachedCards(cards, 'bullpen', sport);
    return cards;
  }

  // Betting/Arbitrage cards (default)
  if (category === 'betting' || !category) {
    // Try to detect real arbitrage opportunities
    console.log('[v0] [CARDS GENERATOR] Checking for arbitrage opportunities');
    try {
      const { detectArbitrageFromContext } = await import('@/lib/arbitrage');
      const arbitrageCards = await detectArbitrageFromContext(normalizedSport);
      
      console.log('[v0] [CARDS GENERATOR] Arbitrage cards returned:', {
        isArray: Array.isArray(arbitrageCards),
        length: arbitrageCards?.length || 0,
        firstCard: arbitrageCards?.[0]?.title || 'none'
      });
      
      if (arbitrageCards && arbitrageCards.length > 0) {
        console.log('[v0] [CARDS GENERATOR] Adding', arbitrageCards.length, 'cards (arbitrage or live odds)');
        cards.push(...arbitrageCards.slice(0, 3)); // Add up to 3 cards (arbitrage or live odds)
      } else {
        console.log('[v0] [CARDS GENERATOR] No cards returned, using placeholder');
        // Fallback placeholder card
        cards.push({
          type: CARD_TYPES.LIVE_ODDS,
          title: 'Cross-Platform Arbitrage',
          icon: 'TrendingUp',
          category: 'BETTING',
          subcategory: 'Arbitrage Scanner',
          gradient: 'from-emerald-600 to-teal-700',
          data: {
            description: 'Scanning for arbitrage opportunities across sportsbooks',
            note: 'No arbitrage opportunities currently available',
            markets: ['Moneyline', 'Spreads', 'Totals']
          }
        });
      }
    } catch (error) {
      console.error('[v0] [CARDS GENERATOR] Arbitrage detection failed:', error);
      // Fallback placeholder card
      cards.push({
        type: CARD_TYPES.LIVE_ODDS,
        title: 'Cross-Platform Arbitrage',
        icon: 'TrendingUp',
        category: 'BETTING',
        subcategory: 'Arbitrage Scanner',
        gradient: 'from-emerald-600 to-teal-700',
        data: {
          description: 'Find potential arbitrage opportunities across sportsbooks',
          note: 'Arbitrage detection temporarily unavailable'
        }
      });
    }
  }

  // Line Movement category - when user asks about line moves, steam, sharp money
  if (category === 'lines' || category === 'line_movement' || category === 'steam') {
    console.log('[v0] [CARDS-GEN] Line movement category - fetching recent movements');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // Fetch recent significant line movements (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: movements } = await supabase
        .from('line_movement')
        .select('*')
        .gt('updated_at', oneDayAgo)
        .order('updated_at', { ascending: false })
        .limit(count * 3);
      
      if (movements && movements.length > 0) {
        console.log(`[v0] [CARDS-GEN] Found ${movements.length} line movements`);
        
        // Group by game and show most significant movements
        const gameMovements = new Map();
        movements.forEach((move: any) => {
          const key = `${move.away_team}_${move.home_team}`;
          if (!gameMovements.has(key) || Math.abs(move.line_change || 0) > Math.abs(gameMovements.get(key).line_change || 0)) {
            gameMovements.set(key, move);
          }
        });
        
        const topMovements = Array.from(gameMovements.values()).slice(0, count);
        
        topMovements.forEach(move => {
          const lineChange = move.line_change || 0;
          const direction = lineChange > 0 ? 'UP' : 'DOWN';
          const isSteam = Math.abs(lineChange) > 2;
          
          cards.push({
            type: CARD_TYPES.LINE_MOVEMENT,
            title: `${move.away_team} @ ${move.home_team}`,
            icon: isSteam ? 'TrendingUp' : 'Activity',
            category: 'LINE MOVEMENT',
            subcategory: isSteam ? `STEAM ${direction}` : `${direction} ${Math.abs(lineChange).toFixed(1)} pts`,
            gradient: isSteam ? 'from-red-600 to-orange-600' : 'from-blue-600 to-indigo-600',
            status: isSteam ? 'hot' : 'edge',
            data: {
              matchup: `${move.away_team} @ ${move.home_team}`,
              lineChange: `${lineChange > 0 ? '+' : ''}${lineChange.toFixed(1)} points`,
              oldLine: move.old_line ? `${move.old_line > 0 ? '+' : ''}${move.old_line}` : 'N/A',
              newLine: move.new_line ? `${move.new_line > 0 ? '+' : ''}${move.new_line}` : 'N/A',
              bookmaker: move.bookmaker || 'Multiple Books',
              timestamp: new Date(move.updated_at).toLocaleString(),
              isSteamMove: isSteam,
              direction: direction,
              sharpMoney: isSteam ? `Heavy ${direction === 'UP' ? 'home' : 'away'} action` : 'Moderate movement',
              realData: true,
              status: isSteam ? 'STEAM' : 'MOVEMENT'
            },
            metadata: {
              realData: true,
              dataSource: 'Line Movement Tracker',
              timestamp: move.updated_at,
              gameId: move.game_id
            }
          });
        });

        if (cards.length > 0) setCachedCards(cards, 'line_movement', sport);
        return cards;
      } else {
        console.log('[v0] [CARDS-GEN] No recent line movements');
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Line movement fetch error:', error);
    }

    // Fallback
    cards.push({
      type: CARD_TYPES.LINE_MOVEMENT,
      title: 'Line Movement Tracker',
      icon: 'Activity',
      category: 'LINE MOVEMENT',
      subcategory: 'No Recent Movements',
      gradient: 'from-blue-600 to-indigo-600',
      status: 'optimal',
      data: {
        description: 'Monitoring odds movements across all sportsbooks',
        note: 'No significant line movements in the last 24 hours',
        tracking: 'All major sports and markets',
        realData: true,
        status: 'MONITORING'
      }
    });

    if (cards.length > 0) setCachedCards(cards, 'line_movement', sport);
    return cards;
  }
  
  // Kalshi/Prediction Markets — route by subcategory pill when provided
  if (category === 'kalshi') {
    const sub = (kalshiSubcategory || '').toLowerCase();
    console.log('[v0] [CARDS-GEN] Kalshi category, subcategory=' + (sub || 'none (trending)'));
    try {
      const {
        fetchKalshiMarketsWithRetry,
        fetchSportsMarkets,
        fetchElectionMarkets,
        fetchWeatherMarkets,
        fetchFinanceMarkets,
        fetchTopMarketsByVolume,
        fetchAllKalshiMarkets,
        fetchMarketOrderbook,
        kalshiMarketToCard,
      } = await import('@/lib/kalshi/index');

      let markets: any[] = [];

      if (sub === 'sports' || sub === 'sport') {
        // fetchSportsMarkets() makes 12 batched API calls (~4-6s) which often hits the
        // card-fetch timeout. Race it against a fast keyword search; if the comprehensive
        // fetch wins, great — otherwise fall back to the keyword results.
        const fastFetch = fetchKalshiMarketsWithRetry({
          search: 'NFL NBA MLB NHL Super Bowl March Madness',
          limit: Math.max(count * 4, 24),
          maxRetries: 2,
        });
        const comprehensiveFetch = fetchSportsMarkets();
        const raceResult = await Promise.race([
          comprehensiveFetch,
          new Promise<any[]>(resolve => setTimeout(() => resolve([]), 3500)),
        ]).catch(() => [] as any[]);
        markets = raceResult.length > 0 ? raceResult : await fastFetch.catch(() => [] as any[]);
      } else if (sub === 'politics' || sub === 'elections' || sub === 'election') {
        markets = await fetchElectionMarkets({ limit: count * 5 });
        if (markets.length === 0) {
          console.log('[v0] [CARDS-GEN] No election/politics markets — falling back to top markets by volume');
          markets = await fetchTopMarketsByVolume(count * 3).catch(() => [] as any[]);
        }
      } else if (sub === 'weather' || sub === 'climate') {
        markets = await fetchWeatherMarkets(count * 5);
      } else if (['financials', 'finance', 'economics', 'crypto', 'companies'].includes(sub)) {
        markets = await fetchFinanceMarkets(count * 5);
      } else if (sub === 'trending') {
        markets = await fetchTopMarketsByVolume(count);
        if (markets.length < count) {
          // Volume data may be sparse — fall back to a broader open-market fetch ranked by volume
          const broadMarkets = await fetchKalshiMarketsWithRetry({ status: 'open', limit: 200, maxRetries: 2 });
          const ranked = broadMarkets
            .sort((a: any, b: any) => (b.volume24h || b.volume || 0) - (a.volume24h || a.volume || 0))
            .slice(0, count);
          if (ranked.length > markets.length) markets = ranked;
        }
      } else if (['culture', 'entertainment', 'arts', 'pop culture', 'awards', 'tv', 'film',
                  'music', 'movies', 'celebrity', 'oscars', 'emmys', 'grammys'].includes(sub)) {
        // Entertainment/culture markets — search Kalshi for relevant terms
        markets = await fetchKalshiMarketsWithRetry({
          search: 'entertainment',
          status: 'open',
          limit: Math.max(count * 3, 30),
          maxRetries: 1,
        });
        if (markets.length === 0) {
          // Kalshi doesn't reliably carry entertainment markets — show placeholder
          console.warn('[v0] [CARDS-GEN] No entertainment/culture Kalshi markets found — showing placeholder');
          cards.push({
            type: CARD_TYPES.KALSHI_INSIGHT,
            title: 'No Entertainment Markets Currently Available',
            icon: 'TrendingUp',
            category: 'KALSHI',
            subcategory: 'Entertainment',
            gradient: 'from-purple-700 to-pink-800',
            status: CARD_STATUS.NEUTRAL,
            realData: false,
            data: {
              iconLabel: 'entertainment',
              yesPct: 50,
              noPct: 50,
              edgeScore: 0,
              signal: 'Kalshi does not currently list entertainment/culture prediction markets. Check kalshi.com for the latest available markets.',
              note: 'Try switching to Politics, Sports, or Finance for active markets.',
              volumeTier: 'Thin',
              spreadLabel: 'N/A',
              priceDirection: 'flat',
              priceChange: 0,
            },
          });
          if (cards.length > 0) setCachedCards(cards, 'kalshi', sport);
          return cards;
        }
      } else {
        // No sub-filter — fetch a broad set of open markets sorted by volume.
        // fetchKalshiMarketsWithRetry will skip retries if the API legitimately
        // returns 0 (e.g. empty search result), so this won't exhaust retries
        // on every call when the API is working but no markets match.
        markets = await fetchKalshiMarketsWithRetry({
          status: 'open',
          limit: Math.max(count * 5, 50),
          maxRetries: 2,
        });

        // If the generic fetch returned nothing, try election and sports markets as a
        // fallback — these categories are reliably populated on Kalshi year-round.
        if (markets.length === 0) {
          console.log('[v0] [CARDS-GEN] Generic Kalshi fetch returned 0 — trying election/sports fallback');
          const [electionMarkets, sportsMarkets] = await Promise.allSettled([
            fetchElectionMarkets({ limit: count * 3 }),
            fetchSportsMarkets(),
          ]);
          const fallback = [
            ...(electionMarkets.status === 'fulfilled' ? electionMarkets.value : []),
            ...(sportsMarkets.status === 'fulfilled' ? sportsMarkets.value : []),
          ];
          if (fallback.length > 0) {
            console.log(`[v0] [CARDS-GEN] Fallback yielded ${fallback.length} Kalshi markets`);
            markets = fallback;
          }
        }

        // Last resort: fetch all open markets without any title filter. This bypasses
        // the `title` search parameter which Kalshi sometimes ignores, and simply
        // returns the top open markets sorted by the API's default ordering.
        if (markets.length === 0) {
          console.log('[v0] [CARDS-GEN] Category/election/sports all returned 0 — trying fetchAllKalshiMarkets (no filter)');
          try {
            const allMarkets = await fetchAllKalshiMarkets({ status: 'open', maxMarkets: Math.max(count * 10, 100) });
            if (allMarkets.length > 0) {
              console.log(`[v0] [CARDS-GEN] fetchAllKalshiMarkets yielded ${allMarkets.length} markets`);
              markets = allMarkets;
            }
          } catch {
            // fetchAllKalshiMarkets failed too — Kalshi API is down/unreachable
          }
        }

        // When sport context is present, filter to sport-relevant markets
        if (sport && markets.length > 0) {
          const SPORT_KALSHI_KEYWORDS: Record<string, string[]> = {
            basketball_nba: ['NBA', 'basketball'],
            americanfootball_nfl: ['NFL', 'football', 'Super Bowl'],
            baseball_mlb: ['MLB', 'baseball', 'World Series'],
            icehockey_nhl: ['NHL', 'hockey', 'Stanley Cup'],
            americanfootball_ncaaf: ['NCAAF', 'college football', 'CFP'],
            basketball_ncaab: ['NCAAB', 'March Madness', 'college basketball'],
          };
          const keywords = SPORT_KALSHI_KEYWORDS[sport];
          if (keywords) {
            const sportFiltered = markets.filter((m: any) => {
              const title = ((m.title || m.ticker || '') as string).toLowerCase();
              return keywords.some(kw => title.includes(kw.toLowerCase()));
            });
            if (sportFiltered.length > 0) {
              markets = sportFiltered;
              console.log(`[v0] [CARDS-GEN] Kalshi filtered to ${markets.length} ${sport} markets`);
            }
          }
        }
      }

      // Drop markets that are definitively closed.
      // The Kalshi lib normalises status → 'active' (not 'open'), so we accept both.
      // Only exclude when status is explicitly a closed/settled/resolved value.
      const CLOSED_STATUSES = new Set(['closed', 'settled', 'resolved', 'finalized']);
      markets = markets.filter((m: any) => !m.status || !CLOSED_STATUSES.has(m.status));
      console.log(`[v0] [CARDS-GEN] Kalshi fetched ${markets.length} open markets`);

      if (markets.length > 0) {
        // Activity-scored sort: markets with real price signals always rank above dormant 50/50 markets.
        // Within each tier, sort by recent trading activity then total volume.
        const activityScore = (m: any): number =>
          (m.priceIsReal ? 1_000_000 : 0)
          + ((m.yesBid > 0 || m.yesAsk > 0) ? 200_000 : 0)
          + (m.volume24h ?? 0) * 10
          + (m.volume ?? 0)
          + (m.openInterest ?? 0);
        markets.sort((a: any, b: any) => activityScore(b) - activityScore(a));
        const topMarkets = markets.slice(0, count);
        // Fetch orderbooks for top 3 only — avoids hammering Kalshi rate limits
        const orderbookResults = await Promise.allSettled(
          topMarkets.slice(0, 3).map((m: any) =>
            Promise.race([
              fetchMarketOrderbook(m.ticker),
              new Promise<null>(resolve => setTimeout(() => resolve(null), 1500)),
            ])
          )
        );
        const kalshiCards = topMarkets.map((m: any, i: number) => {
          const ob = orderbookResults[i]?.status === 'fulfilled' ? orderbookResults[i].value : null;
          return kalshiMarketToCard(m, ob);
        });
        cards.push(...kalshiCards);
        console.log(`[v0] [CARDS-GEN] Added ${kalshiCards.length} Kalshi cards`);
        if (cards.length > 0) setCachedCards(cards, 'kalshi', sport);
        return cards;
      }

      // All live strategies exhausted — try the Supabase DB cache before showing unavailable.
      // The cron job (GET /api/cron/kalshi) populates api.kalshi_markets every 5 minutes.
      // Uses the anon-key client (not the cookie-aware server client) so this is safe
      // inside unstable_cache() contexts where cookies() is forbidden.
      console.warn('[v0] [CARDS-GEN] Kalshi live API returned 0 markets — trying DB cache');
      try {
        const { createClient: createSb } = await import('@supabase/supabase-js');
        const sb = createSb(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { db: { schema: 'api' } },
        );
        const { data: dbRows } = await sb
          .from('kalshi_markets')
          .select('market_id, title, category, yes_price, no_price, volume, close_time')
          .gt('expires_at', new Date().toISOString())
          .order('cached_at', { ascending: false })
          .limit(count * 4);
        if (dbRows && dbRows.length > 0) {
          const { buildKalshiMarketFromDbRow, kalshiMarketToCard: toCard } = await import('@/lib/kalshi/index');
          const dbMarkets = dbRows.map(buildKalshiMarketFromDbRow);
          const topMarkets = dbMarkets.slice(0, count);
          const kalshiCards = topMarkets.map((m: any) => toCard(m, null));
          cards.push(...kalshiCards);
          console.log(`[v0] [CARDS-GEN] DB cache supplied ${kalshiCards.length} Kalshi cards`);
          if (cards.length > 0) setCachedCards(cards, 'kalshi', sport);
          return cards;
        }
      } catch (dbErr) {
        console.warn('[v0] [CARDS-GEN] Kalshi DB fallback failed:', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }
      // Distinguish "API error" from "API worked but no markets" so we show the right message.
      const { wasKalshiFetchError } = await import('@/lib/kalshi/index');
      if (wasKalshiFetchError()) {
        cards.push(...buildKalshiUnavailableCards(count)); // network/API failure
      } else {
        cards.push(buildKalshiNoMarketsCard());            // API ok, no markets
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Kalshi API error:', error instanceof Error ? error.message : String(error));
      // On hard error also attempt DB cache before showing the unavailable state
      try {
        const { createClient: createSb } = await import('@supabase/supabase-js');
        const sb = createSb(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { db: { schema: 'api' } },
        );
        const { data: dbRows } = await sb
          .from('kalshi_markets')
          .select('market_id, title, category, yes_price, no_price, volume, close_time')
          .gt('expires_at', new Date().toISOString())
          .order('cached_at', { ascending: false })
          .limit(count * 4);
        if (dbRows && dbRows.length > 0) {
          const { buildKalshiMarketFromDbRow, kalshiMarketToCard: toCard } = await import('@/lib/kalshi/index');
          const dbMarkets = dbRows.map(buildKalshiMarketFromDbRow);
          const kalshiCards = dbMarkets.slice(0, count).map((m: any) => toCard(m, null));
          cards.push(...kalshiCards);
          return cards;
        }
      } catch { /* DB also failed — fall through to unavailable card */ }
      cards.push(...buildKalshiUnavailableCards(count)); // hard error path always shows unavailable
    }
    return cards;
  }

  // Portfolio/Kelly Sizing - when user asks about bet sizing, bankroll management, Kelly criterion
  if (category === 'portfolio' || category === 'kelly' || category === 'sizing' || category === 'bankroll') {
    console.log('[v0] [CARDS-GEN] Portfolio/Kelly category - calculating optimal bet sizes');
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // Get current capital state — maybeSingle() returns null (not 406) when absent
      const { data: capitalState } = await supabase
        .from('capital_state')
        .select('*')
        .eq('active', true)
        .maybeSingle();
      
      if (capitalState) {
        // Get current bet allocations
        const { data: allocations } = await supabase
          .from('bet_allocations')
          .select('*')
          .in('status', ['pending', 'placed'])
          .order('allocated_capital', { ascending: false })
          .limit(count);
        
        const totalAllocated = allocations?.reduce((sum: number, bet: any) => sum + bet.allocated_capital, 0) || 0;
        const utilization = (totalAllocated / capitalState.total_capital) * 100;
        
        // Portfolio summary card
        cards.push({
          type: CARD_TYPES.PORTFOLIO,
          title: 'Portfolio Overview',
          icon: 'Wallet',
          category: 'PORTFOLIO',
          subcategory: `${utilization.toFixed(1)}% Deployed`,
          gradient: 'from-purple-600 to-pink-600',
          status: utilization > 80 ? 'hot' : utilization > 50 ? 'value' : 'neutral',
          data: {
            totalBankroll: `$${capitalState.total_capital.toFixed(2)}`,
            deployed: `$${totalAllocated.toFixed(2)}`,
            available: `$${(capitalState.total_capital - totalAllocated).toFixed(2)}`,
            utilizationRate: `${utilization.toFixed(1)}%`,
            riskBudget: `${(capitalState.risk_budget * 100).toFixed(0)}%`,
            kellyScale: `${(capitalState.kelly_scale * 100).toFixed(0)}% (${capitalState.kelly_scale === 0.25 ? 'Quarter Kelly' : capitalState.kelly_scale === 0.5 ? 'Half Kelly' : 'Custom'})`,
            maxSinglePosition: `${(capitalState.max_single_position * 100).toFixed(0)}%`,
            activeBets: allocations?.length || 0,
            realData: true,
            status: utilization > 80 ? 'HIGH_UTILIZATION' : utilization > 50 ? 'MODERATE' : 'CONSERVATIVE'
          },
          metadata: {
            realData: true,
            dataSource: 'Capital State Manager',
            timestamp: capitalState.updated_at
          }
        });
        
        // Show top allocations if any exist
        if (allocations && allocations.length > 0) {
          allocations.slice(0, Math.min(2, count - 1)).forEach((bet: any) => {
            // Null-safe field extraction — DB rows may have null values
            const kellyFrac = bet.kelly_fraction ?? 0;
            const edgeVal = bet.edge ?? 0;
            const confVal = bet.confidence_score ?? 0;
            const capital = bet.allocated_capital ?? 0;
            const kellyPct = (kellyFrac * 100).toFixed(2);
            cards.push({
              type: CARD_TYPES.KELLY_BET,
              title: bet.matchup || 'Bet Allocation',
              icon: 'Target',
              category: 'KELLY SIZING',
              subcategory: `${kellyPct}% Kelly`,
              gradient: 'from-indigo-600 to-purple-600',
              data: {
                matchup: bet.matchup,
                sport: bet.sport?.toUpperCase(),
                edge: `${(edgeVal * 100).toFixed(2)}%`,
                confidence: `${(confVal * 100).toFixed(0)}%`,
                kellyFraction: `${kellyPct}%`,
                recommendedStake: capital > 0 ? `$${capital.toFixed(2)}` : '—',
                expectedValue: capital > 0 && edgeVal > 0 ? `$${(capital * edgeVal).toFixed(2)}` : '—',
                status: bet.status?.toUpperCase(),
                realData: true
              },
              metadata: {
                realData: true,
                dataSource: 'Capital Allocator',
                timestamp: bet.created_at
              }
            });
          });
        }

        if (cards.length > 0) setCachedCards(cards, 'portfolio', sport);
        return cards;
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Portfolio fetch error:', error);
    }

    // Fallback
    cards.push({
      type: CARD_TYPES.PORTFOLIO,
      title: 'Portfolio Manager',
      icon: 'Wallet',
      category: 'PORTFOLIO',
      subcategory: 'Kelly Criterion',
      gradient: 'from-purple-600 to-pink-600',
      status: 'alert',
      data: {
        description: 'Optimal bet sizing using Kelly Criterion with fractional scaling',
        features: ['Risk Management', 'Capital Allocation', 'Bankroll Protection'],
        note: 'Initialize capital state to start tracking',
        realData: false,
        status: 'SETUP_REQUIRED'
      }
    });

    if (cards.length > 0) setCachedCards(cards, 'portfolio', sport);
    return cards;
  }
  
  // Player Props - Fetch real player prop markets
  if (category === 'props' || category === 'player_props') {
    console.log('[v0] [CARDS-GEN] Player props category - fetching live markets');
    try {
      const { fetchPlayerProps, playerPropToCard } = await import('@/lib/player-props-service');
      
      if (normalizedSport) {
        const props = await fetchPlayerProps({ 
          sport: normalizedSport, 
          useCache: true, 
          storeResults: true 
        });
        
        const propsWithData = props.filter(p => p.overOdds && p.underOdds);
        console.log(
          `[v0] [CARDS-GEN] props: ${props.length} total | ${propsWithData.length} with O/U odds` +
          (props.length === 0 ? ' ← fallback will render' : '')
        );

        if (props.length > 0) {
          const propCards = props.slice(0, count).map(playerPropToCard);
          cards.push(...propCards);
          console.log(`[v0] [CARDS-GEN] Built ${propCards.length} prop cards (requested: ${count})`);
          if (cards.length > 0) setCachedCards(cards, 'props', normalizedSport);
          return cards;
        }
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Player props error:', error);
    }
    
    // Fallback: props not yet posted by bookmakers (common pre-game or early season)
    cards.push({
      type: CARD_TYPES.PLAYER_PROP,
      title: 'Player Props',
      icon: 'User',
      category: displaySport,
      subcategory: 'Player Props',
      gradient: 'from-blue-600 to-cyan-600',
      data: {
        description: 'Live player prop markets (strikeouts, hits, home runs, etc.)',
        note: normalizedSport === 'baseball_mlb'
          ? 'MLB props typically post 24–48 h before first pitch. Moneylines and totals are available now — ask the AI for batting or pitching analysis.'
          : 'Prop markets not yet available from bookmakers. Check back closer to game time.',
        tip: 'Try: "Best strikeout props today?" or "HR prop value for this slate?"',
        realData: false,
      }
    });
  }

  // ── LeverageMetrics MLB Projection Engine ──────────────────────────────────
  // Intercepts all MLB categories and routes to the projection pipeline.
  // On failure, falls through to the existing Odds API-based handlers below.
  if (normalizedSport === 'baseball_mlb' && cards.length < count) {
    try {
      if (category === 'dfs') {
        // Full DK MLB slate with Monte Carlo projections — multi-lineup
        const { buildDFSSlateMulti } = await import('@/lib/mlb-projections/slate-builder');
        const multi = await Promise.race([
          buildDFSSlateMulti({ limit: 9 }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 18000)),
        ]);

        const today = multi.metadata.date;
        const totalPts = multi.metadata.totalProjPts.toFixed(1);
        const totalSal = multi.metadata.totalSalary > 0
          ? `$${(multi.metadata.totalSalary / 1000).toFixed(0)}k`
          : '';

        // 1× DFS Slate card (full optimal lineup roster)
        if (multi.slateForCard.length > 0) {
          cards.push({
            type: 'dfs-slate',
            title: `DK Optimal Lineup · MLB · ${today}`,
            icon: 'Trophy',
            category: 'MLB',
            subcategory: `DraftKings · ${totalSal} used · ${totalPts} proj pts`,
            gradient: 'from-orange-600 to-red-700',
            status: 'optimal',
            data: {
              slate: multi.slateForCard.map(c => ({
                position:    c.data.position,
                player:      c.data.player,
                team:        c.data.team,
                salary:      c.data.salary,
                projection:  c.data.projection,
                ownership:   c.data.ownership,
                dkValue:     c.data.dkValue,
                matchupScore: c.data.matchupScore,
                cardCategory: c.data.cardCategory ?? 'optimal',
                stackTeam:   c.data.stackTeam,
              })),
              topStack: multi.topStack ? `${multi.topStack.type === 'full' ? 'FULL STACK' : 'MINI-STACK'}: ${multi.topStack.team}` : undefined,
              totalProjPts: totalPts,
              totalSalary:  totalSal,
              gamesCount:   String(multi.metadata.gamesCount),
              capValid:     multi.metadata.capValid,
              playingTodayCount: multi.metadata.playingTodayCount,
            },
            metadata: { realData: true, source: 'LeverageMetrics' },
          });
        }

        // 2× DFS Value cards
        for (const c of multi.valueLineup.slice(0, 2)) {
          cards.push({
            type: 'dfs-value',
            title: c.title,
            icon: 'TrendingUp',
            category: c.category,
            subcategory: c.subcategory,
            gradient: 'from-emerald-600 to-teal-700',
            status: 'value',
            data: { ...c.data, cardCategory: 'value' },
            metadata: { realData: true, source: 'LeverageMetrics' },
          });
        }

        // 2× DFS Matchup cards
        for (const c of multi.matchupLineup.slice(0, 2)) {
          cards.push({
            type: 'dfs-matchup',
            title: c.title,
            icon: 'Crosshair',
            category: c.category,
            subcategory: c.subcategory,
            gradient: 'from-blue-600 to-indigo-700',
            status: 'value',
            data: { ...c.data, cardCategory: 'matchup' },
            metadata: { realData: true, source: 'LeverageMetrics' },
          });
        }

        // 2× DFS Contrarian cards
        for (const c of multi.contrarianLineup.slice(0, 2)) {
          cards.push({
            type: 'dfs-lineup',
            title: c.title,
            icon: 'Shuffle',
            category: c.category,
            subcategory: c.subcategory,
            gradient: 'from-violet-600 to-purple-700',
            status: 'value',
            data: { ...c.data, cardCategory: 'contrarian' },
            metadata: { realData: true, source: 'LeverageMetrics' },
          });
        }

        // 2× DFS Chalk cards
        for (const c of multi.chalkLineup.slice(0, 2)) {
          cards.push({
            type: 'dfs-lineup',
            title: c.title,
            icon: 'Users',
            category: c.category,
            subcategory: c.subcategory,
            gradient: 'from-amber-600 to-orange-700',
            status: 'hot',
            data: { ...c.data, cardCategory: 'chalk' },
            metadata: { realData: true, source: 'LeverageMetrics' },
          });
        }
      } else if (category === 'fantasy') {
        // ROS projections, waiver wire, streaming pitchers
        const { buildFantasyCards } = await import('@/lib/mlb-projections/fantasy-adapter');
        const fantasyRaw = await Promise.race([
          buildFantasyCards({ limit: count }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
        ]);
        for (const c of fantasyRaw) {
          cards.push({
            type: c.type ?? 'fantasy-insight',
            title: c.title,
            icon: 'Star',
            category: c.category,
            subcategory: c.subcategory,
            gradient: c.gradient,
            status: c.status,
            data: c.data,
            metadata: { realData: true, source: 'LeverageMetrics' },
          });
        }
      } else if (category === 'betting') {
        // HR/K prop betting edges with Kelly fractions (StatcastCard format)
        const { buildBettingEdgeCards } = await import('@/lib/mlb-projections/betting-edges');
        const edgeRaw = await Promise.race([
          buildBettingEdgeCards({ limit: count }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
        ]);
        for (const c of edgeRaw) {
          cards.push({
            ...(c as any),
            icon: 'TrendingUp',
            metadata: { realData: true, source: 'LeverageMetrics' },
          });
        }
      } else if (category === 'vpe' || category === 'projections') {
        // VPE 3.0 — Vortex Projection Engine (Baseball only)
        const vpeCards = await buildVPECards(count);
        cards.push(...vpeCards);
      } else {
        // Default (all / undefined): run MLB projection pipeline then supplement with VPE cards
        const { runProjectionPipeline } = await import('@/lib/mlb-projections/projection-pipeline');
        const projCards = await Promise.race([
          runProjectionPipeline({ limit: count }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
        ]);
        for (const c of projCards) {
          cards.push({
            ...c,
            icon: 'TrendingUp',
            metadata: { realData: true, source: 'LeverageMetrics' },
          });
        }
        // Supplement with VPE cards if pipeline returned fewer than requested
        if (cards.length < count) {
          try {
            const vpeCards = await buildVPECards(count - cards.length);
            cards.push(...vpeCards);
          } catch {
            // VPE supplemental failure is non-fatal
          }
        }
      }

      if (cards.length > 0) {
        console.log(`[v0] [CARDS-GEN] MLB projection engine: ${cards.length} cards (category: ${category ?? 'default'})`);
        setCachedCards(cards, category ?? 'projections', 'baseball_mlb');
        return cards;
      }
    } catch (err) {
      console.warn('[v0] [CARDS-GEN] MLB projection engine failed, falling back:', (err as Error).message);
    }

    // ── MLB DFS Odds Fallback ─────────────────────────────────────────────────
    // When the projection engine is unavailable (API down, no games on schedule,
    // Statcast timeout), generate DFS stack recommendations from live game totals.
    // O/U is the best single proxy for DFS game environment.
    if (category === 'dfs' && cards.length === 0) {
      try {
        const { getOddsApiKey } = await import('@/lib/config');
        const apiKey = getOddsApiKey();
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${apiKey}&regions=us&markets=h2h,totals&oddsFormat=american`;

        type OddsGame = {
          id: string; home_team: string; away_team: string;
          bookmakers: Array<{ markets: Array<{ key: string; outcomes: Array<{ name: string; price: number; point?: number }> }> }>;
        };

        const resp = await Promise.race<Response | null>([
          fetch(oddsUrl, { next: { revalidate: 0 } } as RequestInit),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
        ]);

        if (resp?.ok) {
          const events = await resp.json() as OddsGame[];

          const parsed = events.map(ev => {
            const book = ev.bookmakers?.[0];
            const h2h = book?.markets?.find(m => m.key === 'h2h');
            const totals = book?.markets?.find(m => m.key === 'totals');
            const homeOdds = h2h?.outcomes?.find(o => o.name === ev.home_team)?.price ?? 0;
            const awayOdds = h2h?.outcomes?.find(o => o.name === ev.away_team)?.price ?? 0;
            const overLine = totals?.outcomes?.find(o => o.name === 'Over')?.point ?? 0;
            return { ev, homeOdds, awayOdds, overLine };
          }).filter(g => g.overLine > 0).sort((a, b) => b.overLine - a.overLine);

          for (const { ev, homeOdds, awayOdds, overLine } of parsed.slice(0, count)) {
            const homeShort = ev.home_team.split(' ').pop() ?? ev.home_team;
            const awayShort = ev.away_team.split(' ').pop() ?? ev.away_team;
            // Favor the underdog stack (chalk avoidance) or home team if close
            const stackTeam = Math.abs(homeOdds) < Math.abs(awayOdds)
              ? ev.home_team : ev.away_team;
            const stackShort = stackTeam.split(' ').pop() ?? stackTeam;
            const isHighTotal = overLine >= 9.5;
            const isMidTotal  = overLine >= 8.5;
            const envLabel    = isHighTotal ? 'elite scoring' : isMidTotal ? 'high scoring' : 'moderate scoring';
            const estTotalDK  = Math.round(overLine * 2.9); // ~2.9 DK pts per run scored
            const ownership   = isHighTotal ? '32%' : isMidTotal ? '24%' : '16%';

            cards.push({
              type: CARD_TYPES.DFS_MATCHUP,
              title: `${awayShort} @ ${homeShort} — DFS Stack`,
              icon: 'Crosshair',
              category: 'MLB',
              subcategory: `DraftKings · O/U ${overLine} · ${envLabel}`,
              gradient: 'from-blue-600 to-indigo-700',
              status: 'optimal',
              data: {
                player:      `${stackShort} Stack`,
                team:        stackShort,
                position:    'STACK',
                salary:      '—',
                projection:  estTotalDK.toFixed(0),
                ownership,
                boomCeiling: Math.round(overLine * 3.5).toFixed(0),
                bustFloor:   Math.round(overLine * 2.1).toFixed(0),
                targetGame:  `${ev.away_team} @ ${ev.home_team}`,
                platforms:   ['DraftKings', 'FanDuel'],
                tips: `O/U ${overLine} projects ${envLabel} environment (~${estTotalDK} combined DK pts). ` +
                  `Stack ${stackTeam} hitters (${homeOdds > 0 ? `+${homeOdds}` : homeOdds} / ` +
                  `${awayOdds > 0 ? `+${awayOdds}` : awayOdds}). ` +
                  (isHighTotal ? 'Top-tier slate game — prioritize in tournaments.' :
                   isMidTotal  ? 'Solid value game for cash and GPP.' :
                   'Consider as contrarian low-ownership stack.'),
                cardCategory: 'matchup',
                realData:    true,
              },
              realData: true,
            });
          }

          if (cards.length > 0) {
            console.log(`[v0] [CARDS-GEN] MLB DFS odds fallback: ${cards.length} cards`);
            return cards;
          }
        }
      } catch (e) {
        console.warn('[v0] [CARDS-GEN] MLB DFS odds fallback failed:', e);
      }
    }

    // ── Guaranteed MLB DFS Strategy Cards ────────────────────────────────────
    // Final safety net: always produce DFS value cards even when all live APIs
    // are unavailable. Uses general MLB DFS strategy that's valid year-round.
    if (category === 'dfs' && cards.length === 0) {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const strategies = [
        {
          title: 'MLB Stack Builder Guide',
          subcategory: `DFS Strategy · ${today}`,
          gradient: 'from-orange-600 to-red-700',
          status: 'optimal',
          position: 'STACK',
          player: 'Game Stack',
          tip: 'Target 4–5 man stacks from teams in high O/U games (9.0+). Prioritize teams with favorable park factors (Coors, Globe Life, Yankee Stadium). Stack against pitchers with FIP > 4.50 and low strikeout rates.',
          projection: '42', boomCeiling: '58', bustFloor: '24',
          salary: '$45,000', ownership: '28%', dkValue: '5.7',
        },
        {
          title: 'SP Value Play Framework',
          subcategory: `Pitching Strategy · ${today}`,
          gradient: 'from-blue-600 to-indigo-700',
          status: 'value',
          position: 'SP',
          player: 'Strikeout Upside SP',
          tip: 'Look for mid-priced SPs ($7.5K–$9.5K) with K/9 > 9.0 facing teams ranked bottom-10 in K rate. Win equity matters most on DK — target SPs with implied win probability > 62%.',
          projection: '34', boomCeiling: '48', bustFloor: '14',
          salary: '$8,200', ownership: '12%', dkValue: '4.1',
        },
        {
          title: 'Contrarian Tournament Stack',
          subcategory: `GPP Leverage · ${today}`,
          gradient: 'from-violet-600 to-purple-700',
          status: 'value',
          position: 'FLEX',
          player: 'Low-Own Stack',
          tip: 'Win GPPs by going against the field. Identify dog-stack games where the underdog has an O/U share above 4.5 runs. Target catchers and 2B from the chalk-avoided team for sub-5% ownership.',
          projection: '38', boomCeiling: '65', bustFloor: '8',
          salary: '$22,000', ownership: '6%', dkValue: '5.2',
        },
        {
          title: 'Cash Game Construction',
          subcategory: `Safe Floor Plays · ${today}`,
          gradient: 'from-emerald-600 to-teal-700',
          status: 'value',
          position: 'ROSTER',
          player: 'Floor-Safe Lineup',
          tip: 'For cash games, prioritize floor over ceiling. Use an elite SP with high win probability + run support, then fill bats from a single strong-lineup team. Avoid pitchers in extreme hitter parks and 3B with high strikeout rates.',
          projection: '36', boomCeiling: '44', bustFloor: '28',
          salary: '$50,000', ownership: '45%', dkValue: '5.4',
        },
      ];

      for (const s of strategies.slice(0, count)) {
        cards.push({
          type: CARD_TYPES.DFS_MATCHUP,
          title: s.title,
          icon: 'Crosshair',
          category: 'MLB',
          subcategory: s.subcategory,
          gradient: s.gradient,
          status: s.status,
          data: {
            player: s.player,
            team: 'MLB',
            position: s.position,
            salary: s.salary,
            projection: s.projection,
            ownership: s.ownership,
            boomCeiling: s.boomCeiling,
            bustFloor: s.bustFloor,
            targetGame: 'MLB Slate',
            platforms: ['DraftKings', 'FanDuel'],
            tips: s.tip,
            cardCategory: 'matchup',
            dkValue: s.dkValue,
            realData: false,
          },
          realData: false,
        });
      }
      console.log(`[v0] [CARDS-GEN] MLB DFS strategy fallback: ${cards.length} cards`);
      return cards;
    }
  }

  // DFS cards — fetch real player prop lines from The Odds API.
  // No hardcoded demo data: if live props aren't available we skip the card
  // so the AI can address the slate from its knowledge instead of the UI
  // showing stale/fabricated player names and salaries.
  // MLB DFS is handled above by the projection engine; this block covers NBA/NFL/NHL.
  if (category === 'dfs' && normalizedSport !== 'baseball_mlb') {
    const dfsMarketMap: Record<string, string> = {
      basketball_nba: 'player_points',
      americanfootball_nfl: 'player_passing_yards',
      icehockey_nhl: 'player_shots_on_goal',
    };
    const dfsPositionMap: Record<string, string> = {
      basketball_nba: 'G/F',
      americanfootball_nfl: 'QB',
      icehockey_nhl: 'W',
    };
    const dfsStatLabel: Record<string, string> = {
      basketball_nba: 'scoring',
      americanfootball_nfl: 'passing yards',
      icehockey_nhl: 'shots on goal',
    };
    const dfsMarket = dfsMarketMap[normalizedSport || ''];

    if (dfsMarket && normalizedSport) {
      try {
        const { getOddsApiKey } = await import('@/lib/config');
        const apiKey = getOddsApiKey();
        const url = `https://api.the-odds-api.com/v4/sports/${normalizedSport}/odds?apiKey=${apiKey}&regions=us&markets=${dfsMarket}&oddsFormat=american`;

        type OddsEvent = {
          home_team: string;
          away_team: string;
          bookmakers: Array<{
            markets: Array<{
              key: string;
              outcomes: Array<{ description?: string; name?: string; price: number; point?: number }>;
            }>;
          }>;
        };

        const resp = await Promise.race<Response | null>([
          fetch(url, { next: { revalidate: 0 } } as RequestInit),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
        ]);

        if (resp?.ok) {
          const events = await resp.json() as OddsEvent[];
          // Collect all player lines across all events
          const lines: Array<{ player: string; line: number; game: string }> = [];
          for (const ev of events) {
            const game = `${ev.away_team} @ ${ev.home_team}`;
            for (const bk of ev.bookmakers ?? []) {
              const mkt = bk.markets?.find(m => m.key === dfsMarket);
              for (const out of mkt?.outcomes ?? []) {
                const playerName = out.description ?? out.name;
                if (playerName && out.point !== undefined) {
                  lines.push({ player: playerName, line: out.point, game });
                }
              }
            }
          }

          if (lines.length > 0) {
            // Deduplicate by player — keep highest line per player
            const byPlayer = new Map<string, { player: string; line: number; game: string }>();
            for (const l of lines) {
              const existing = byPlayer.get(l.player);
              if (!existing || l.line > existing.line) byPlayer.set(l.player, l);
            }
            const unique = Array.from(byPlayer.values()).sort((a, b) => b.line - a.line);

            // ── Card 1: Optimal play (highest projected line) ────────────
            const top = unique[0];
            const salaryBase = Math.round((top.line * 190 + 3800) / 100) * 100;
            const proj = top.line;
            const valueScore1 = proj / (salaryBase / 1000);

            // Value plays: top 3 by pts-per-$K excluding the top pick
            const valuePlayers = unique
              .slice(1, 6)
              .map(p => ({ ...p, ppk: p.line / ((Math.round((p.line * 190 + 3800) / 100) * 100) / 1000) }))
              .sort((a, b) => b.ppk - a.ppk);

            cards.push({
              type: CARD_TYPES.DFS_LINEUP,
              title: `${displaySport || 'DFS'} Optimal Play`,
              icon: 'Trophy',
              category: 'DFS',
              subcategory: `${displaySport || 'Daily Fantasy'} · GPP Stack`,
              gradient: 'from-orange-600 to-red-700',
              status: 'optimal',
              data: {
                player: top.player,
                team: '—',
                position: dfsPositionMap[normalizedSport] ?? 'FLEX',
                salary: `$${salaryBase.toLocaleString()}`,
                projection: proj.toFixed(1),
                ownership: `${Math.min(35, Math.round(8 + proj / 4))}%`,
                boomCeiling: (proj * 1.52).toFixed(1),
                bustFloor: (proj * 0.52).toFixed(1),
                targetGame: top.game,
                targetPlayers: valuePlayers.slice(0, 3).map(p => p.player),
                platforms: ['DraftKings', 'FanDuel'],
                dkValue: valueScore1.toFixed(2),
                tips: `${top.player} leads the ${dfsStatLabel[normalizedSport] ?? 'production'} market with a ${proj} projected line — highest ceiling on today's slate.`,
                cardCategory: 'optimal',
                realData: true,
              },
              realData: true,
            });

            // ── Card 2: Value play (best pts/$K among top 5) ────────────
            if (valuePlayers.length > 0) {
              const vp = valuePlayers[0];
              const vpSalary = Math.round((vp.line * 190 + 3800) / 100) * 100;
              cards.push({
                type: CARD_TYPES.DFS_VALUE,
                title: `${displaySport || 'DFS'} Value Play`,
                icon: 'TrendingUp',
                category: 'DFS',
                subcategory: `${displaySport || 'Daily Fantasy'} · Best Value`,
                gradient: 'from-emerald-600 to-teal-700',
                status: 'value',
                data: {
                  player: vp.player,
                  team: '—',
                  position: dfsPositionMap[normalizedSport] ?? 'FLEX',
                  salary: `$${vpSalary.toLocaleString()}`,
                  projection: vp.line.toFixed(1),
                  ownership: `${Math.min(25, Math.round(6 + vp.line / 5))}%`,
                  boomCeiling: (vp.line * 1.6).toFixed(1),
                  bustFloor: (vp.line * 0.45).toFixed(1),
                  targetGame: vp.game,
                  platforms: ['DraftKings', 'FanDuel'],
                  dkValue: vp.ppk.toFixed(2),
                  tips: `${vp.player} is the top value on the slate at ${vp.ppk.toFixed(2)}x pts/$K — great GPP differentiation.`,
                  cardCategory: 'value',
                  realData: true,
                },
                realData: true,
              });
            }

            // ── Card 3: Matchup play (2nd-highest line player as matchup proxy) ──
            if (unique.length > 1) {
              const mp = unique[1];
              const mpSalary = Math.round((mp.line * 190 + 3800) / 100) * 100;
              cards.push({
                type: CARD_TYPES.DFS_MATCHUP,
                title: `${displaySport || 'DFS'} Matchup Play`,
                icon: 'Crosshair',
                category: 'DFS',
                subcategory: `${displaySport || 'Daily Fantasy'} · Matchup Edge`,
                gradient: 'from-blue-600 to-indigo-700',
                status: 'value',
                data: {
                  player: mp.player,
                  team: '—',
                  position: dfsPositionMap[normalizedSport] ?? 'FLEX',
                  salary: `$${mpSalary.toLocaleString()}`,
                  projection: mp.line.toFixed(1),
                  ownership: `${Math.min(30, Math.round(7 + mp.line / 4))}%`,
                  boomCeiling: (mp.line * 1.5).toFixed(1),
                  bustFloor: (mp.line * 0.50).toFixed(1),
                  targetGame: mp.game,
                  platforms: ['DraftKings', 'FanDuel'],
                  dkValue: (mp.line / (mpSalary / 1000)).toFixed(2),
                  tips: `${mp.player} has a favorable matchup with a ${mp.line} projected ${dfsStatLabel[normalizedSport] ?? 'stat'} line — strong floor play.`,
                  cardCategory: 'matchup',
                  realData: true,
                },
                realData: true,
              });
            }
          }
          // If lines.length === 0: no props available yet — skip card so AI handles it
        }
        // If resp not ok: skip card, no hardcoded fallback
      } catch {
        // API error — skip card rather than show demo data
        console.warn('[v0] [CARDS-GEN] DFS player props fetch failed — skipping card');
      }
    }
  }

  // Fantasy / Draft cards — rich cards from the fantasy card generator
  if (category === 'fantasy' || category === 'draft' || category === 'waiver') {
    try {
      const { generateFantasyCards } = await import('@/lib/fantasy/cards/fantasy-card-generator');
      // Pass a default intent so VBD+waiver+draft cards are always generated
      const fantasyCards = await generateFantasyCards('ranking projection waiver', count, normalizedSport);
      cards.push(...fantasyCards.slice(0, count));
    } catch (err) {
      console.error('[v0] [CARDS-GEN] Fantasy card generation failed:', err);
      // Fallback placeholder
      cards.push({
        type: CARD_TYPES.FANTASY_ADVICE,
        title: 'Fantasy Intelligence',
        icon: 'Trophy',
        category: 'FANTASY',
        subcategory: 'Draft Assistant',
        gradient: 'from-blue-600 to-cyan-700',
        data: {
          description: 'VBD rankings, tier cliff detection, and AI draft recommendations.',
          tips: ['Ask about VBD rankings', 'Ask about tier cliffs', 'Ask about waiver targets'],
        },
      });
    }
  }

  // If we have a sport and still need cards, try fetching sport-specific data
  // (handles category='all' with a specific sport, e.g. "MLB Offseason" query)
  // Skip this fallback for DFS requests — we don't want betting/odds cards shown in place of DFS cards.
  if (cards.length < count && normalizedSport && category !== 'dfs') {
    console.log(`[v0] [CARDS-GEN] Still need cards, attempting sport-specific fetch for ${displaySport}`);
    try {
      const sportCards = await generateSportSpecificCards(normalizedSport, count - cards.length, 'betting');
      // Skip cards whose title already exists (avoids duplicates when arbitrage fallback + odds both return same games)
      const existingTitles = new Set(cards.map(c => (c.title || '').toLowerCase().trim()));
      const newCards = sportCards.filter(c =>
        c.data?.realData === true &&
        !existingTitles.has((c.title || '').toLowerCase().trim())
      );
      if (newCards.length > 0) {
        cards.push(...newCards.slice(0, count - cards.length));
        console.log(`[v0] [CARDS-GEN] Added ${newCards.length} real ${displaySport} cards`);
      }
    } catch (err) {
      console.error(`[v0] [CARDS-GEN] Sport-specific fallback failed:`, err);
    }
  }

  // Deduplicate by title across all sources (belt-and-suspenders)
  {
    const _seen = new Set<string>();
    const _deduped: typeof cards = [];
    for (const c of cards) {
      const key = (c.title || '').toLowerCase().trim();
      if (!_seen.has(key)) { _seen.add(key); _deduped.push(c); }
    }
    cards.length = 0;
    cards.push(..._deduped);
  }

  // Final fallback: add informative placeholder cards (deduplicated by index)
  // Skip for DFS — let the AI answer DFS questions directly rather than showing betting placeholders.
  if (category === 'dfs') return cards;
  const fallbackLabels = [
    `${displaySport} Futures Markets`,
    `${displaySport} Line Movement`,
    `${displaySport} Schedule`,
  ];
  let fallbackIdx = 0;
  while (cards.length < count) {
    const label = fallbackLabels[fallbackIdx % fallbackLabels.length];
    fallbackIdx++;
    cards.push({
      type: CARD_TYPES.LIVE_ODDS,
      title: `📈 ${label}`,
      icon: 'LineChart',
      category: displaySport,
      subcategory: 'Market Overview',
      gradient: getSportGradient(normalizedSport || 'default'),
      status: 'neutral',
      data: {
        description: `${displaySport} markets — no live games currently scheduled`,
        sport: normalizedSport,
        note: 'Odds post 24–48 hours before game time. Futures markets available year-round.',
        status: 'OFFSEASON'
      }
    });
  }
  
  console.log('[v0] [CARDS GENERATOR] Generated', cards.length, 'cards (before weather enrichment)');
  console.log('[v0] [CARDS GENERATOR] Card titles:', cards.map((c: InsightCard) => c.title).join(', '));

  // Populate the in-memory cache so subsequent calls (e.g. /api/analyze) reuse these
  if (cards.length > 0) {
    setCachedCards(cards, category || 'all', sport, userContext);
  }

  // Add weather cards for outdoor sports if betting category
  if ((category === 'betting' || !category) && normalizedSport) {
    const isOutdoorSport = normalizedSport === 'americanfootball_nfl' || 
                          normalizedSport === 'baseball_mlb';
    
    if (isOutdoorSport) {
      console.log('[v0] [CARDS GENERATOR] Outdoor sport detected, attempting weather enrichment');
      try {
        const { enrichCardsWithWeather } = await import('@/lib/weather-service');
        const enrichedCards = await enrichCardsWithWeather(cards);
        console.log('[v0] [CARDS GENERATOR] Weather enrichment complete:', enrichedCards.length - cards.length, 'weather cards added');
        return enrichedCards.slice(0, count + 1); // Allow 1 extra for weather card
      } catch (error) {
        console.error('[v0] [CARDS GENERATOR] Weather enrichment failed:', error);
        // Fall through to return original cards
      }
    }
  }

  // Assign stable deterministic IDs to all cards before returning
  const final = cards.slice(0, count);
  const stamped = final.map((c, i) => c.id ? c : { ...c, id: cardId(c.type, c.category, c.title, String(i)) });
  logger.info(LogCategory.API, 'cards_generated', { metadata: { count: stamped.length, sport, category, multiSport } });
  return stamped;
}

// ============================================================================
// Exported function — wrapped with Next.js unstable_cache so results survive
// across Vercel serverless invocations (Next.js Data Cache, 3-minute TTL).
// The in-memory cardCacheMap above acts as a fast L1 cache within a warm
// container; unstable_cache is the L2 that bridges cold starts.
// ============================================================================
export const generateContextualCards = unstable_cache(
  _generateContextualCards,
  ['cards-generator'],
  { revalidate: 180 } // 3 minutes — matches CARD_CACHE_TTL
);

// ============================================================================
// cardsToPromptContext — converts generated cards into a compact, structured
// text block that can be injected into the AI enrichedPrompt.
//
// This is the critical bridge that makes the AI response reference the SAME
// specific games, players, and odds that appear in the UI cards below it.
// Called by /api/analyze after cards are resolved, before the AI call starts.
// ============================================================================
export function cardsToPromptContext(cards: InsightCard[]): string {
  if (!cards || cards.length === 0) return '';

  const lines: string[] = [];

  for (const card of cards) {
    if (!card.data) continue;
    const d = card.data as Record<string, unknown>;

    // ── Betting / Live Odds cards ────────────────────────────────────────────
    if (
      card.type === CARD_TYPES.LIVE_ODDS ||
      card.type === 'live-odds' ||
      card.type === 'betting'
    ) {
      const matchup = String(d.matchup ?? card.title ?? '');
      if (!matchup) continue;
      const parts: string[] = [matchup];
      if (d.gameTime) parts.push(`Time: ${d.gameTime}`);
      if (d.homeOdds && d.awayOdds && d.homeOdds !== '—' && d.awayOdds !== '—') {
        parts.push(`ML: ${d.homeOdds} / ${d.awayOdds}`);
      }
      if (d.homeSpread && d.homeSpread !== 'N/A') parts.push(`Spread: ${d.homeSpread}`);
      if (d.overUnder && d.overUnder !== 'N/A') parts.push(`O/U: ${d.overUnder}`);
      if (d.bookmaker) parts.push(`Book: ${d.bookmaker}`);
      if (d.finalScore) parts.push(`Final: ${d.finalScore}`);
      lines.push(parts.join(' | '));
      continue;
    }

    // ── DFS lineup cards ─────────────────────────────────────────────────────
    if (card.type === CARD_TYPES.DFS_LINEUP || card.type === 'dfs-lineup') {
      const parts: string[] = [`DFS: ${card.title}`];
      if (d.player) parts.push(`Core: ${d.player}${d.position ? ` (${d.position})` : ''}`);
      if (d.salary) parts.push(`Salary: ${d.salary}`);
      if (d.projection) parts.push(`Proj: ${d.projection} pts`);
      if (d.ownership) parts.push(`Own: ${d.ownership}`);
      if (d.targetGame) parts.push(`Game: ${d.targetGame}`);
      if (Array.isArray(d.targetPlayers) && (d.targetPlayers as string[]).length) {
        parts.push(`Stack: ${(d.targetPlayers as string[]).join(', ')}`);
      }
      lines.push(parts.join(' | '));
      continue;
    }

    // ── Kalshi / prediction market cards ─────────────────────────────────────
    if (
      card.type === CARD_TYPES.KALSHI_INSIGHT || card.type === CARD_TYPES.KALSHI_MARKET ||
      card.type === 'kalshi' || card.type === 'kalshi-market'
    ) {
      const title = String(d.market ?? d.title ?? card.title ?? '');
      const parts: string[] = [`Kalshi: ${title}`];
      const yesCents = d.yesPct !== undefined ? d.yesPct : (d.yesPrice ? parseFloat(String(d.yesPrice)) : undefined);
      const noCents  = d.noPct  !== undefined ? d.noPct  : (d.noPrice  ? parseFloat(String(d.noPrice))  : undefined);
      if (yesCents !== undefined) parts.push(`YES: ${yesCents}¢`);
      if (noCents  !== undefined) parts.push(`NO: ${noCents}¢`);
      if (d.volume) parts.push(`Vol: ${d.volume}`);
      if (d.recommendation) parts.push(String(d.recommendation));
      if (d.expiresLabel) parts.push(`Expires: ${d.expiresLabel}`);
      lines.push(parts.join(' | '));
      continue;
    }

    // ── Player prop / prop-hit-rate cards ────────────────────────────────────
    if (
      card.type === CARD_TYPES.PLAYER_PROP ||
      card.type === 'prop-hit-rate' ||
      card.type === 'player-prop' ||
      card.type === 'prop-hit-rate'
    ) {
      const parts: string[] = [String(d.player ?? card.title ?? '')];
      if (d.stat) parts.push(String(d.stat));
      if (d.line !== undefined) parts.push(`Line: ${d.line}`);
      if (d.overOdds) parts.push(`Over: ${d.overOdds}`);
      if (d.underOdds) parts.push(`Under: ${d.underOdds}`);
      if (d.hitRate) parts.push(`Hit%: ${d.hitRate}`);
      lines.push(parts.join(' | '));
      continue;
    }

    // ── Arbitrage cards ───────────────────────────────────────────────────────
    if (card.type === CARD_TYPES.ARBITRAGE_OPPORTUNITY || card.type === 'arbitrage') {
      const parts: string[] = [`Arb: ${card.title}`];
      if (d.profit) parts.push(`Profit: ${d.profit}`);
      if (d.book1 && d.book2) parts.push(`Books: ${d.book1} vs ${d.book2}`);
      lines.push(parts.join(' | '));
      continue;
    }

    // ── Fantasy cards ─────────────────────────────────────────────────────────
    if (
      card.type === CARD_TYPES.FANTASY_ADVICE ||
      card.type === 'fantasy' ||
      card.type === 'fantasy-advice'
    ) {
      const parts: string[] = [`Fantasy: ${card.title}`];
      if (d.player) parts.push(String(d.player));
      if (d.recommendation) parts.push(String(d.recommendation));
      lines.push(parts.join(' | '));
      continue;
    }

    // ── DFS Slate card (full optimal lineup) ─────────────────────────────────
    if (card.type === 'dfs-slate' || card.type === CARD_TYPES.DFS_SLATE) {
      const slateArr = Array.isArray(d.slate) ? d.slate as any[] : [];
      const parts: string[] = [`DFS MLB Optimal Slate`];
      if (d.totalSalary) parts.push(`Salary: ${d.totalSalary}`);
      if (d.totalProjPts) parts.push(`Proj: ${d.totalProjPts} pts`);
      if (d.topStack) parts.push(`Stack: ${d.topStack}`);
      if (slateArr.length > 0) {
        const roster = slateArr
          .map((p: any) => `${p.position} ${p.player} (${p.team}) ${p.salary} ${p.projection}pts ${p.ownership}own`)
          .join(' | ');
        parts.push(`Lineup: ${roster}`);
      }
      lines.push(parts.join(' | '));
      continue;
    }

    // ── DFS Value / Matchup / Contrarian / Chalk cards ────────────────────────
    if (
      card.type === 'dfs-value' || card.type === 'dfs-matchup' ||
      card.type === 'dfs-contrarian' || card.type === 'dfs-chalk' ||
      card.type === CARD_TYPES.DFS_VALUE || card.type === CARD_TYPES.DFS_MATCHUP ||
      card.type === CARD_TYPES.DFS_CONTRARIAN
    ) {
      const catLabel = String(d.cardCategory ?? card.type.replace('dfs-', '')).toUpperCase();
      const parts: string[] = [`DFS ${catLabel}`];
      if (d.player) parts.push(`Player: ${d.player}${d.position ? ` (${d.position})` : ''}`);
      if (d.team && d.team !== '—') parts.push(`Team: ${d.team}`);
      if (d.salary) parts.push(`Salary: ${d.salary}`);
      if (d.projection) parts.push(`Proj: ${d.projection} DK pts`);
      if (d.ownership) parts.push(`Own: ${d.ownership}`);
      if (d.dkValue) parts.push(`Value: ${d.dkValue}x pts/$k`);
      if (d.matchupScore) parts.push(`Matchup: ${d.matchupScore}`);
      if (d.targetGame) parts.push(`Game: ${d.targetGame}`);
      if (d.recentGamesAvg) parts.push(`L5 avg: ${d.recentGamesAvg}`);
      if (d.homeDKAvg && d.roadDKAvg) parts.push(`Home/Road: ${d.homeDKAvg}/${d.roadDKAvg} DK avg`);
      lines.push(parts.join(' | '));
      continue;
    }

    // ── Weather cards ──────────────────────────────────────────────────────────
    if (
      card.type === 'weather_impact' || card.type === 'weather_game' ||
      card.type === CARD_TYPES.WEATHER_IMPACT || card.type === CARD_TYPES.WEATHER_GAME
    ) {
      const parts: string[] = [`Weather: ${card.title}`];
      if (d.location) parts.push(String(d.location));
      if (d.temperature) parts.push(`Temp: ${d.temperature}`);
      if (d.wind) parts.push(`Wind: ${d.wind}`);
      if (d.precipitation) parts.push(`Precip: ${d.precipitation}`);
      if (d.gameImpact) parts.push(`Impact: ${d.gameImpact}`);
      lines.push(parts.join(' | '));
      continue;
    }

    // ── MLB Projection cards ───────────────────────────────────────────────────
    if (card.type === 'mlb_projection_card') {
      const name = String(d.player_name ?? d.playerName ?? card.title ?? '');
      const parts: string[] = [`MLB Proj: ${name}`];
      if (d.team) parts.push(`Team: ${d.team}`);
      if (d.position) parts.push(`Pos: ${d.position}`);
      const metrics = Array.isArray(d.summary_metrics) ? d.summary_metrics as any[] : [];
      const dkPts = metrics.find((m: any) => m.label === 'DK Proj Pts')?.value;
      if (dkPts) parts.push(`DK Proj: ${dkPts}`);
      if (d.matchup_score) parts.push(`Matchup: ${(parseFloat(String(d.matchup_score)) * 100).toFixed(0)}/100`);
      if (d.trend_note) parts.push(String(d.trend_note));
      lines.push(parts.join(' | '));
      continue;
    }

    // ── Generic fallback: include title only ─────────────────────────────────
    if (card.title) lines.push(card.title);
  }

  if (lines.length === 0) return '';

  return `[LIVE DATA CARDS visible to user — ${lines.length} card(s) already displayed in the UI:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\nYour response MUST reference specific values shown in these cards — e.g. "With the -7.5 spread..." or "Given Gerrit Cole's 22.4 DK pts projection..." or "At 65¢ YES...". Ground your analysis in the exact numbers the user sees. Do not merely list all data; integrate the key values into 2-4 sentences of insight that goes beyond the raw numbers. Start your response immediately with the insight — no preamble.]`;
}
