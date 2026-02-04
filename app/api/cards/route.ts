import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface CardRequest {
  sport?: string;
  category?: string;
  userContext?: {
    previousQueries?: string[];
    preferences?: string[];
  };
  limit?: number;
}

/**
 * Dynamic Card Generation API
 * Generates insight cards based on real odds data and AI analysis
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Dynamic cards generation started');
    const body: CardRequest = await req.json();
    const { sport, category, userContext, limit = 3 } = body;

    const oddsApiKey = process.env.ODDS_API_KEY;
    
    // Fetch real odds data if available
    let liveOddsData = null;
    if (oddsApiKey && sport) {
      try {
        const sportKey = mapSportToApiKey(sport);
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${oddsApiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
        
        const oddsResponse = await fetch(oddsUrl);
        if (oddsResponse.ok) {
          liveOddsData = await oddsResponse.json();
          console.log('[API] Fetched live odds:', liveOddsData?.length || 0, 'events');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('[API] Error fetching odds for cards:', errorMessage);
      }
    }

    // Generate cards based on category and available data
    const cards = await generateDynamicCards({
      category,
      sport,
      oddsData: liveOddsData,
      userContext,
      limit
    });

    return NextResponse.json({
      success: true,
      cards,
      dataSource: oddsApiKey ? 'live' : 'simulated',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('[API] Error in cards route:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage,
      cards: [] // Return empty array on error
    });
  }
}

function mapSportToApiKey(sport: string): string {
  const sportMap: Record<string, string> = {
    'nba': 'basketball_nba',
    'nfl': 'americanfootball_nfl',
    'mlb': 'baseball_mlb',
    'nhl': 'icehockey_nhl',
    'ncaab': 'basketball_ncaab',
    'ncaaf': 'americanfootball_ncaaf',
  };
  return sportMap[sport?.toLowerCase()] || 'upcoming';
}

async function generateDynamicCards(params: {
  category?: string;
  sport?: string;
  oddsData?: any;
  userContext?: any;
  limit: number;
}) {
  const { category, sport, oddsData, limit } = params;
  const cards: any[] = [];

  // Generate betting cards from live odds
  if (oddsData && Array.isArray(oddsData) && oddsData.length > 0) {
    const events = oddsData.slice(0, limit);
    
    for (const event of events) {
      if (!event.bookmakers || event.bookmakers.length === 0) continue;

      const bookmaker = event.bookmakers[0];
      const markets = bookmaker.markets || [];

      // Find spread and h2h markets
      const spreadMarket = markets.find((m: any) => m.key === 'spreads');
      const h2hMarket = markets.find((m: any) => m.key === 'h2h');
      
      if (spreadMarket && spreadMarket.outcomes && spreadMarket.outcomes.length >= 2) {
        const outcome = spreadMarket.outcomes[0];
        const homeTeam = event.home_team;
        const awayTeam = event.away_team;
        
        // Calculate edge based on implied probability differences
        const impliedProb = calculateImpliedProbability(outcome.price);
        const marketEfficiency = calculateMarketEfficiency(event.bookmakers);
        const edge = marketEfficiency > 0 ? `+${marketEfficiency.toFixed(1)}%` : `${marketEfficiency.toFixed(1)}%`;
        
        cards.push({
          type: 'live-odds',
          title: 'Live Odds Analysis',
          icon: 'Zap',
          category: sport?.toUpperCase() || 'BETTING',
          subcategory: 'Live Market',
          gradient: 'from-orange-500 to-red-600',
          data: {
            matchup: `${homeTeam} vs ${awayTeam}`,
            bestLine: `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point} (${outcome.price > 0 ? '+' : ''}${outcome.price})`,
            book: bookmaker.title,
            edge: edge,
            movement: detectLineMovement(event),
            confidence: Math.round(impliedProb * 100),
            gameTime: event.commence_time
          },
          status: marketEfficiency > 2 ? 'hot' : 'value',
          realData: true
        });
      }

      // Add player prop if H2H market exists
      if (h2hMarket && h2hMarket.outcomes && h2hMarket.outcomes.length >= 2) {
        const favoriteOutcome = h2hMarket.outcomes.reduce((prev: any, current: any) => 
          current.price < prev.price ? current : prev
        );
        
        cards.push({
          type: 'moneyline-value',
          title: 'Moneyline Opportunity',
          icon: 'Target',
          category: sport?.toUpperCase() || 'BETTING',
          subcategory: 'Moneyline',
          gradient: 'from-purple-500 to-pink-600',
          data: {
            team: favoriteOutcome.name,
            line: `${favoriteOutcome.price > 0 ? '+' : ''}${favoriteOutcome.price}`,
            impliedWin: `${(calculateImpliedProbability(favoriteOutcome.price) * 100).toFixed(1)}%`,
            book: bookmaker.title,
            recommendation: favoriteOutcome.price < -200 ? 'Strong favorite' : 'Competitive matchup'
          },
          status: 'value',
          realData: true
        });
      }
    }
  }

  // If no live data or need more cards, generate contextual recommendations
  if (cards.length < limit) {
    cards.push(...generateContextualCards(category, sport, limit - cards.length));
  }

  return cards.slice(0, limit);
}

function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

function calculateMarketEfficiency(bookmakers: any[]): number {
  if (bookmakers.length < 2) return 0;
  
  // Compare odds across bookmakers to find inefficiencies
  const allOdds = bookmakers.flatMap(b => 
    b.markets?.flatMap((m: any) => 
      m.outcomes?.map((o: any) => o.price) || []
    ) || []
  );
  
  if (allOdds.length === 0) return 0;
  
  const variance = calculateVariance(allOdds);
  // Higher variance = more inefficiency = more edge opportunity
  return variance * 2; // Scale to percentage
}

function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length);
}

function detectLineMovement(event: any): string {
  // In a real implementation, we'd compare with historical data
  // For now, provide a placeholder that encourages real data integration
  const bookmakers = event.bookmakers || [];
  if (bookmakers.length > 1) {
    return '→ Stable across books';
  }
  return '→ Monitor for movement';
}

function generateContextualCards(category?: string, sport?: string, count: number = 3): any[] {
  const cards: any[] = [];
  
  // DFS contextual card
  if (category === 'dfs' || !category) {
    cards.push({
      type: 'dfs-strategy',
      title: 'DFS Strategy Insight',
      icon: 'Award',
      category: sport?.toUpperCase() || 'DFS',
      subcategory: 'Lineup Building',
      gradient: 'from-green-500 to-emerald-600',
      data: {
        focus: 'Value identification in today\'s slate',
        approach: 'Target game environments with high totals',
        strategy: 'Leverage ownership discrepancies',
        recommendation: 'Stack correlated plays in GPPs'
      },
      status: 'optimal',
      realData: false
    });
  }

  // Fantasy contextual card
  if (category === 'fantasy' || !category) {
    cards.push({
      type: 'fantasy-insight',
      title: 'Draft Strategy',
      icon: 'TrendingUp',
      category: 'FANTASY',
      subcategory: 'Value Targets',
      gradient: 'from-green-600 to-teal-600',
      data: {
        focus: 'ADP inefficiencies in current market',
        approach: 'Target players with usage trajectory',
        timing: 'Mid-rounds offer best value',
        recommendation: 'Monitor news for injury replacements'
      },
      status: 'target',
      realData: false
    });
  }

  // Kalshi contextual card
  if (category === 'kalshi' || !category) {
    cards.push({
      type: 'kalshi-insight',
      title: 'Prediction Market Analysis',
      icon: 'BarChart3',
      category: 'KALSHI',
      subcategory: 'Market Opportunities',
      gradient: 'from-cyan-500 to-blue-600',
      data: {
        focus: 'Event-based market inefficiencies',
        approach: 'Cross-reference with betting markets',
        edge: 'Arbitrage opportunities available',
        recommendation: 'Monitor for pricing discrepancies'
      },
      status: 'opportunity',
      realData: false
    });
  }

  return cards.slice(0, count);
}
