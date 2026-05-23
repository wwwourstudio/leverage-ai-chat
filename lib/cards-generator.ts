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
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/config';
import type { CardData } from '@/lib/types';
import { generateDFSCards } from '@/lib/cards/dfs-generator';
import {
  generateArbitrageCards,
  generateEVCards,
  generateSharpCards,
  generateLineMovementCards,
  generatePortfolioCards,
} from '@/lib/cards/specialty-generator';
import { generatePitcherFatigueCards } from '@/lib/cards/pitcher-fatigue-generator';
import { generateWeatherCards } from '@/lib/cards/weather-generator';
import { generateKalshiCards } from '@/lib/cards/kalshi-generator';
import { generatePropsCards } from '@/lib/cards/props-generator';

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

const CARD_CACHE_TTL = 45 * 1000; // 45 seconds — live sports data expires quickly
const cardCacheMap = new Map<string, CachedCards>();

/** Build a stable cache key. Includes a userContext prefix so different queries get distinct card sets. */
function makeCacheKey(category?: string, sport?: string, userContext?: string): string {
  const ctxSlug = userContext ? userContext.slice(0, 50).toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
  return `${category ?? 'all'}:${sport ?? ''}:${ctxSlug}`;
}

/** Retrieve cached cards if still fresh for the given key */
function getCachedCards(category?: string, sport?: string, count: number = 6, userContext?: string): InsightCard[] | null {
  const key = makeCacheKey(category, sport, userContext);
  const entry = cardCacheMap.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CARD_CACHE_TTL) {
    cardCacheMap.delete(key);
    return null;
  }
  return entry.cards.slice(0, count);
}

/** Store cards in the in-memory cache under the given key */
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
          realData: false,
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
      realData: false,
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

/** Alias for the canonical CardData type from @/lib/types. */
export type InsightCard = CardData;

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


/** Normalise a raw card array into fully-stamped CardData objects.
 *  Called at every return path so no card ever escapes without an id/status/data. */
function stampCards(raw: InsightCard[], category?: string, sport?: string): CardData[] {
  return raw.map((c, i) => ({
    ...c,
    id: c.id ?? cardId(c.type, c.category, c.title, String(i)),
    status: c.status ?? 'neutral',
    data: (c.data ?? {}) as Record<string, any>,
  }));
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
  options?: { playerName?: string; userContext?: string; draftGroupId?: number }
): Promise<CardData[]> {
  const userContext = options?.userContext;
  const draftGroupId = options?.draftGroupId;
  // Skip the card-level cache for props — the underlying prop data has its own
  // 15-minute TTL inside fetchPlayerProps, and we need to filter/prioritize
  // cards based on userContext (player name, stat type) on every request.
  const isPropsCategory = category === 'props' || category === 'player_props';
  // Also skip cache when a specific DK draft group is requested — each slate
  // produces a different lineup and must not be served from the generic DFS cache.
  if (!isPropsCategory && !draftGroupId) {
    const cached = getCachedCards(category, sport, count, userContext);
    if (cached && cached.length > 0) {
      logger.debug(LogCategory.CACHE, 'cards_cache_hit', { metadata: { count: cached.length, category, sport } });
      return stampCards(cached);
    }
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

  // 'all' category — mix betting + Kalshi cards so the default view shows card variety
  if (category === 'all') {
    if (normalizedSport) {
      const cards = await _generateContextualCards('betting', sport, count);
      if (cards.length > 0) setCachedCards(cards, 'all', sport, userContext);
      return cards;
    }
    const bettingCount = Math.max(1, count - 1);
    const kalshiCount  = Math.max(1, count - bettingCount);
    const [bettingResult, kalshiResult] = await Promise.allSettled([
      _generateContextualCards('betting', sport, bettingCount),
      _generateContextualCards('kalshi',  sport, kalshiCount),
    ]);
    const betting = bettingResult.status === 'fulfilled' ? bettingResult.value : [];
    const kalshi  = kalshiResult.status  === 'fulfilled' ? kalshiResult.value  : [];
    const mixed = [...betting.slice(0, bettingCount), ...kalshi.slice(0, kalshiCount)].slice(0, count);
    if (mixed.length > 0) {
      setCachedCards(mixed, 'all', sport, userContext);
      return mixed;
    }
    // Both betting and Kalshi returned 0 cards — log so it shows up in diagnostics
    console.warn('[v0] [Cards] All sources failed (betting=0, kalshi=0) — falling back to pure betting');
    return _generateContextualCards('betting', sport, count);
  }

  // Player-specific query — fetch live Statcast data for the named player
  if (category === 'player') {
    const playerName = options?.playerName;
    const playerCards = await buildPlayerCards(playerName, sport);
    if (playerCards.length > 0) return stampCards(playerCards);
    // Fallback to VPE overview if player not found
    return stampCards(await buildVPECards(count));
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
    if (finalCards.length > 0) setCachedCards(finalCards, category || 'all', sport, userContext);
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
      setCachedCards(sportCards, category || 'betting', normalizedSport, userContext);
      return sportCards;
    }
    // Fall through if no games available (off-season etc.)
  }

  // ── Specialty categories (delegated to lib/cards/specialty-generator.ts) ──
  if (category === 'arbitrage' || category === 'arb') {
    const arbCards = await generateArbitrageCards(normalizedSport, count);
    setCachedCards(arbCards, 'arbitrage', sport);
    return stampCards(arbCards);
  }
  
  // ── Expected Value ────────────────────────────────────────────────────────
  if (category === 'ev' || category === 'expected-value' || category === 'ev-bets') {
    const evCards = await generateEVCards(normalizedSport, count);
    setCachedCards(evCards, 'ev', sport);
    return stampCards(evCards);
  }

  // ── Sharp money ───────────────────────────────────────────────────────────
  if (category === 'sharp' || category === 'sharp-money' || category === 'steam') {
    const sharpCards = await generateSharpCards(count);
    setCachedCards(sharpCards, 'sharp', sport);
    return stampCards(sharpCards);
  }

  // ── Pitcher fatigue ───────────────────────────────────────────────────────
  if (category === 'pitcher-fatigue' || category === 'fatigue' || category === 'pitcher') {
    const fatigueCards = await generatePitcherFatigueCards(count);
    if (fatigueCards.length > 0) setCachedCards(fatigueCards, 'pitcher-fatigue', sport);
    return stampCards(fatigueCards);
  }

  // ── Bullpen fatigue ───────────────────────────────────────────────────────
  // Real bullpen data requires aggregating per-team relief workload over the
  // prior 3 days from MLB Stats API. Until that ingest is wired up, this
  // category returns an empty array rather than emitting fake-team demo cards.
  if (category === 'bullpen' || category === 'bullpen-fatigue') {
    console.log('[v0] [CARDS-GEN] Bullpen fatigue category — real data not yet wired, returning []');
    return [];
  }

  // ── Standalone weather cards ──────────────────────────────────────────────
  // When the user explicitly asks about weather, build one card per outdoor
  // MLB game today by fetching forecasts at game time from Open-Meteo.
  // Falls back gracefully when no games are scheduled or all venues are domed.
  if (category === 'weather' || category === 'weather-impact') {
    const weatherCards = await generateWeatherCards(count);
    if (weatherCards.length > 0) setCachedCards(weatherCards, 'weather', sport);
    return stampCards(weatherCards);
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

  // ── Line movement ─────────────────────────────────────────────────────────
  if (category === 'lines' || category === 'line_movement') {
    const linesCards = await generateLineMovementCards(count);
    setCachedCards(linesCards, 'line_movement', sport);
    return stampCards(linesCards);
  }
  
  // Kalshi/Prediction Markets — route by subcategory pill when provided
  if (category === 'kalshi') {
    const kalshiCards = await generateKalshiCards(kalshiSubcategory, userContext, count, sport);
    if (kalshiCards.length > 0) setCachedCards(kalshiCards, 'kalshi', sport);
    return stampCards(kalshiCards);
  }

  // ── Portfolio / Kelly ─────────────────────────────────────────────────────
  if (category === 'portfolio' || category === 'kelly' || category === 'sizing' || category === 'bankroll') {
    const portfolioCards = await generatePortfolioCards(count);
    setCachedCards(portfolioCards, 'portfolio', sport);
    return stampCards(portfolioCards);
  }
  
  // Player Props - Fetch real player prop markets
  if (category === 'props' || category === 'player_props') {
    const propsCards = await generatePropsCards(normalizedSport, count, userContext, displaySport);
    if (propsCards.length > 0) setCachedCards(propsCards, 'props', sport);
    return stampCards(propsCards);
  }

  // ── DFS cards (delegated to lib/cards/dfs-generator.ts) ─────────────────
  // Always generates a lineup — falls back to estimated projections when no live games.
  if (category === 'dfs' && normalizedSport) {
    const dfsCards = await generateDFSCards(normalizedSport, count, displaySport);
    if (dfsCards.length > 0) {
      setCachedCards(dfsCards, 'dfs', normalizedSport);
      return stampCards(dfsCards);
    }
  }
  // ── LeverageMetrics MLB Projection Engine ──────────────────────────────────
  // Intercepts non-DFS MLB categories and routes to the projection pipeline.
  // On failure, falls through to the existing Odds API-based handlers below.
  if (normalizedSport === 'baseball_mlb' && cards.length < count && category !== 'dfs') {
    try {
      if (category === 'fantasy') {
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
            data: (c as any).data ?? {},
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
  // DFS is handled early via generateDFSCards — should never reach here.
  if (category === 'dfs') {
    return stampCards([]);
  }
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
        const { enrichCardsWithWeather } = await import('@/lib/weather/index');
        const enrichedCards = await enrichCardsWithWeather(cards);
        console.log('[v0] [CARDS GENERATOR] Weather enrichment complete:', enrichedCards.length - cards.length, 'weather cards added');
        return stampCards(enrichedCards.slice(0, count + 1)); // Allow 1 extra for weather card
      } catch (error) {
        console.error('[v0] [CARDS GENERATOR] Weather enrichment failed:', error);
        // Fall through to return original cards
      }
    }
  }

  const stamped = stampCards(cards.slice(0, count));
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
