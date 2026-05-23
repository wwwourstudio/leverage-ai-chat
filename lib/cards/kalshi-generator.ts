import { CARD_TYPES, CARD_STATUS } from '@/lib/constants';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/config';
import type { CardData } from '@/lib/types';
import type { KalshiTileData } from '@/components/data-cards/KalshiMarketTile';

type InsightCard = CardData;

const SPORT_KALSHI_KEYWORDS: Record<string, string[]> = {
  basketball_nba: ['NBA', 'basketball'],
  americanfootball_nfl: ['NFL', 'football', 'Super Bowl'],
  baseball_mlb: ['MLB', 'baseball', 'World Series'],
  icehockey_nhl: ['NHL', 'hockey', 'Stanley Cup'],
  americanfootball_ncaaf: ['NCAAF', 'college football', 'CFP'],
  basketball_ncaab: ['NCAAB', 'March Madness', 'college basketball'],
};

const SUBCATEGORY_GRADIENTS: Record<string, string> = {
  sports:   'from-teal-700 to-cyan-800',
  politics: 'from-indigo-700 to-violet-800',
  weather:  'from-sky-700 to-blue-800',
  finance:  'from-emerald-700 to-teal-800',
  crypto:   'from-orange-700 to-amber-800',
  culture:  'from-purple-700 to-pink-800',
  trending: 'from-teal-600 to-cyan-700',
};

export function inferKalshiSub(rawCtx: string): string {
  if (/(culture|entertainment|movie|film|music|tv|awards|oscar|grammy|emmy|celebrity|pop culture|arts)/.test(rawCtx)) return 'culture';
  if (/(politic|election|senate|house|president|governor|trump|biden)/.test(rawCtx)) return 'politics';
  if (/(weather|climate|rain|snow|hurricane|temperature)/.test(rawCtx)) return 'weather';
  if (/(finance|financial|economy|inflation|rate cut|fed|stocks|crypto|bitcoin|ethereum)/.test(rawCtx)) return 'finance';
  if (/(sport|nfl|nba|mlb|nhl|soccer|football|basketball|baseball|hockey)/.test(rawCtx)) return 'sports';
  return '';
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return n > 0 ? `$${n}` : '—';
}

function deriveChip(m: any): string {
  const s = m.seriesTicker || m.category || '';
  if (s && s !== 'Prediction Market') return s.toUpperCase().slice(0, 12);
  return (m.category || 'KALSHI').toUpperCase().slice(0, 12);
}

/** Convert a KalshiMarket to KalshiTileData for use in the grid card. */
function normalizeMarketForTile(m: any): KalshiTileData {
  const yesPct = Math.min(99, Math.max(1, Math.round(m.yesPrice ?? 50)));
  const noPct = Math.min(99, Math.max(1, Math.round(m.noPrice ?? (100 - yesPct))));
  const vol = fmtVol(m.volume24h > 0 ? m.volume24h : m.volume ?? 0);
  return {
    ticker: m.ticker ?? '',
    title: m.title ?? 'Market',
    categoryChip: deriveChip(m),
    outcomes: [
      {
        label: 'Yes',
        yesPct,
        multiplier: yesPct > 0 ? parseFloat((100 / yesPct).toFixed(2)) : 2,
        isLeading: yesPct >= 50,
      },
      {
        label: 'No',
        yesPct: noPct,
        multiplier: noPct > 0 ? parseFloat((100 / noPct).toFixed(2)) : 2,
        isLeading: noPct > yesPct,
      },
    ],
    volume: vol,
    marketCount: 1,
    isLive: m.status === 'active' || m.status === 'open',
    eventTicker: m.eventTicker,
    closeTimeIso: m.closeTime || null,
  };
}

/** Package markets into a single grouped InsightCard for the UI. */
function kalshiMarketsToGroupedCard(
  markets: any[],
  subcategory: string,
  parentTitle?: string,
): InsightCard {
  const top = markets.slice(0, 6);
  const label = cap(subcategory || 'trending');
  return {
    type: `kalshi-${subcategory || 'trending'}`,
    title: parentTitle || `${label} Prediction Markets`,
    icon: 'TrendingUp',
    category: 'KALSHI',
    subcategory: label,
    gradient: SUBCATEGORY_GRADIENTS[subcategory] ?? 'from-teal-600 to-cyan-700',
    data: {
      markets: top.map(normalizeMarketForTile),
      seriesTicker: top[0]?.seriesTicker ?? '',
    },
    status: 'active',
    realData: true,
  } as InsightCard;
}

function buildKalshiUnavailableCards(_count: number): InsightCard[] {
  return [
    {
      type: CARD_TYPES.KALSHI_MARKET,
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
    } as InsightCard,
  ];
}

function buildKalshiNoMarketsCards(): InsightCard[] {
  return [
    {
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
    } as InsightCard,
  ];
}

async function tryDbFallback(count: number, subcategory?: string): Promise<any[]> {
  try {
    const { createClient: createSb } = await import('@supabase/supabase-js');
    const sb = createSb(getSupabaseUrl()!, getSupabaseAnonKey()!, { db: { schema: 'api' } });
    let q = sb
      .from('kalshi_markets')
      .select('market_id, title, category, yes_price, no_price, volume, close_time')
      .gt('expires_at', new Date().toISOString())
      .order('cached_at', { ascending: false })
      .limit(count * 4);
    const { data: dbRows } = await q;
    if (dbRows && dbRows.length > 0) {
      const { buildKalshiMarketFromDbRow } = await import('@/lib/kalshi/index');
      return dbRows.map(buildKalshiMarketFromDbRow);
    }
  } catch { /* DB unavailable */ }
  return [];
}

export async function generateKalshiCards(
  subcategory: string | undefined,
  userContext: string | undefined,
  count: number,
  sport?: string,
): Promise<InsightCard[]> {
  const rawCtx = String(userContext || '').toLowerCase();
  const sub = (subcategory || inferKalshiSub(rawCtx)).toLowerCase();
  console.log('[v0] [KALSHI] subcategory=' + (sub || 'none (trending)'));

  try {
    const {
      fetchKalshiMarketsWithRetry,
      fetchSportsMarkets,
      fetchElectionMarkets,
      fetchWeatherMarkets,
      fetchFinanceMarkets,
      fetchTopMarketsByVolume,
      fetchAllKalshiMarkets,
      wasKalshiFetchError,
    } = await import('@/lib/kalshi/index');

    let markets: any[] = [];

    if (sub === 'sports' || sub === 'sport') {
      const fastFetch = fetchKalshiMarketsWithRetry({
        search: 'NFL NBA MLB NHL Super Bowl March Madness',
        limit: Math.max(count * 4, 24),
        maxRetries: 2,
      });
      const raceResult = await Promise.race([
        fetchSportsMarkets(),
        new Promise<any[]>(resolve => setTimeout(() => resolve([]), 3500)),
      ]).catch(() => [] as any[]);
      markets = raceResult.length > 0 ? raceResult : await fastFetch.catch(() => [] as any[]);
    } else if (sub === 'politics' || sub === 'elections' || sub === 'election') {
      markets = await fetchElectionMarkets({ limit: count * 5 });
      if (markets.length === 0) {
        markets = await fetchTopMarketsByVolume(count * 3).catch(() => [] as any[]);
      }
    } else if (sub === 'weather' || sub === 'climate') {
      markets = await fetchWeatherMarkets(count * 5);
    } else if (['financials', 'finance', 'economics', 'crypto', 'companies'].includes(sub)) {
      markets = await fetchFinanceMarkets(count * 5);
    } else if (sub === 'trending') {
      markets = await fetchTopMarketsByVolume(count);
      if (markets.length < count) {
        const broadMarkets = await fetchKalshiMarketsWithRetry({ status: 'open', limit: 200, maxRetries: 2 });
        const ranked = broadMarkets
          .sort((a: any, b: any) => (b.volume24h || b.volume || 0) - (a.volume24h || a.volume || 0))
          .slice(0, count);
        if (ranked.length > markets.length) markets = ranked;
      }
    } else if (['culture', 'entertainment', 'arts', 'pop culture', 'awards', 'tv', 'film',
                'music', 'movies', 'celebrity', 'oscars', 'emmys', 'grammys'].includes(sub)) {
      markets = await fetchKalshiMarketsWithRetry({
        search: 'entertainment',
        status: 'open',
        limit: Math.max(count * 3, 30),
        maxRetries: 1,
      });
      if (markets.length === 0) {
        return [kalshiMarketsToGroupedCard([], 'culture', 'Entertainment Markets')];
      }
    } else {
      markets = await fetchKalshiMarketsWithRetry({
        status: 'open',
        limit: Math.max(count * 5, 50),
        maxRetries: 2,
      });

      if (markets.length === 0) {
        const [electionMarkets, sportsMarkets] = await Promise.allSettled([
          fetchElectionMarkets({ limit: count * 3 }),
          fetchSportsMarkets(),
        ]);
        const fallback = [
          ...(electionMarkets.status === 'fulfilled' ? electionMarkets.value : []),
          ...(sportsMarkets.status === 'fulfilled' ? sportsMarkets.value : []),
        ];
        if (fallback.length > 0) markets = fallback;
      }

      if (markets.length === 0) {
        try {
          const allMarkets = await fetchAllKalshiMarkets({ status: 'open', maxMarkets: Math.max(count * 10, 100) });
          if (allMarkets.length > 0) markets = allMarkets;
        } catch { /* fetchAllKalshiMarkets failed */ }
      }

      if (sport && markets.length > 0) {
        const keywords = SPORT_KALSHI_KEYWORDS[sport];
        if (keywords) {
          const sportFiltered = markets.filter((m: any) => {
            const t = ((m.title || m.ticker || '') as string).toLowerCase();
            return keywords.some(kw => t.includes(kw.toLowerCase()));
          });
          if (sportFiltered.length > 0) markets = sportFiltered;
        }
      }
    }

    const CLOSED_STATUSES = new Set(['closed', 'settled', 'resolved', 'finalized']);
    markets = markets.filter((m: any) => !m.status || !CLOSED_STATUSES.has(m.status));
    console.log(`[v0] [KALSHI] Fetched ${markets.length} open markets`);

    if (markets.length > 0) {
      // Sort by activity score
      const activityScore = (m: any): number =>
        (m.priceIsReal ? 1_000_000 : 0)
        + ((m.yesBid > 0 || m.yesAsk > 0) ? 200_000 : 0)
        + (m.volume24h ?? 0) * 10
        + (m.volume ?? 0)
        + (m.openInterest ?? 0);
      markets.sort((a: any, b: any) => activityScore(b) - activityScore(a));

      // Return ONE grouped card with up to 6 markets inside
      const grouped = kalshiMarketsToGroupedCard(markets, sub || 'trending');
      console.log(`[v0] [KALSHI] Returning grouped card with ${Math.min(markets.length, 6)} markets`);
      return [grouped];
    }

    // All live strategies exhausted — try DB cache
    console.warn('[v0] [KALSHI] Live API returned 0 markets — trying DB cache');
    const dbMarkets = await tryDbFallback(count, sub);
    if (dbMarkets.length > 0) {
      const grouped = kalshiMarketsToGroupedCard(dbMarkets, sub || 'trending');
      console.log(`[v0] [KALSHI] DB cache supplied ${dbMarkets.length} markets`);
      return [grouped];
    }

    return wasKalshiFetchError() ? buildKalshiUnavailableCards(count) : buildKalshiNoMarketsCards();
  } catch (error) {
    console.error('[v0] [KALSHI] Error:', error instanceof Error ? error.message : String(error));
    const dbMarkets = await tryDbFallback(count, sub);
    if (dbMarkets.length > 0) {
      return [kalshiMarketsToGroupedCard(dbMarkets, sub || 'trending')];
    }
    return buildKalshiUnavailableCards(count);
  }
}
