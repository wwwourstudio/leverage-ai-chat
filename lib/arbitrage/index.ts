/**
 * Unified Arbitrage Detection Engine
 * Consolidated from multiple arbitrage modules for better maintainability
 *
 * Identifies risk-free betting opportunities across bookmakers
 */

import {
  americanToImpliedProb,
  americanToDecimal,
} from '@/lib/utils/odds-math';

// Re-export for backward compatibility (tests and price-normalizer import from here)
export { americanToImpliedProb as americanOddsToImpliedProbability, americanToDecimal } from '@/lib/utils/odds-math';

export interface ArbitrageOpportunity {
  sport: string;
  event: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  marketType: 'h2h' | 'spreads' | 'totals';
  
  // Best odds found
  bestHomeOdds: number;
  bestHomeBook: string;
  bestAwayOdds: number;
  bestAwayBook: string;
  
  // Arbitrage calculations
  impliedProbabilities: {
    home: number;
    away: number;
    total: number;
  };
  
  profitPercentage: number;
  stake: number;
  
  // Recommended bets
  bets: {
    team: string;
    book: string;
    odds: number;
    stake: number;
    toWin: number;
  }[];
  
  vigorish: number;
  isArbitrage: boolean;
  confidence: 'high' | 'medium' | 'low';
  allBooks: string[];
}


/**
 * Detect arbitrage in two-sided markets
 * Returns true if total implied probability < 1
 */
export function detectArbitrage(probA: number, probB: number): boolean {
  return probA + probB < 1;
}

/**
 * Calculate optimal bet stakes for arbitrage
 */
export function calculateArbitrageStakes(
  odds1: number,
  odds2: number,
  totalStake: number = 100
): { stake1: number; stake2: number; profit: number; profitPercentage: number } {
  const decimal1 = americanToDecimal(odds1);
  const decimal2 = americanToDecimal(odds2);
  
  // Calculate individual stakes
  const stake1 = totalStake / (1 + (decimal1 / decimal2));
  const stake2 = totalStake - stake1;
  
  // Calculate returns
  const return1 = stake1 * decimal1;
  const return2 = stake2 * decimal2;
  
  // Profit is return minus total stake
  const profit = Math.min(return1, return2) - totalStake;
  const profitPercentage = (profit / totalStake) * 100;
  
  return {
    stake1: Math.round(stake1 * 100) / 100,
    stake2: Math.round(stake2 * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    profitPercentage: Math.round(profitPercentage * 100) / 100
  };
}

/**
 * Calculate arbitrage opportunity from two odds
 */
export function calculateArbitrage(
  odds1: number,
  odds2: number,
  totalStake: number = 100
): ArbitrageOpportunity | null {
  const decimal1 = americanToDecimal(odds1);
  const decimal2 = americanToDecimal(odds2);
  
  // Calculate implied probabilities
  const prob1 = 1 / decimal1;
  const prob2 = 1 / decimal2;
  
  // Check for arbitrage
  const totalProb = prob1 + prob2;
  if (totalProb >= 1) {
    return null;
  }
  
  const stakes = calculateArbitrageStakes(odds1, odds2, totalStake);
  
  return {
    sport: 'unknown',
    event: 'two-way',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    gameTime: new Date().toISOString(),
    marketType: 'h2h',
    bestHomeOdds: odds1,
    bestHomeBook: 'Book A',
    bestAwayOdds: odds2,
    bestAwayBook: 'Book B',
    impliedProbabilities: {
      home: Math.round(prob1 * 10000) / 100,
      away: Math.round(prob2 * 10000) / 100,
      total: Math.round(totalProb * 10000) / 100
    },
    profitPercentage: stakes.profitPercentage,
    stake: totalStake,
    bets: [
      {
        team: 'Team A',
        book: 'Book A',
        odds: odds1,
        stake: stakes.stake1,
        toWin: Math.round(stakes.stake1 * decimal1 * 100) / 100
      },
      {
        team: 'Team B',
        book: 'Book B',
        odds: odds2,
        stake: stakes.stake2,
        toWin: Math.round(stakes.stake2 * decimal2 * 100) / 100
      }
    ],
    vigorish: Math.round((totalProb - 1) * 10000) / 100,
    isArbitrage: true,
    confidence: stakes.profitPercentage > 2 ? 'high' : stakes.profitPercentage > 1 ? 'medium' : 'low',
    allBooks: ['Book A', 'Book B']
  };
}

/**
 * Detect arbitrage opportunities in odds data
 */
export function detectArbitrageOpportunities(
  oddsData: any[],
  minProfitThreshold: number = 0.25
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  console.log('[ARBITRAGE] Analyzing', oddsData.length, 'events');
  
  for (const event of oddsData) {
    if (!event.bookmakers || event.bookmakers.length < 2) {
      continue;
    }
    
    // Extract H2H market odds
    const h2hOdds: { [book: string]: { home: number; away: number } } = {};
    
    for (const bookmaker of event.bookmakers) {
      const h2hMarket = bookmaker.markets?.find((m: any) => m.key === 'h2h');
      if (!h2hMarket || !h2hMarket.outcomes || h2hMarket.outcomes.length < 2) {
        continue;
      }
      
      const homeOutcome = h2hMarket.outcomes.find((o: any) => o.name === event.home_team);
      const awayOutcome = h2hMarket.outcomes.find((o: any) => o.name === event.away_team);
      
      if (homeOutcome && awayOutcome) {
        h2hOdds[bookmaker.title] = {
          home: homeOutcome.price,
          away: awayOutcome.price
        };
      }
    }
    
    const bookNames = Object.keys(h2hOdds);
    if (bookNames.length < 2) {
      continue;
    }
    
    // Find best odds for each team
    let bestHomeOdds = -Infinity;
    let bestHomeBook = '';
    let bestAwayOdds = -Infinity;
    let bestAwayBook = '';
    
    for (const [book, odds] of Object.entries(h2hOdds)) {
      if (odds.home > bestHomeOdds) {
        bestHomeOdds = odds.home;
        bestHomeBook = book;
      }
      if (odds.away > bestAwayOdds) {
        bestAwayOdds = odds.away;
        bestAwayBook = book;
      }
    }
    
    // Calculate implied probabilities
    const homeProb = americanToImpliedProb(bestHomeOdds);
    const awayProb = americanToImpliedProb(bestAwayOdds);
    const totalProb = homeProb + awayProb;
    
    // Arbitrage exists when total probability < 1
    const isArbitrage = totalProb < 1;
    
    if (isArbitrage) {
      const profitPercentage = ((1 - totalProb) / totalProb) * 100;
      
      if (profitPercentage >= minProfitThreshold) {
        const stakes = calculateArbitrageStakes(bestHomeOdds, bestAwayOdds, 100);
        
        opportunities.push({
          sport: event.sport_key || 'unknown',
          event: `${event.away_team} @ ${event.home_team}`,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          gameTime: event.commence_time,
          marketType: 'h2h',
          bestHomeOdds,
          bestHomeBook,
          bestAwayOdds,
          bestAwayBook,
          impliedProbabilities: {
            home: Math.round(homeProb * 10000) / 100,
            away: Math.round(awayProb * 10000) / 100,
            total: Math.round(totalProb * 10000) / 100
          },
          profitPercentage: stakes.profitPercentage,
          stake: 100,
          bets: [
            {
              team: event.home_team,
              book: bestHomeBook,
              odds: bestHomeOdds,
              stake: stakes.stake1,
              toWin: Math.round(stakes.stake1 * americanToDecimal(bestHomeOdds) * 100) / 100
            },
            {
              team: event.away_team,
              book: bestAwayBook,
              odds: bestAwayOdds,
              stake: stakes.stake2,
              toWin: Math.round(stakes.stake2 * americanToDecimal(bestAwayOdds) * 100) / 100
            }
          ],
          vigorish: Math.round((totalProb - 1) * 10000) / 100,
          isArbitrage: true,
          confidence: profitPercentage > 2 ? 'high' : profitPercentage > 1 ? 'medium' : 'low',
          allBooks: bookNames
        });
      }
    }
  }
  
  console.log('[ARBITRAGE] Found', opportunities.length, 'opportunities');
  
  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}

/**
 * Calculate Dutch betting (potential profit across all outcomes)
 */
export function calculateDutch(
  odds: number[],
  totalStake: number
): {
  stakes: number[];
  potentialProfit: number;
  profitMargin: number;
} | null {
  const decimalOdds = odds.map(americanToDecimal);
  const totalProb = decimalOdds.reduce((sum, d) => sum + 1 / d, 0);

  if (totalProb >= 1) {
    return null;
  }

  const stakes = decimalOdds.map((d) => totalStake / (d * totalProb));
  const expectedReturn = stakes[0] * decimalOdds[0];
  const potentialProfit = expectedReturn - totalStake;
  const profitMargin = (potentialProfit / totalStake) * 100;

  return {
    stakes,
    potentialProfit,
    profitMargin,
  };
}

/**
 * Convert arbitrage opportunity to card data
 */
export function arbitrageToCard(opp: ArbitrageOpportunity): any {
  const bet1 = opp.bets[0];
  const bet2 = opp.bets[1];
  
  return {
    type: 'ARBITRAGE',
    title: `${opp.profitPercentage.toFixed(2)}% Arbitrage Opportunity`,
    icon: 'TrendingUp',
    category: 'ARBITRAGE',
    subcategory: opp.sport.replace('_', ' ').toUpperCase(),
    gradient: opp.confidence === 'high' 
      ? 'from-green-600 to-emerald-700'
      : opp.confidence === 'medium'
      ? 'from-blue-600 to-cyan-700'
      : 'from-slate-600 to-gray-700',
    data: {
      event: opp.event,
      gameTime: new Date(opp.gameTime).toLocaleString(),
      profit: `${opp.profitPercentage.toFixed(2)}%`,
      profitAmount: `$${Math.round((opp.profitPercentage / 100) * opp.stake * 100) / 100}`,
      totalStake: `$${opp.stake}`,
      bet1: {
        team: bet1.team,
        book: bet1.book,
        odds: bet1.odds > 0 ? `+${bet1.odds}` : `${bet1.odds}`,
        stake: `$${bet1.stake}`,
        toWin: `$${bet1.toWin}`
      },
      bet2: {
        team: bet2.team,
        book: bet2.book,
        odds: bet2.odds > 0 ? `+${bet2.odds}` : `${bet2.odds}`,
        stake: `$${bet2.stake}`,
        toWin: `$${bet2.toWin}`
      },
      confidence: opp.confidence.toUpperCase(),
      efficiency: `${opp.impliedProbabilities.total}%`,
      books: opp.allBooks.join(', '),
      generatedAt: new Date().toISOString(), // Used by ArbitrageCard for 10-min expiry countdown
    }
  };
}

/**
 * Detect arbitrage opportunities from live odds, formatted as insight cards.
 * Replaces the deleted lib/arbitrage-detector.ts module.
 */
export async function detectArbitrageFromContext(sport?: string): Promise<any[]> {
  try {
    const oddsKey = process.env.ODDS_API_KEY;
    if (!oddsKey) {
      return [];
    }

    const sportKey = sport || 'americanfootball_nfl';
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${oddsKey}&regions=us&markets=h2h&bookmakers=draftkings,fanduel,betmgm,caesars,pointsbetus`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    const opportunities = detectArbitrageOpportunities(data);
    if (opportunities.length > 0) {
      return opportunities.slice(0, 3).map(arbitrageToCard);
    }

    // No arbitrage found — return live odds cards as fallback
    return data.slice(0, 3).map((event: any) => {
      const book = event.bookmakers?.[0];
      const h2h = book?.markets?.find((m: any) => m.key === 'h2h');
      const home = h2h?.outcomes?.find((o: any) => o.name === event.home_team);
      const away = h2h?.outcomes?.find((o: any) => o.name === event.away_team);
      return {
        type: 'live-odds',
        title: `${event.away_team} @ ${event.home_team}`,
        icon: 'TrendingUp',
        category: 'LIVE ODDS',
        subcategory: sportKey.split('_').pop()?.toUpperCase() ?? 'SPORTS',
        gradient: 'from-blue-600 to-cyan-700',
        status: 'active',
        data: {
          homeOdds: home?.price > 0 ? `+${home.price}` : `${home?.price ?? 'N/A'}`,
          awayOdds: away?.price > 0 ? `+${away.price}` : `${away?.price ?? 'N/A'}`,
          bookmaker: book?.title ?? 'N/A',
          commenceTime: new Date(event.commence_time).toLocaleString(),
        },
      };
    });
  } catch {
    return [];
  }
}
