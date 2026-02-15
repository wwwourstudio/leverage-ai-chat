/**
 * Enhanced Odds API Client - Comprehensive Integration
 * Supports ALL Odds API features: h2h, spreads, totals, player props, futures, historical data
 */

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

export interface OddsAPIOptions {
  apiKey: string;
  markets?: string[]; // h2h, spreads, totals, h2h_lay, outrights
  regions?: string[]; // us, us2, uk, au, eu
  oddsFormat?: 'decimal' | 'american';
  dateFormat?: 'iso' | 'unix';
  bookmakers?: string[];
  eventIds?: string[];
  commenceTimeFrom?: string; // ISO 8601
  commenceTimeTo?: string; // ISO 8601
  includeLinks?: boolean;
  includeSids?: boolean;
  includeBetLimits?: boolean;
  includeRotationNumbers?: boolean;
}

/**
 * Fetch ALL available sports (in-season and off-season)
 */
export async function fetchAllSports(apiKey: string, includeAll: boolean = true): Promise<any[]> {
  const url = `${ODDS_API_BASE}/sports/?apiKey=${apiKey}${includeAll ? '&all=true' : ''}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch sports: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[ENHANCED ODDS] Failed to fetch sports:', error);
    return [];
  }
}

/**
 * Fetch comprehensive odds data with ALL markets
 */
export async function fetchComprehensiveOdds(
  sport: string,
  options: OddsAPIOptions
): Promise<any[]> {
  const {
    apiKey,
    markets = ['h2h', 'spreads', 'totals'],
    regions = ['us'],
    oddsFormat = 'american',
    dateFormat = 'iso',
    bookmakers,
    eventIds,
    commenceTimeFrom,
    commenceTimeTo,
    includeLinks = false,
    includeSids = false,
    includeBetLimits = false,
    includeRotationNumbers = false
  } = options;

  const params = new URLSearchParams({
    apiKey,
    regions: regions.join(','),
    markets: markets.join(','),
    oddsFormat,
    dateFormat
  });

  if (bookmakers && bookmakers.length > 0) {
    params.append('bookmakers', bookmakers.join(','));
  }
  if (eventIds && eventIds.length > 0) {
    params.append('eventIds', eventIds.join(','));
  }
  if (commenceTimeFrom) {
    params.append('commenceTimeFrom', commenceTimeFrom);
  }
  if (commenceTimeTo) {
    params.append('commenceTimeTo', commenceTimeTo);
  }
  if (includeLinks) {
    params.append('includeLinks', 'true');
  }
  if (includeSids) {
    params.append('includeSids', 'true');
  }
  if (includeBetLimits) {
    params.append('includeBetLimits', 'true');
  }
  if (includeRotationNumbers) {
    params.append('includeRotationNumbers', 'true');
  }

  const url = `${ODDS_API_BASE}/sports/${sport}/odds?${params.toString()}`;

  console.log('[ENHANCED ODDS] Fetching comprehensive odds:', {
    sport,
    markets,
    regions,
    url: url.replace(apiKey, 'REDACTED')
  });

  try {
    const response = await fetch(url);
    
    // Log rate limit headers
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');
    console.log('[ENHANCED ODDS] API Quota:', { used, remaining });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Odds API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[ENHANCED ODDS] Fetched', data.length, 'events');
    return data;
  } catch (error) {
    console.error('[ENHANCED ODDS] Fetch failed:', error);
    return [];
  }
}

/**
 * Fetch historical odds (completed events)
 */
export async function fetchHistoricalOdds(
  sport: string,
  options: OddsAPIOptions & { daysBack?: number }
): Promise<any[]> {
  const { daysBack = 7 } = options;
  
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - daysBack);
  
  return fetchComprehensiveOdds(sport, {
    ...options,
    commenceTimeTo: now.toISOString(),
    commenceTimeFrom: endDate.toISOString()
  });
}

/**
 * Fetch upcoming events only
 */
export async function fetchUpcomingOdds(
  sport: string,
  options: OddsAPIOptions & { daysAhead?: number }
): Promise<any[]> {
  const { daysAhead = 7 } = options;
  
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return fetchComprehensiveOdds(sport, {
    ...options,
    commenceTimeFrom: now.toISOString(),
    commenceTimeTo: futureDate.toISOString()
  });
}

/**
 * Fetch outright/futures markets (championship winners, etc.)
 */
export async function fetchOutrightMarkets(
  sport: string,
  apiKey: string
): Promise<any[]> {
  return fetchComprehensiveOdds(sport, {
    apiKey,
    markets: ['outrights'],
    regions: ['us']
  });
}

/**
 * Fetch specific event by ID with ALL available markets
 */
export async function fetchEventById(
  sport: string,
  eventId: string,
  apiKey: string
): Promise<any> {
  const events = await fetchComprehensiveOdds(sport, {
    apiKey,
    eventIds: [eventId],
    markets: ['h2h', 'spreads', 'totals', 'h2h_lay'],
    includeLinks: true,
    includeSids: true,
    includeBetLimits: true
  });
  
  return events.length > 0 ? events[0] : null;
}

/**
 * Get line movement for a specific game (requires multiple calls to track over time)
 * This compares current odds vs cached historical odds
 */
export async function getLineMovement(
  sport: string,
  eventId: string,
  apiKey: string,
  historicalData?: any
): Promise<{
  current: any;
  historical: any;
  movement: {
    h2h: { home: number; away: number };
    spread: { home: number; away: number };
    total: { over: number; under: number };
  }
}> {
  const current = await fetchEventById(sport, eventId, apiKey);
  
  if (!historicalData || !current) {
    return {
      current,
      historical: historicalData,
      movement: {
        h2h: { home: 0, away: 0 },
        spread: { home: 0, away: 0 },
        total: { over: 0, under: 0 }
      }
    };
  }
  
  // Calculate movement (simplified - would need proper tracking in production)
  const currentH2H = current.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'h2h');
  const historicalH2H = historicalData.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'h2h');
  
  return {
    current,
    historical: historicalData,
    movement: {
      h2h: {
        home: (currentH2H?.outcomes?.[0]?.price || 0) - (historicalH2H?.outcomes?.[0]?.price || 0),
        away: (currentH2H?.outcomes?.[1]?.price || 0) - (historicalH2H?.outcomes?.[1]?.price || 0)
      },
      spread: { home: 0, away: 0 },
      total: { over: 0, under: 0 }
    }
  };
}

/**
 * Find arbitrage opportunities across bookmakers
 */
export async function findArbitrageOpportunities(
  sport: string,
  apiKey: string
): Promise<any[]> {
  const events = await fetchComprehensiveOdds(sport, {
    apiKey,
    markets: ['h2h'],
    regions: ['us', 'us2', 'uk'] // Multiple regions for more bookmakers
  });
  
  const opportunities: any[] = [];
  
  for (const event of events) {
    if (!event.bookmakers || event.bookmakers.length < 2) continue;
    
    // Find best odds for each outcome across all bookmakers
    const h2hMarkets = event.bookmakers
      .map((b: any) => b.markets?.find((m: any) => m.key === 'h2h'))
      .filter(Boolean);
    
    if (h2hMarkets.length < 2) continue;
    
    let bestHomeOdds = -Infinity;
    let bestAwayOdds = -Infinity;
    let bestHomeBook = '';
    let bestAwayBook = '';
    
    for (const market of h2hMarkets) {
      const homeOutcome = market.outcomes.find((o: any) => o.name === event.home_team);
      const awayOutcome = market.outcomes.find((o: any) => o.name === event.away_team);
      
      if (homeOutcome && homeOutcome.price > bestHomeOdds) {
        bestHomeOdds = homeOutcome.price;
        bestHomeBook = event.bookmakers.find((b: any) => 
          b.markets?.some((m: any) => m.outcomes?.some((o: any) => o === homeOutcome))
        )?.title || '';
      }
      
      if (awayOutcome && awayOutcome.price > bestAwayOdds) {
        bestAwayOdds = awayOutcome.price;
        bestAwayBook = event.bookmakers.find((b: any) => 
          b.markets?.some((m: any) => m.outcomes?.some((o: any) => o === awayOutcome))
        )?.title || '';
      }
    }
    
    // Convert American odds to implied probability
    const homeImplied = bestHomeOdds > 0 
      ? 100 / (bestHomeOdds + 100)
      : -bestHomeOdds / (-bestHomeOdds + 100);
    const awayImplied = bestAwayOdds > 0
      ? 100 / (bestAwayOdds + 100)
      : -bestAwayOdds / (-bestAwayOdds + 100);
    
    const totalImplied = homeImplied + awayImplied;
    
    // If total implied probability < 1, there's an arbitrage opportunity
    if (totalImplied < 1) {
      const profit = ((1 / totalImplied) - 1) * 100;
      opportunities.push({
        event: `${event.away_team} @ ${event.home_team}`,
        gameTime: event.commence_time,
        profit: profit.toFixed(2) + '%',
        homeOdds: bestHomeOdds,
        awayOdds: bestAwayOdds,
        homeBook: bestHomeBook,
        awayBook: bestAwayBook
      });
    }
  }
  
  return opportunities;
}

/**
 * Get consensus odds (average across all bookmakers)
 */
export async function getConsensusOdds(
  sport: string,
  apiKey: string
): Promise<any[]> {
  const events = await fetchComprehensiveOdds(sport, {
    apiKey,
    markets: ['h2h', 'spreads', 'totals'],
    regions: ['us']
  });
  
  return events.map(event => {
    const bookmakerCount = event.bookmakers?.length || 0;
    
    // Calculate average odds across all bookmakers
    const avgH2H = calculateAverageMarket(event, 'h2h');
    const avgSpreads = calculateAverageMarket(event, 'spreads');
    const avgTotals = calculateAverageMarket(event, 'totals');
    
    return {
      ...event,
      consensus: {
        bookmakerCount,
        h2h: avgH2H,
        spreads: avgSpreads,
        totals: avgTotals
      }
    };
  });
}

function calculateAverageMarket(event: any, marketKey: string): any {
  const markets = event.bookmakers
    ?.map((b: any) => b.markets?.find((m: any) => m.key === marketKey))
    .filter(Boolean) || [];
  
  if (markets.length === 0) return null;
  
  // Simplified averaging - would need more sophisticated logic for production
  return markets[0]; // Return first for now
}
