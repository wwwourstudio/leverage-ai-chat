import { CARD_TYPES, CARD_STATUS } from '@/lib/constants';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/config';
import type { CardData } from '@/lib/types';

type InsightCard = CardData;

const SPORT_KALSHI_KEYWORDS: Record<string, string[]> = {
  basketball_nba: ['NBA', 'basketball'],
  americanfootball_nfl: ['NFL', 'football', 'Super Bowl'],
  baseball_mlb: ['MLB', 'baseball', 'World Series'],
  icehockey_nhl: ['NHL', 'hockey', 'Stanley Cup'],
  americanfootball_ncaaf: ['NCAAF', 'college football', 'CFP'],
  basketball_ncaab: ['NCAAB', 'March Madness', 'college basketball'],
};

function inferKalshiSub(rawCtx: string): string {
  if (/(culture|entertainment|movie|film|music|tv|awards|oscar|grammy|emmy|celebrity|pop culture|arts)/.test(rawCtx)) return 'culture';
  if (/(politic|election|senate|house|president|governor|trump|biden)/.test(rawCtx)) return 'politics';
  if (/(weather|climate|rain|snow|hurricane|temperature)/.test(rawCtx)) return 'weather';
  if (/(finance|financial|economy|inflation|rate cut|fed|stocks|crypto|bitcoin|ethereum)/.test(rawCtx)) return 'finance';
  if (/(sport|nfl|nba|mlb|nhl|soccer|football|basketball|baseball|hockey)/.test(rawCtx)) return 'sports';
  return '';
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
    {
      type: CARD_TYPES.KALSHI_INSIGHT,
      title: 'Political Markets Overview',
      icon: 'BarChart3',
      category: 'KALSHI',
      subcategory: 'Politics · Strategy',
      gradient: 'from-indigo-700 to-violet-800',
      status: CARD_STATUS.NEUTRAL,
      realData: false,
      data: {
        yesPct: 52,
        noPct: 48,
        edgeScore: 4,
        signal: 'Political event markets on Kalshi tend to be efficient near election dates but mispriced 30+ days out. Look for YES contracts in contested races where polling shows >60% consensus.',
        volumeTier: 'High',
        spreadLabel: '2–4¢',
        priceDirection: 'up',
        priceChange: 2,
      },
    } as InsightCard,
    {
      type: CARD_TYPES.KALSHI_INSIGHT,
      title: 'Weather & Climate Prediction Markets',
      icon: 'Sparkles',
      category: 'KALSHI',
      subcategory: 'Weather · Strategy',
      gradient: 'from-sky-700 to-blue-800',
      status: CARD_STATUS.NEUTRAL,
      realData: false,
      data: {
        yesPct: 55,
        noPct: 45,
        edgeScore: 6,
        signal: 'Temperature and precipitation markets price in NOAA model consensus. Edge exists when local knowledge diverges from national models — especially coastal cities with micro-climates.',
        volumeTier: 'Medium',
        spreadLabel: '3–5¢',
        priceDirection: 'flat',
        priceChange: 0,
      },
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
    {
      type: CARD_TYPES.KALSHI_INSIGHT,
      title: 'How to Find Edge on Kalshi',
      icon: 'Sparkles',
      category: 'KALSHI',
      subcategory: 'Strategy Guide',
      gradient: 'from-violet-700 to-purple-800',
      status: CARD_STATUS.NEUTRAL,
      realData: false,
      data: {
        yesPct: 60,
        noPct: 40,
        edgeScore: 8,
        signal: 'Best edge exists in markets 30+ days from resolution where information is still forming. Focus on markets with daily volume >$10K and a bid/ask spread under 5¢. Correlate with real-world probabilities (polls, models) vs implied Kalshi pricing.',
        volumeTier: 'High',
        spreadLabel: '2–5¢',
        priceDirection: 'up',
        priceChange: 3,
      },
    } as InsightCard,
    {
      type: CARD_TYPES.KALSHI_INSIGHT,
      title: 'Cross-Market Arbitrage: Kalshi vs Sportsbooks',
      icon: 'DollarSign',
      category: 'KALSHI',
      subcategory: 'Arbitrage · Strategy',
      gradient: 'from-emerald-700 to-teal-800',
      status: CARD_STATUS.VALUE,
      realData: false,
      data: {
        yesPct: 58,
        noPct: 42,
        edgeScore: 12,
        signal: 'Sports game outcomes on Kalshi often misprice vs sportsbook implied odds. When the spread between Kalshi YES price and sportsbook ML implied probability exceeds 5%, a cross-market arbitrage exists. Ask me to calculate for a specific game.',
        volumeTier: 'Medium',
        spreadLabel: '3–7¢',
        priceDirection: 'up',
        priceChange: 5,
      },
    } as InsightCard,
  ];
}

async function tryDbFallback(count: number): Promise<InsightCard[]> {
  try {
    const { createClient: createSb } = await import('@supabase/supabase-js');
    const sb = createSb(getSupabaseUrl()!, getSupabaseAnonKey()!, { db: { schema: 'api' } });
    const { data: dbRows } = await sb
      .from('kalshi_markets')
      .select('market_id, title, category, yes_price, no_price, volume, close_time')
      .gt('expires_at', new Date().toISOString())
      .order('cached_at', { ascending: false })
      .limit(count * 4);
    if (dbRows && dbRows.length > 0) {
      const { buildKalshiMarketFromDbRow, kalshiMarketToCard } = await import('@/lib/kalshi/index');
      const dbMarkets = dbRows.map(buildKalshiMarketFromDbRow);
      return dbMarkets.slice(0, count).map((m: any) => kalshiMarketToCard(m, null));
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
  const cards: InsightCard[] = [];
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
      fetchMarketOrderbook,
      kalshiMarketToCard,
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
        console.log('[v0] [KALSHI] No election markets — falling back to top by volume');
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
        console.warn('[v0] [KALSHI] No entertainment/culture markets found — showing placeholder');
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
        } as InsightCard);
        return cards;
      }
    } else {
      markets = await fetchKalshiMarketsWithRetry({
        status: 'open',
        limit: Math.max(count * 5, 50),
        maxRetries: 2,
      });

      if (markets.length === 0) {
        console.log('[v0] [KALSHI] Generic fetch returned 0 — trying election/sports fallback');
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
        console.log('[v0] [KALSHI] Category/election/sports all 0 — trying fetchAllKalshiMarkets');
        try {
          const allMarkets = await fetchAllKalshiMarkets({ status: 'open', maxMarkets: Math.max(count * 10, 100) });
          if (allMarkets.length > 0) markets = allMarkets;
        } catch { /* fetchAllKalshiMarkets failed */ }
      }

      if (sport && markets.length > 0) {
        const keywords = SPORT_KALSHI_KEYWORDS[sport];
        if (keywords) {
          const sportFiltered = markets.filter((m: any) => {
            const title = ((m.title || m.ticker || '') as string).toLowerCase();
            return keywords.some(kw => title.includes(kw.toLowerCase()));
          });
          if (sportFiltered.length > 0) {
            markets = sportFiltered;
            console.log(`[v0] [KALSHI] Filtered to ${markets.length} ${sport} markets`);
          }
        }
      }
    }

    const CLOSED_STATUSES = new Set(['closed', 'settled', 'resolved', 'finalized']);
    markets = markets.filter((m: any) => !m.status || !CLOSED_STATUSES.has(m.status));
    console.log(`[v0] [KALSHI] Fetched ${markets.length} open markets`);

    if (markets.length > 0) {
      const activityScore = (m: any): number =>
        (m.priceIsReal ? 1_000_000 : 0)
        + ((m.yesBid > 0 || m.yesAsk > 0) ? 200_000 : 0)
        + (m.volume24h ?? 0) * 10
        + (m.volume ?? 0)
        + (m.openInterest ?? 0);
      markets.sort((a: any, b: any) => activityScore(b) - activityScore(a));
      const topMarkets = markets.slice(0, count);
      const orderbookResults = await Promise.allSettled(
        topMarkets.slice(0, 3).map((m: any) =>
          Promise.race([
            fetchMarketOrderbook(m.ticker),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 1500)),
          ]),
        ),
      );
      const kalshiCards = topMarkets.map((m: any, i: number) => {
        const ob = orderbookResults[i]?.status === 'fulfilled' ? orderbookResults[i].value : null;
        return kalshiMarketToCard(m, ob);
      });
      cards.push(...kalshiCards);
      console.log(`[v0] [KALSHI] Added ${kalshiCards.length} cards`);
      return cards;
    }

    // All live strategies exhausted — try DB cache
    console.warn('[v0] [KALSHI] Live API returned 0 markets — trying DB cache');
    const dbCards = await tryDbFallback(count);
    if (dbCards.length > 0) {
      cards.push(...dbCards);
      console.log(`[v0] [KALSHI] DB cache supplied ${dbCards.length} cards`);
      return cards;
    }

    cards.push(...(wasKalshiFetchError() ? buildKalshiUnavailableCards(count) : buildKalshiNoMarketsCards()));
  } catch (error) {
    console.error('[v0] [KALSHI] Error:', error instanceof Error ? error.message : String(error));
    const dbCards = await tryDbFallback(count);
    if (dbCards.length > 0) {
      cards.push(...dbCards);
      return cards;
    }
    cards.push(...buildKalshiUnavailableCards(count));
  }

  return cards;
}
