/**
 * Historical Data Scraping and Pipeline System
 * 
 * Automated scraping of game results from ESPN and sports APIs
 * with backfill capabilities for historical analysis.
 */

export interface GameResult {
  id: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  date: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'final' | 'postponed' | 'cancelled';
  venue?: string;
  attendance?: number;
  weather?: {
    temperature: number;
    condition: string;
    windSpeed: number;
  };
}

export interface HistoricalOdds {
  eventId: string;
  sport: string;
  bookmaker: string;
  marketType: string;
  outcome: string;
  openingLine: number;
  closingLine: number;
  result?: 'win' | 'loss' | 'push';
  timestamp: Date;
}

/**
 * Scrape game results from ESPN API (unofficial)
 */
export async function scrapeESPNResults(
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl',
  date: Date
): Promise<GameResult[]> {
  try {
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    
    // ESPN's unofficial scoreboard API
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/${getSportPath(sport)}/scoreboard?dates=${dateStr}`;
    
    console.log(`[Scraper] Fetching ESPN results for ${sport} on ${dateStr}`);
    
    const response = await fetch(espnUrl);
    if (!response.ok) {
      throw new Error(`ESPN API returned ${response.status}`);
    }

    const data = await response.json();
    
    return parseESPNResponse(data, sport.toUpperCase() as GameResult['sport']);
  } catch (error) {
    console.error('[Scraper] Failed to scrape ESPN results:', error);
    return [];
  }
}

/**
 * Backfill historical data for a date range
 */
export async function backfillHistoricalData(
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl',
  startDate: Date,
  endDate: Date,
  onProgress?: (completed: number, total: number) => void
): Promise<GameResult[]> {
  const results: GameResult[] = [];
  const dates = generateDateRange(startDate, endDate);
  
  console.log(`[Scraper] Backfilling ${dates.length} days of ${sport} data`);
  
  for (let i = 0; i < dates.length; i++) {
    try {
      const dayResults = await scrapeESPNResults(sport, dates[i]);
      results.push(...dayResults);
      
      if (onProgress) {
        onProgress(i + 1, dates.length);
      }
      
      // Rate limiting - wait 1 second between requests
      await sleep(1000);
    } catch (error) {
      console.error(`[Scraper] Failed to fetch ${dates[i]}:`, error);
    }
  }
  
  console.log(`[Scraper] Backfill complete: ${results.length} games`);
  return results;
}

/**
 * Save game results to database
 */
export async function saveGameResults(results: GameResult[]): Promise<void> {
  // This would integrate with Supabase
  console.log(`[Scraper] Saving ${results.length} game results to database`);
  
  // TODO: Implement Supabase bulk insert
  /*
  const { error } = await supabase
    .from('game_results')
    .upsert(results, { onConflict: 'id' });
  
  if (error) {
    throw new Error(`Failed to save results: ${error.message}`);
  }
  */
}

/**
 * Fetch historical odds from The Odds API
 */
export async function fetchHistoricalOdds(
  sport: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalOdds[]> {
  // The Odds API historical endpoint (paid feature)
  const apiKey = process.env.ODDS_API_KEY;
  
  if (!apiKey) {
    console.warn('[Scraper] No Odds API key configured');
    return [];
  }

  try {
    const url = `https://api.the-odds-api.com/v4/historical/sports/${sport}/odds?` +
      `apiKey=${apiKey}` +
      `&regions=us` +
      `&markets=h2h,spreads,totals` +
      `&dateFrom=${startDate.toISOString()}` +
      `&dateTo=${endDate.toISOString()}`;

    console.log('[Scraper] Fetching historical odds');
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Odds API returned ${response.status}`);
    }

    const data = await response.json();
    return parseHistoricalOdds(data);
  } catch (error) {
    console.error('[Scraper] Failed to fetch historical odds:', error);
    return [];
  }
}

/**
 * Calculate hit rates for betting markets
 */
export async function calculateMarketHitRates(
  sport: string,
  season: string
): Promise<{
  market: string;
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number;
  roi: number;
}[]> {
  // This would query the database for historical results + odds
  console.log(`[Analytics] Calculating hit rates for ${sport} ${season}`);
  
  // TODO: Implement database query
  /*
  const { data, error } = await supabase
    .from('historical_odds')
    .select('*, game_results!inner(*)')
    .eq('sport', sport)
    .eq('season', season);
  */
  
  return [];
}

// ============================================
// Helper Functions
// ============================================

function getSportPath(sport: string): string {
  const paths: Record<string, string> = {
    nfl: 'football/nfl',
    nba: 'basketball/nba',
    mlb: 'baseball/mlb',
    nhl: 'hockey/nhl'
  };
  return paths[sport] || sport;
}

function parseESPNResponse(data: any, sport: GameResult['sport']): GameResult[] {
  if (!data.events || !Array.isArray(data.events)) {
    return [];
  }

  return data.events
    .filter((event: any) => event.status?.type?.completed)
    .map((event: any): GameResult => {
      const competition = event.competitions?.[0];
      const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');

      return {
        id: event.id,
        sport,
        date: new Date(event.date),
        homeTeam: homeTeam?.team?.displayName || 'Unknown',
        awayTeam: awayTeam?.team?.displayName || 'Unknown',
        homeScore: parseInt(homeTeam?.score || '0'),
        awayScore: parseInt(awayTeam?.score || '0'),
        status: event.status?.type?.completed ? 'final' : 'postponed',
        venue: competition?.venue?.fullName,
        attendance: competition?.attendance
      };
    });
}

function parseHistoricalOdds(data: any): HistoricalOdds[] {
  // Parse response from The Odds API historical endpoint
  if (!Array.isArray(data)) {
    return [];
  }

  const odds: HistoricalOdds[] = [];

  for (const event of data) {
    for (const bookmaker of event.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        for (const outcome of market.outcomes || []) {
          odds.push({
            eventId: event.id,
            sport: event.sport_key,
            bookmaker: bookmaker.key,
            marketType: market.key,
            outcome: outcome.name,
            openingLine: outcome.price,
            closingLine: outcome.price, // Would need multiple snapshots to get true closing line
            timestamp: new Date(bookmaker.last_update)
          });
        }
      }
    }
  }

  return odds;
}

function generateDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scheduled daily scraper (for Vercel Cron)
 */
export async function dailyResultsScraper() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  console.log('[Scraper] Running daily results scraper');
  
  const sports: Array<'nfl' | 'nba' | 'mlb' | 'nhl'> = ['nfl', 'nba', 'mlb', 'nhl'];
  const allResults: GameResult[] = [];
  
  for (const sport of sports) {
    const results = await scrapeESPNResults(sport, yesterday);
    allResults.push(...results);
  }
  
  if (allResults.length > 0) {
    await saveGameResults(allResults);
    console.log(`[Scraper] Saved ${allResults.length} game results`);
  } else {
    console.log('[Scraper] No games found for yesterday');
  }
  
  return allResults;
}
