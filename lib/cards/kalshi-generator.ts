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

function deriveChip(m: any): string {
  const cat = (m.category || '').trim();
  if (cat && cat !== 'Prediction Market') return cat.toUpperCase().slice(0, 14);
  // Strip KX prefix and take first dash-segment: KXMLB-24-BOSRED → MLB
  const tk = (m.seriesTicker || '').replace(/^KX/, '').split('-')[0];
  return (tk || 'KALSHI').toUpperCase().slice(0, 14);
}

/** Extract human-readable outcome labels from a binary Kalshi market. */
function extractOutcomeLabels(m: any): [string, string] {
  const title: string = m.title || '';

  // "Team A vs Team B" / "Team A vs. Team B" → [TeamA, TeamB]
  const vsMatch = title.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*\?.*)?$/i);
  if (vsMatch) {
    const home = vsMatch[1].trim();
    const away = vsMatch[2].trim().split(/\s+(wins?|to\s+win|winner)/i)[0].trim();
    return [home, away];
  }

  // subtitle "Yes: <label>" from parseMarket
  const sub: string = m.subtitle || '';
  if (sub.startsWith('Yes: ') && sub.length > 5) {
    return [sub.slice(5).trim(), 'No'];
  }

  // Climate/threshold markets — the title IS the range (e.g. "83° to 84°")
  if (/°|\bto\b|\babove\b|\bbelow\b/i.test(title) && title.length < 40) {
    return [title.replace(/\?$/, '').trim(), 'No'];
  }

  return ['Yes', 'No'];
}

/** Infer icon metadata from the market category/subcategory. */
function deriveIconMeta(m: any, sub: string): {
  iconCode?: string;
  iconType?: 'city' | 'avatar' | 'flag' | 'team' | 'brand';
  subcategoryLabel?: string;
  dateLabel?: string;
} {
  const cat = (m.category || '').toLowerCase();
  const title = (m.title || '').toLowerCase();

  if (sub === 'weather' || sub === 'climate' || cat.includes('weather') || cat.includes('climate') || cat.includes('temperature')) {
    const seriesTk: string = m.seriesTicker || '';
    // Kalshi climate tickers: KXHITEMP-AUS-2026MAY24 → city = AUS
    const tkrCity = seriesTk.match(/-([A-Z]{2,4})-/)?.[1];
    // Title: "Highest temperature in Austin today?" → AUS
    const titleCityMap: Record<string, string> = {
      austin: 'AUS', 'san francisco': 'SF', dallas: 'DAL', seattle: 'SEA',
      'los angeles': 'LA', chicago: 'CHI', houston: 'HOU', 'new york': 'NYC',
      miami: 'MIA', phoenix: 'PHX', denver: 'DEN', boston: 'BOS', atlanta: 'ATL',
    };
    let code = tkrCity ?? '';
    if (!code) {
      for (const [city, abbr] of Object.entries(titleCityMap)) {
        if (title.includes(city)) { code = abbr; break; }
      }
    }
    if (!code) code = (seriesTk.slice(0, 3) || 'WX').toUpperCase();
    // Subcategory label from Kalshi climate categories
    const subLabel = title.includes('natural') || title.includes('tornado') || title.includes('hurricane')
      ? 'Natural Disasters'
      : title.includes('hourly') ? 'Hourly Temperature'
      : title.includes('high') ? 'High Temperature'
      : 'Daily Temperature';
    return { iconCode: code, iconType: 'city', subcategoryLabel: subLabel };
  }

  if (sub === 'politics' || sub === 'elections' || sub === 'election' ||
      cat.includes('election') || cat.includes('politic') ||
      title.includes('president') || title.includes('senate') || title.includes('governor') || title.includes('mayor')) {
    // Close date label for elections
    const dateLabel = m.closeTime ? new Date(m.closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' @ 7:30AM' : undefined;
    return { iconType: 'avatar', subcategoryLabel: 'Politics', dateLabel };
  }

  if (sub === 'culture' || sub === 'entertainment' ||
      cat.includes('entertainment') || cat.includes('music') || cat.includes('award') ||
      cat.includes('movie') || cat.includes('film') || cat.includes('oscar')) {
    return { iconType: 'brand', subcategoryLabel: 'Culture' };
  }

  if (sub === 'sports' || sub === 'sport' || cat.includes('nfl') || cat.includes('nba') ||
      cat.includes('mlb') || cat.includes('nhl') || cat.includes('golf') || cat.includes('pga') ||
      cat.includes('soccer') || cat.includes('tennis') || cat.includes('mma') || cat.includes('ufc')) {
    const seriesTk = (m.seriesTicker || '').toUpperCase();
    const sportLabel =
      seriesTk.startsWith('MLB') || seriesTk.startsWith('KXMLB') || cat.includes('mlb') || title.includes('baseball') ? 'Pro Baseball' :
      seriesTk.startsWith('NBA') || seriesTk.startsWith('KXNBA') || cat.includes('nba') || title.includes('basketball') ? 'Pro Basketball' :
      seriesTk.startsWith('NFL') || seriesTk.startsWith('KXNFL') || cat.includes('nfl') || title.includes('football') ? 'Pro Football' :
      seriesTk.startsWith('NHL') || seriesTk.startsWith('KXNHL') || cat.includes('nhl') || title.includes('hockey') ? 'Pro Hockey' :
      seriesTk.startsWith('PGA') || seriesTk.startsWith('KXGOLF') || cat.includes('golf') ? 'Golf' :
      seriesTk.startsWith('KXTENNIS') || cat.includes('tennis') ? 'Tennis' :
      seriesTk.startsWith('KXSOCCER') || cat.includes('soccer') ? 'Soccer' :
      seriesTk.startsWith('KXUFC') || seriesTk.startsWith('UFC') || cat.includes('mma') ? 'MMA' :
      'Sports';
    // Extract sport category code for icon
    const iconCode = sportLabel.replace('Pro ', '').toUpperCase().split(' ')[0];
    return { iconType: 'team', subcategoryLabel: sportLabel, iconCode };
  }

  return {};
}

/** Format volume as Kalshi.com shows it — full dollar amount. */
function fmtVolFull(n: number): string {
  if (n <= 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${n}`;
}

/** Convert a KalshiMarket to KalshiTileData with smart outcome labels and icon metadata. */
function normalizeMarketForTile(m: any, sub = ''): KalshiTileData {
  const yesPct = Math.min(99, Math.max(1, Math.round(m.yesPrice ?? 50)));
  const noPct  = Math.min(99, Math.max(1, Math.round(m.noPrice  ?? (100 - yesPct))));
  const vol    = fmtVolFull(m.volume24h > 0 ? m.volume24h : m.volume ?? 0);
  const iconMeta = deriveIconMeta(m, sub);
  const [yesLabel, noLabel] = extractOutcomeLabels(m);

  return {
    ticker: m.ticker ?? '',
    title: m.title ?? 'Market',
    categoryChip: deriveChip(m),
    outcomes: [
      {
        label: yesLabel,
        yesPct,
        multiplier: yesPct > 0 ? parseFloat((100 / yesPct).toFixed(2)) : 2,
        isLeading: yesPct >= noPct,
      },
      {
        label: noLabel,
        yesPct: noPct,
        multiplier: noPct > 0 ? parseFloat((100 / noPct).toFixed(2)) : 2,
        isLeading: noPct > yesPct,
      },
    ],
    volume: vol,
    marketCount: 1,
    isLive: m.status === 'active',
    liveStatus: (m.status === 'active' || m.status === 'open') && m.subtitle && /^\w+[\s\d]/.test(m.subtitle) ? m.subtitle : undefined,
    eventTicker: m.eventTicker,
    seriesTicker: m.seriesTicker,
    closeTimeIso: m.closeTime || null,
    ...iconMeta,
  };
}

/** Package markets into a single grouped InsightCard for the UI. */
export function kalshiMarketsToGroupedCard(
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
      markets: top.map(m => normalizeMarketForTile(m, subcategory)),
      seriesTicker: top[0]?.seriesTicker ?? '',
    },
    status: 'active',
    realData: true,
  } as InsightCard;
}

function buildKalshiUnavailableCards(_count: number): InsightCard[] {
  return [{
    type: 'kalshi-trending',
    title: 'Kalshi Markets Temporarily Unavailable',
    icon: 'AlertTriangle',
    category: 'KALSHI',
    subcategory: 'Status',
    gradient: 'from-teal-600 to-cyan-700',
    realData: false,
    status: CARD_STATUS.NEUTRAL,
    data: { status: 'API_UNAVAILABLE' },
  } as InsightCard];
}

function buildKalshiNoMarketsCards(): InsightCard[] {
  return [{
    type: 'kalshi-trending',
    title: 'No Active Prediction Markets',
    icon: 'BarChart3',
    category: 'KALSHI',
    subcategory: 'Markets',
    gradient: 'from-teal-600 to-cyan-700',
    realData: false,
    status: CARD_STATUS.NEUTRAL,
    data: { status: 'NO_MARKETS' },
  } as InsightCard];
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
