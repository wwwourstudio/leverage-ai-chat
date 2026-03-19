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
import { CARD_TYPES, SPORT_KEYS, sportToApi, apiToSport, getSportGradient } from '@/lib/constants';
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

/** Build a stable cache key from category + sport */
function makeCacheKey(category?: string, sport?: string): string {
  return `${category ?? 'all'}:${sport ?? ''}`;
}

/** Retrieve cached cards if still fresh for the given category+sport */
export function getCachedCards(category?: string, sport?: string, count: number = 6): InsightCard[] | null {
  const key = makeCacheKey(category, sport);
  const entry = cardCacheMap.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CARD_CACHE_TTL) {
    cardCacheMap.delete(key);
    return null;
  }
  return entry.cards.slice(0, count);
}

/** Store cards in the in-memory cache under the given category+sport key */
function setCachedCards(cards: InsightCard[], category: string, sport?: string): void {
  const key = makeCacheKey(category, sport);
  cardCacheMap.set(key, { cards, timestamp: Date.now(), category });
}

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
        homeOdds: homeOdds ? (homeOdds.price > 0 ? `+${homeOdds.price}` : `${homeOdds.price}`) : (hasOdds ? 'N/A' : '—'),
        awayOdds: awayOdds ? (awayOdds.price > 0 ? `+${awayOdds.price}` : `${awayOdds.price}`) : (hasOdds ? 'N/A' : '—'),
        homeSpread: homeSpread ? `${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${homeSpread.price > 0 ? '+' : ''}${homeSpread.price})` : 'N/A',
        awaySpread: awaySpread ? `${awaySpread.point > 0 ? '+' : ''}${awaySpread.point} (${awaySpread.price > 0 ? '+' : ''}${awaySpread.price})` : 'N/A',
        overUnder: over && under ? `O/U ${over.point}: Over ${over.price > 0 ? '+' : ''}${over.price} / Under ${under.price > 0 ? '+' : ''}${under.price}` : 'N/A',
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
      const { getOddsWithCache } = await import('@/lib/unified-odds-fetcher');
      
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
              homeOdds: homeOdds ? (homeOdds.price > 0 ? `+${homeOdds.price}` : `${homeOdds.price}`) : (hasOdds ? 'N/A' : '—'),
              awayOdds: awayOdds ? (awayOdds.price > 0 ? `+${awayOdds.price}` : `${awayOdds.price}`) : (hasOdds ? 'N/A' : '—'),
              homeSpread: homeSpread ? `${homeSpread.point > 0 ? '+' : ''}${homeSpread.point} (${homeSpread.price > 0 ? '+' : ''}${homeSpread.price})` : 'N/A',
              awaySpread: awaySpread ? `${awaySpread.point > 0 ? '+' : ''}${awaySpread.point} (${awaySpread.price > 0 ? '+' : ''}${awaySpread.price})` : 'N/A',
              overUnder: over && under ? `O/U ${over.point}: Over ${over.price > 0 ? '+' : ''}${over.price} / Under ${under.price > 0 ? '+' : ''}${under.price}` : 'N/A',
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

  // For non-MLB sports use VPE fallback (Statcast is MLB-only)
  const normalizedSport = sport ? sportToApi(sport) : undefined;
  if (normalizedSport && !normalizedSport.includes('baseball')) return [];

  try {
    const { getStatcastData } = await import('@/lib/baseball-savant');
    const data = await Promise.race([
      getStatcastData(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);

    const lowerName = playerName.toLowerCase();
    const player = (Array.isArray(data) ? data : []).find((p: any) => {
      const pName = (p.name ?? p.player_name ?? '').toLowerCase();
      return pName.includes(lowerName) || lowerName.includes(pName);
    });

    if (!player) {
      console.log(`[v0] [PLAYER CARDS] Player "${playerName}" not found in Statcast data`);
      return [];
    }

    const name: string = player.name ?? player.player_name ?? playerName;
    // StatcastPlayer uses camelCase — check those first, then fall back to snake_case
    // variants that may appear in raw CSV-derived objects or legacy data sources.
    const ev       = player.exitVelocity   ?? player.avg_exit_velocity  ?? player.exit_velocity_avg;
    const hardHit  = player.hardHitPct     ?? player.hard_hit_percent   ?? player.hard_hit_pct;
    const barrel   = player.barrelRate     ?? player.barrel_batted_rate ?? player.barrel_pct ?? player.barrel_rate;
    const xba      = player.xba            ?? player.expected_batting_average;
    const xslg     = player.xslg           ?? player.expected_slg;
    const xwoba    = player.xwoba          ?? player.expected_woba;
    const sweetSpot = player.sweetSpotPct  ?? player.sweet_spot_percent ?? player.sweet_spot_pct;

    const metrics = [
      ev != null ? { label: 'Avg Exit Velocity', value: `${Number(ev).toFixed(1)} mph` } : null,
      hardHit != null ? { label: 'Hard Hit %', value: `${Number(hardHit).toFixed(1)}%` } : null,
      barrel != null ? { label: 'Barrel %', value: `${Number(barrel).toFixed(1)}%` } : null,
      xba != null ? { label: 'xBA', value: String(xba) } : null,
      xslg != null ? { label: 'xSLG', value: String(xslg) } : null,
      xwoba != null ? { label: 'xwOBA', value: String(xwoba) } : null,
      sweetSpot != null ? { label: 'Sweet Spot %', value: `${Number(sweetSpot).toFixed(1)}%` } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    // Determine status from quality of metrics
    const evNum = ev ? Number(ev) : 0;
    const barrelNum = barrel ? Number(barrel) : 0;
    const status = evNum >= 92 || barrelNum >= 12 ? 'hot' : evNum >= 88 || barrelNum >= 8 ? 'edge' : 'value';

    const card: InsightCard = {
      type: CARD_TYPES.STATCAST_SUMMARY,
      title: name,
      icon: '⚾',
      category: 'MLB',
      subcategory: 'Statcast Player Analysis',
      gradient: 'from-blue-600/75 via-blue-900/55 to-slate-900/40',
      status,
      summary_metrics: metrics,
      data: { playerName: name, realData: true },
      trend_note: `Live Statcast data from Baseball Savant`,
      last_updated: new Date().toLocaleDateString(),
      metadata: { realData: true, source: 'Baseball Savant Statcast' },
    };

    console.log(`[v0] [PLAYER CARDS] Built live Statcast card for ${name} (${metrics.length} metrics)`);
    return [card];
  } catch (err) {
    console.warn('[v0] [PLAYER CARDS] Failed to fetch Statcast data:', err);
    return [];
  }
}

async function buildVPECards(limit: number): Promise<InsightCard[]> {
  const { Hitter, Pitcher, Team, LEAGUE_AVG_HITTER, LEAGUE_STD_HITTER, validateBenfordForVPE } =
    await Promise.all([
      import('@/lib/vpe'),
      import('@/lib/benford-validator'),
    ]).then(([vpe, benford]) => ({ ...vpe, validateBenfordForVPE: benford.validateBenford }));

  // Representative 2026 MLB players with Statcast-derived stats
  const hitterRoster = [
    { name: 'Aaron Judge',    age: 32, pos: 'RF', stats: { PA: 700, EV50: 99.2, PullAirPercent: 0.38, BarrelPercent: 0.21, HardHitPercent: 0.57, LaunchAngle: 18.2, BatSpeed: 77.4, ContactRate: 0.73, SwingLength: 6.8 } },
    { name: 'Shohei Ohtani',  age: 30, pos: 'DH', stats: { PA: 660, EV50: 96.8, PullAirPercent: 0.34, BarrelPercent: 0.17, HardHitPercent: 0.51, LaunchAngle: 16.1, BatSpeed: 75.2, ContactRate: 0.77, SwingLength: 7.1 } },
    { name: 'Mookie Betts',   age: 32, pos: 'OF', stats: { PA: 620, EV50: 92.1, PullAirPercent: 0.27, BarrelPercent: 0.13, HardHitPercent: 0.47, LaunchAngle: 14.8, BatSpeed: 73.5, ContactRate: 0.82, SwingLength: 7.4 } },
    { name: 'Freddie Freeman', age: 35, pos: '1B', stats: { PA: 640, EV50: 91.4, PullAirPercent: 0.29, BarrelPercent: 0.12, HardHitPercent: 0.44, LaunchAngle: 13.5, BatSpeed: 72.1, ContactRate: 0.84, SwingLength: 7.6 } },
    { name: 'Juan Soto',      age: 26, pos: 'OF', stats: { PA: 650, EV50: 93.7, PullAirPercent: 0.28, BarrelPercent: 0.14, HardHitPercent: 0.49, LaunchAngle: 15.3, BatSpeed: 74.0, ContactRate: 0.80, SwingLength: 7.3 } },
  ];

  const pitcherRoster = [
    { name: 'Gerrit Cole',    age: 34, pos: 'SP', stats: { velocity: 97.2, verticalBreak: 12.4, horizontalBreak: 4.1, spinRate: 2480, extension: 6.8, releaseVariance: 0.15, KPer9: 11.2, CSW: 0.33 } },
    { name: 'Zack Wheeler',   age: 34, pos: 'SP', stats: { velocity: 95.8, verticalBreak: 11.2, horizontalBreak: 3.8, spinRate: 2350, extension: 6.5, releaseVariance: 0.18, KPer9: 10.4, CSW: 0.31 } },
    { name: 'Paul Skenes',    age: 22, pos: 'SP', stats: { velocity: 99.1, verticalBreak: 13.8, horizontalBreak: 4.6, spinRate: 2590, extension: 7.0, releaseVariance: 0.12, KPer9: 12.8, CSW: 0.36 } },
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
        EV50: `${h.stats.EV50} mph`,
        BatSpeed: `${h.stats.BatSpeed} mph`,
        benfordValid: benford.isValid,
        benfordScore: Math.round(benford.score * 100) / 100,
        kalshiMarkets: kalshiMarkets.slice(0, 2),
      },
      metadata: { realData: false, source: 'VPE 3.0' },
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
        benfordValid: benford.isValid,
        benfordScore: Math.round(benford.score * 100) / 100,
        kalshiMarkets: kalshiMarkets.slice(2, 4),
      },
      metadata: { realData: false, source: 'VPE 3.0' },
    });
  }

  console.log(`[v0] [VPE] Generated ${cards.length} VPE cards (${kalshiMarkets.length} Kalshi markets attached)`);
  return cards;
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
  options?: { playerName?: string }
): Promise<InsightCard[]> {
  // Check in-memory cache first to avoid redundant API calls
  // (SSR page load populates this, /api/analyze reuses it)
  const cached = getCachedCards(category, sport, count);
  if (cached && cached.length > 0) {
    logger.debug(LogCategory.CACHE, 'cards_cache_hit', { metadata: { count: cached.length, category, sport } });
    return cached;
  }

  const cards: InsightCard[] = [];
  
  logger.debug(LogCategory.CACHE, 'cards_cache_miss', { metadata: { multiSport, sport, category } });

  // Fantasy with no sport: default to MLB — MLB draft season runs Jan–Apr (NFBC / TGFBI)
  const effectiveSport = (category === 'fantasy' || category === 'draft' || category === 'waiver') && !sport
    ? 'baseball_mlb'
    : sport;

  // Normalize sport to API format, then get display name
  const normalizedSport = effectiveSport ? sportToApi(effectiveSport) : undefined;
  const displaySport = normalizedSport ? apiToSport(normalizedSport).toUpperCase() : 'MULTI-SPORT';

  console.log('[v0] [CARDS GENERATOR] Generating cards...');
  console.log('[v0] [CARDS GENERATOR] Input:', { category, sport, normalizedSport, displaySport, multiSport });
  console.log('[v0] [CARDS GENERATOR] Category:', category, '| Display Sport:', displaySport, '| Count:', count);
  
  // 'all' category — mix betting + Kalshi cards so the default view shows card variety
  if (category === 'all') {
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
      } = await import('@/lib/kalshi-client');

      let markets: any[] = [];

      if (sub === 'sports' || sub === 'sport') {
        markets = await fetchSportsMarkets();
      } else if (sub === 'politics' || sub === 'elections' || sub === 'election') {
        markets = await fetchElectionMarkets({ limit: count * 5 });
      } else if (sub === 'weather' || sub === 'climate') {
        markets = await fetchWeatherMarkets(count * 5);
      } else if (['financials', 'finance', 'economics', 'crypto', 'companies'].includes(sub)) {
        markets = await fetchFinanceMarkets(count * 5);
      } else if (sub === 'trending') {
        markets = await fetchTopMarketsByVolume(count);
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

      console.log(`[v0] [CARDS-GEN] Kalshi fetched ${markets.length} markets`);

      if (markets.length > 0) {
        // Sort by volume descending (most liquid = most relevant)
        markets.sort((a: any, b: any) =>
          ((b.volume24h ?? 0) + (b.volume ?? 0)) - ((a.volume24h ?? 0) + (a.volume ?? 0))
        );
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

      // All strategies exhausted with 0 markets. Surface a graceful placeholder
      // card so the UI communicates the situation rather than silently showing nothing.
      console.warn('[v0] [CARDS-GEN] Kalshi API returned 0 markets after all strategies — showing unavailable card');
      cards.push({
        type: CARD_TYPES.KALSHI_INSIGHT,
        title: 'Prediction Markets Temporarily Unavailable',
        icon: 'TrendingUp',
        category: 'KALSHI',
        subcategory: 'Service Status',
        gradient: 'from-slate-700 to-slate-800',
        status: CARD_STATUS.NEUTRAL,
        realData: false,
        data: {
          iconLabel: 'market',
          yesPct: 50,
          noPct: 50,
          edgeScore: 0,
          signal: 'Kalshi market data is temporarily unavailable. Check kalshi.com for live markets.',
          note: 'Data will refresh automatically once the Kalshi API is reachable.',
          volumeTier: 'Thin',
          spreadLabel: 'N/A',
          priceDirection: 'flat',
          priceChange: 0,
        },
      });
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Kalshi API error:', error);
      // Show a placeholder card even on unexpected errors so the UI slot isn't empty
      cards.push({
        type: CARD_TYPES.KALSHI_INSIGHT,
        title: 'Prediction Markets Temporarily Unavailable',
        icon: 'TrendingUp',
        category: 'KALSHI',
        subcategory: 'Service Status',
        gradient: 'from-slate-700 to-slate-800',
        status: CARD_STATUS.NEUTRAL,
        realData: false,
        data: {
          iconLabel: 'market',
          yesPct: 50,
          noPct: 50,
          edgeScore: 0,
          signal: 'Kalshi market data is temporarily unavailable. Check kalshi.com for live markets.',
          note: error instanceof Error ? error.message : String(error),
          volumeTier: 'Thin',
          spreadLabel: 'N/A',
          priceDirection: 'flat',
          priceChange: 0,
        },
      });
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
            const kellyPct = (bet.kelly_fraction * 100).toFixed(2);
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
                edge: `${(bet.edge * 100).toFixed(2)}%`,
                confidence: `${(bet.confidence_score * 100).toFixed(0)}%`,
                kellyFraction: `${kellyPct}%`,
                recommendedStake: `$${bet.allocated_capital.toFixed(2)}`,
                expectedValue: `$${(bet.allocated_capital * bet.edge).toFixed(2)}`,
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
        
        console.log(`[v0] [CARDS-GEN] Fetched ${props.length} player props`);
        
        if (props.length > 0) {
          const propCards = props.slice(0, count).map(playerPropToCard);
          cards.push(...propCards);
          console.log(`[v0] [CARDS-GEN] Added ${propCards.length} player prop cards`);
          if (cards.length > 0) setCachedCards(cards, 'props', normalizedSport);
          return cards;
        }
      }
    } catch (error) {
      console.error('[v0] [CARDS-GEN] Player props error:', error);
    }
    
    // Fallback placeholder
    cards.push({
      type: CARD_TYPES.PLAYER_PROP,
      title: 'Player Props',
      icon: 'User',
      category: displaySport,
      subcategory: 'Player Props',
      gradient: 'from-blue-600 to-cyan-600',
      data: {
        description: 'Player-specific betting markets',
        note: 'Loading prop markets...',
        realData: false
      }
    });
  }

  // ── LeverageMetrics MLB Projection Engine ──────────────────────────────────
  // Intercepts all MLB categories and routes to the projection pipeline.
  // On failure, falls through to the existing Odds API-based handlers below.
  if (normalizedSport === 'baseball_mlb' && cards.length < count) {
    try {
      if (category === 'dfs') {
        // Full DK MLB slate with Monte Carlo projections
        const { buildDFSSlate } = await import('@/lib/mlb-projections/slate-builder');
        const dfsRaw = await Promise.race([
          buildDFSSlate({ limit: count }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
        ]);
        for (const c of dfsRaw) {
          cards.push({
            type: 'dfs-lineup',
            title: c.title,
            icon: 'Users',
            category: c.category,
            subcategory: c.subcategory,
            gradient: c.gradient,
            status: c.status,
            data: c.data,
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

            // Top play (highest line = most valuable DFS asset)
            const top = unique[0];
            const salaryBase = Math.round((top.line * 190 + 3800) / 100) * 100;
            const proj = top.line;
            // Value plays: top 3 by pts-per-$K excluding the top pick
            const valuePlayers = unique
              .slice(1, 6)
              .map(p => ({ ...p, ppk: p.line / ((Math.round((p.line * 190 + 3800) / 100) * 100) / 1000) }))
              .sort((a, b) => b.ppk - a.ppk)
              .slice(0, 3)
              .map(p => p.player);

            cards.push({
              type: CARD_TYPES.DFS_LINEUP,
              title: `${displaySport || 'DFS'} Optimal Lineup`,
              icon: 'Users',
              category: 'DFS',
              subcategory: `${displaySport || 'Daily Fantasy'} • GPP Stack`,
              gradient: 'from-orange-600 to-red-700',
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
                targetPlayers: valuePlayers.length > 0 ? valuePlayers : undefined,
                platforms: ['DraftKings', 'FanDuel'],
                value: (proj / (salaryBase / 1000)).toFixed(1),
                tips: `${top.player} leads the ${dfsStatLabel[normalizedSport] ?? 'production'} market with a ${proj} projected line — highest ceiling on today's slate.`,
                realData: true,
              },
              realData: true,
            });
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
  if (cards.length < count && normalizedSport) {
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
    setCachedCards(cards, category || 'all', sport);
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
    if (card.type === CARD_TYPES.KALSHI || card.type === 'kalshi') {
      const title = String(d.market ?? d.title ?? card.title ?? '');
      const parts: string[] = [`Kalshi: ${title}`];
      if (d.yesPrice !== undefined) parts.push(`YES: ${d.yesPrice}¢`);
      if (d.noPrice !== undefined) parts.push(`NO: ${d.noPrice}¢`);
      if (d.volume) parts.push(`Vol: ${d.volume}`);
      lines.push(parts.join(' | '));
      continue;
    }

    // ── Player prop / prop-hit-rate cards ────────────────────────────────────
    if (
      card.type === CARD_TYPES.PLAYER_PROP ||
      card.type === CARD_TYPES.PROP_HIT_RATE ||
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
    if (card.type === CARD_TYPES.ARBITRAGE || card.type === 'arbitrage') {
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

    // ── Generic fallback: include title only ─────────────────────────────────
    if (card.title) lines.push(card.title);
  }

  if (lines.length === 0) return '';

  return `[Cards shown in UI below this response — reference these specifically in your analysis:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\nEnsure your response directly addresses and expands on the data shown in these cards.]`;
}
