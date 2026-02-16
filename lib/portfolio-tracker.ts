/**
 * User Portfolio Tracking System
 * 
 * Track betting history, calculate ROI, and manage user bets
 */

export interface UserBet {
  id: string;
  userId: string;
  eventId: string;
  sport: string;
  betType: 'moneyline' | 'spread' | 'totals' | 'prop';
  selection: string;
  odds: number;
  stake: number;
  potentialWin: number;
  bookmaker: string;
  placedAt: Date;
  settledAt?: Date;
  status: 'pending' | 'won' | 'lost' | 'void' | 'pushed';
  result?: string;
  actualPayout?: number;
}

export interface PortfolioStats {
  totalBets: number;
  pendingBets: number;
  settledBets: number;
  wonBets: number;
  lostBets: number;
  winRate: number;
  totalStaked: number;
  totalReturned: number;
  netProfit: number;
  roi: number;
  averageOdds: number;
  biggestWin: number;
  biggestLoss: number;
  currentStreak: {
    type: 'win' | 'loss';
    count: number;
  };
  byBetType: {
    [key: string]: {
      count: number;
      winRate: number;
      roi: number;
    };
  };
  bySport: {
    [key: string]: {
      count: number;
      winRate: number;
      roi: number;
    };
  };
  byBookmaker: {
    [key: string]: {
      count: number;
      winRate: number;
      roi: number;
    };
  };
}

/**
 * Calculate portfolio statistics
 */
export function calculatePortfolioStats(bets: UserBet[]): PortfolioStats {
  const settledBets = bets.filter(b => b.status !== 'pending');
  const wonBets = bets.filter(b => b.status === 'won');
  const lostBets = bets.filter(b => b.status === 'lost');

  const totalStaked = bets.reduce((sum: number, bet: UserBet) => sum + bet.stake, 0);
  const totalReturned = wonBets.reduce((sum: number, bet: UserBet) => sum + (bet.actualPayout || 0), 0);
  const netProfit = totalReturned - totalStaked;
  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;

  // Calculate current streak
  let currentStreak = { type: 'win' as 'win' | 'loss', count: 0 };
  const recentBets = settledBets.slice().reverse();
  
  if (recentBets.length > 0) {
    const firstStatus = recentBets[0].status;
    currentStreak.type = firstStatus === 'won' ? 'win' : 'loss';
    
    for (const bet of recentBets) {
      if (bet.status === firstStatus) {
        currentStreak.count++;
      } else {
        break;
      }
    }
  }

  // Calculate by bet type
  const byBetType: PortfolioStats['byBetType'] = {};
  for (const betType of ['moneyline', 'spread', 'totals', 'prop']) {
    const typeBets = settledBets.filter(b => b.betType === betType);
    const typeWon = typeBets.filter(b => b.status === 'won');
    const typeStaked = typeBets.reduce((sum, b) => sum + b.stake, 0);
    const typeReturned = typeWon.reduce((sum, b) => sum + (b.actualPayout || 0), 0);
    
    byBetType[betType] = {
      count: typeBets.length,
      winRate: typeBets.length > 0 ? (typeWon.length / typeBets.length) * 100 : 0,
      roi: typeStaked > 0 ? ((typeReturned - typeStaked) / typeStaked) * 100 : 0
    };
  }

  // Calculate by sport
  const sports = [...new Set(bets.map(b => b.sport))];
  const bySport: PortfolioStats['bySport'] = {};
  
  for (const sport of sports) {
    const sportBets = settledBets.filter(b => b.sport === sport);
    const sportWon = sportBets.filter(b => b.status === 'won');
    const sportStaked = sportBets.reduce((sum, b) => sum + b.stake, 0);
    const sportReturned = sportWon.reduce((sum, b) => sum + (b.actualPayout || 0), 0);
    
    bySport[sport] = {
      count: sportBets.length,
      winRate: sportBets.length > 0 ? (sportWon.length / sportBets.length) * 100 : 0,
      roi: sportStaked > 0 ? ((sportReturned - sportStaked) / sportStaked) * 100 : 0
    };
  }

  // Calculate by bookmaker
  const bookmakers = [...new Set(bets.map(b => b.bookmaker))];
  const byBookmaker: PortfolioStats['byBookmaker'] = {};
  
  for (const bookmaker of bookmakers) {
    const bookBets = settledBets.filter(b => b.bookmaker === bookmaker);
    const bookWon = bookBets.filter(b => b.status === 'won');
    const bookStaked = bookBets.reduce((sum, b) => sum + b.stake, 0);
    const bookReturned = bookWon.reduce((sum, b) => sum + (b.actualPayout || 0), 0);
    
    byBookmaker[bookmaker] = {
      count: bookBets.length,
      winRate: bookBets.length > 0 ? (bookWon.length / bookBets.length) * 100 : 0,
      roi: bookStaked > 0 ? ((bookReturned - bookStaked) / bookStaked) * 100 : 0
    };
  }

  return {
    totalBets: bets.length,
    pendingBets: bets.filter(b => b.status === 'pending').length,
    settledBets: settledBets.length,
    wonBets: wonBets.length,
    lostBets: lostBets.length,
    winRate: settledBets.length > 0 ? (wonBets.length / settledBets.length) * 100 : 0,
    totalStaked: Math.round(totalStaked * 100) / 100,
    totalReturned: Math.round(totalReturned * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    averageOdds: bets.length > 0 ? bets.reduce((sum, b) => sum + b.odds, 0) / bets.length : 0,
    biggestWin: wonBets.length > 0 ? Math.max(...wonBets.map(b => (b.actualPayout || 0) - b.stake)) : 0,
    biggestLoss: lostBets.length > 0 ? Math.max(...lostBets.map(b => b.stake)) : 0,
    currentStreak,
    byBetType,
    bySport,
    byBookmaker
  };
}

/**
 * Add a new bet to user's portfolio
 */
export async function addBet(bet: Omit<UserBet, 'id' | 'placedAt'>): Promise<UserBet> {
  const newBet: UserBet = {
    ...bet,
    id: `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    placedAt: new Date()
  };

  // TODO: Save to database
  console.log('[Portfolio] Adding bet:', newBet);

  return newBet;
}

/**
 * Settle a bet (mark as won/lost)
 */
export async function settleBet(
  betId: string,
  status: 'won' | 'lost' | 'void' | 'pushed',
  actualPayout?: number
): Promise<void> {
  console.log('[Portfolio] Settling bet:', { betId, status, actualPayout });

  // TODO: Update in database
}

/**
 * Get user's betting history
 */
export async function getUserBets(userId: string, limit = 100): Promise<UserBet[]> {
  console.log('[Portfolio] Fetching bets for user:', userId);

  // TODO: Query from database
  return [];
}

/**
 * Calculate Kelly Criterion stake recommendation
 */
export function calculateKellyCriterion(
  odds: number,
  winProbability: number,
  bankroll: number,
  fractional: number = 0.25 // Use fractional Kelly for safety
): number {
  const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  const b = decimalOdds - 1; // Net odds received on the wager
  const p = winProbability;
  const q = 1 - p;

  // Kelly formula: f = (bp - q) / b
  const kellyFraction = (b * p - q) / b;

  if (kellyFraction <= 0) {
    return 0; // No edge, don't bet
  }

  // Apply fractional Kelly for safety
  const recommendedStake = bankroll * kellyFraction * fractional;

  return Math.max(0, Math.round(recommendedStake * 100) / 100);
}
