/**
 * Arbitrage Detector - Cross-Platform Sports Betting Arbitrage Calculator
 * Detects guaranteed profit opportunities across multiple sportsbooks
 */

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
  
  profitPercentage: number; // Guaranteed profit %
  stake: number; // Total stake amount ($100 default)
  
  // Recommended bets
  bets: {
    team: string;
    book: string;
    odds: number;
    stake: number;
    toWin: number;
  }[];
  
  // Metadata
  vigorish: number; // Bookmaker edge
  isArbitrage: boolean;
  confidence: 'high' | 'medium' | 'low';
  allBooks: string[]; // All books offering this game
}

/**
 * Convert American odds to implied probability
 */
export function americanOddsToImpliedProbability(odds: number): number {
  if (odds > 0) {
    // Positive odds (underdog)
    return 100 / (odds + 100);
  } else {
    // Negative odds (favorite)
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(odds: number): number {
  if (odds > 0) {
    return (odds / 100) + 1;
  } else {
    return (100 / Math.abs(odds)) + 1;
  }
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
  
  // Profit is return minus total stake (should be same for both)
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
 * Detect arbitrage opportunities in odds data
 */
export function detectArbitrageOpportunities(
  oddsData: any[],
  minProfitThreshold: number = 0.5 // Minimum 0.5% profit to consider
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  console.log('[v0] [ARBITRAGE] Analyzing', oddsData.length, 'events for arbitrage opportunities');
  
  for (const event of oddsData) {
    if (!event.bookmakers || event.bookmakers.length < 2) {
      continue; // Need at least 2 bookmakers for arbitrage
    }
    
    // Extract H2H market odds from all bookmakers
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
      continue; // Need at least 2 books with valid odds
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
    const homeProb = americanOddsToImpliedProbability(bestHomeOdds);
    const awayProb = americanOddsToImpliedProbability(bestAwayOdds);
    const totalProb = homeProb + awayProb;
    
    // Arbitrage exists when total probability < 1 (or 100%)
    const isArbitrage = totalProb < 1;
    
    if (isArbitrage) {
      const profitPercentage = ((1 - totalProb) / totalProb) * 100;
      
      // Only include if profit exceeds threshold
      if (profitPercentage >= minProfitThreshold) {
        const stakes = calculateArbitrageStakes(bestHomeOdds, bestAwayOdds, 100);
        
        const opportunity: ArbitrageOpportunity = {
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
        };
        
        opportunities.push(opportunity);
        console.log('[v0] [ARBITRAGE] Found opportunity:', {
          event: opportunity.event,
          profit: `${opportunity.profitPercentage}%`,
          books: [bestHomeBook, bestAwayBook]
        });
      }
    }
  }
  
  console.log('[v0] [ARBITRAGE] Found', opportunities.length, 'arbitrage opportunities');
  
  // Sort by profit percentage (highest first)
  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}

/**
 * Calculate market efficiency (vigorish/hold)
 */
export function calculateMarketEfficiency(odds: number[]): {
  totalImpliedProb: number;
  vigorish: number;
  efficiency: number;
  isArbitrage: boolean;
} {
  const impliedProbs = odds.map(americanOddsToImpliedProbability);
  const totalImpliedProb = impliedProbs.reduce((sum, prob) => sum + prob, 0);
  const vigorish = totalImpliedProb - 1;
  const efficiency = 1 / totalImpliedProb;
  
  return {
    totalImpliedProb: Math.round(totalImpliedProb * 10000) / 100,
    vigorish: Math.round(vigorish * 10000) / 100,
    efficiency: Math.round(efficiency * 10000) / 100,
    isArbitrage: totalImpliedProb < 1
  };
}

/**
 * Format arbitrage opportunity as human-readable text
 */
export function formatArbitrageOpportunity(opp: ArbitrageOpportunity): string {
  const bet1 = opp.bets[0];
  const bet2 = opp.bets[1];
  
  return `
ARBITRAGE OPPORTUNITY - ${opp.profitPercentage}% Guaranteed Profit

Event: ${opp.event}
Game Time: ${new Date(opp.gameTime).toLocaleString()}

Bet 1: ${bet1.team} (${bet1.odds > 0 ? '+' : ''}${bet1.odds})
  Sportsbook: ${bet1.book}
  Stake: $${bet1.stake}
  To Win: $${bet1.toWin}

Bet 2: ${bet2.team} (${bet2.odds > 0 ? '+' : ''}${bet2.odds})
  Sportsbook: ${bet2.book}
  Stake: $${bet2.stake}
  To Win: $${bet2.toWin}

Total Stake: $${opp.stake}
Guaranteed Profit: $${Math.round((opp.profitPercentage / 100) * opp.stake * 100) / 100}
Profit Percentage: ${opp.profitPercentage}%

Market Efficiency: ${opp.impliedProbabilities.total}%
Books Available: ${opp.allBooks.join(', ')}
`.trim();
}

/**
 * Convert arbitrage opportunity to card data
 */
export function arbitrageToCard(opp: ArbitrageOpportunity): any {
  const bet1 = opp.bets[0];
  const bet2 = opp.bets[1];
  
  return {
    type: 'ARBITRAGE',
    title: `${opp.profitPercentage.toFixed(2)}% Guaranteed Profit`,
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
      books: opp.allBooks.join(', ')
    }
  };
}
