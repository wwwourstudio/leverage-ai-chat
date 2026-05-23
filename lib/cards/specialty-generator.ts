/**
 * Specialty card generators for self-contained categories:
 * arbitrage, ev, sharp, pitcher-fatigue, bullpen, weather, portfolio/kelly, lines
 *
 * Each exported function either returns InsightCard[] (category matched) or null (not handled).
 */

import { CARD_TYPES, CARD_STATUS } from '@/lib/constants';
import type { CardData } from '@/lib/types';

type InsightCard = CardData;

// ── Arbitrage ─────────────────────────────────────────────────────────────────

export async function generateArbitrageCards(
  normalizedSport: string | undefined,
  count: number,
): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  try {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data: opportunities } = await supabase
      .from('arbitrage_opportunities')
      .select('*')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('profit_margin', { ascending: false })
      .limit(count);

    if (opportunities && opportunities.length > 0) {
      opportunities.forEach((opp: any) => {
        cards.push({
          type: CARD_TYPES.ARBITRAGE_OPPORTUNITY,
          title: `${opp.away_team} @ ${opp.home_team}`,
          icon: 'DollarSign',
          category: 'ARBITRAGE',
          subcategory: `${(opp.profit_margin * 100).toFixed(2)}% Profit`,
          gradient: 'from-emerald-600 to-green-700',
          status: 'hot',
          data: {
            matchup: `${opp.away_team} @ ${opp.home_team}`,
            profitMargin: `${(opp.profit_margin * 100).toFixed(2)}%`,
            totalStake: `$${opp.total_stake.toFixed(2)}`,
            potentialProfit: `$${(opp.total_stake * opp.profit_margin).toFixed(2)}`,
            side1: { bookmaker: opp.bookmaker_1, odds: opp.odds_1 > 0 ? `+${opp.odds_1}` : opp.odds_1, stake: `$${opp.stake_1.toFixed(2)}` },
            side2: { bookmaker: opp.bookmaker_2, odds: opp.odds_2 > 0 ? `+${opp.odds_2}` : opp.odds_2, stake: `$${opp.stake_2.toFixed(2)}` },
            expiresIn: Math.round((new Date(opp.expires_at).getTime() - Date.now()) / 60000) + ' min',
            realData: true,
            status: 'ACTIVE',
          },
          metadata: { realData: true, dataSource: 'Supabase Arbitrage Detector', timestamp: opp.detected_at },
        } as any);
      });
      return cards;
    }
  } catch { /* fall through to placeholder */ }

  cards.push({
    type: CARD_TYPES.ARBITRAGE_OPPORTUNITY,
    title: 'Arbitrage Scanner',
    icon: 'DollarSign',
    category: 'ARBITRAGE',
    subcategory: 'Scanning',
    gradient: 'from-emerald-600 to-green-700',
    status: CARD_STATUS.NEUTRAL,
    data: {
      description: 'Continuously scanning for risk-free profit opportunities',
      note: 'No arbitrage opportunities currently available',
      checkingMarkets: 'Monitoring all sportsbooks in real-time',
      realData: true,
      status: 'SCANNING',
    },
  } as any);
  return cards;
}

// ── Expected Value (EV) ───────────────────────────────────────────────────────

export async function generateEVCards(
  normalizedSport: string | undefined,
  count: number,
): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  try {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data: preds } = await supabase
      .from('model_predictions')
      .select('*')
      .gt('expected_value', 0.05)
      .order('expected_value', { ascending: false })
      .limit(count);

    if (preds && preds.length > 0) {
      for (const pred of preds) {
        const ev: number = pred.expected_value;
        const conf: 'high' | 'medium' | 'low' = ev >= 0.10 ? 'high' : ev >= 0.05 ? 'medium' : 'low';
        cards.push({
          type: CARD_TYPES.EV_BET,
          title: pred.outcome ? `${pred.market} — ${pred.outcome}` : pred.market,
          icon: 'TrendingUp',
          category: 'EV BETTING',
          subcategory: `${(ev * 100).toFixed(1)}% Edge`,
          gradient: 'from-emerald-600 to-teal-700',
          status: conf === 'high' ? 'hot' : 'value',
          data: {
            market: pred.market,
            outcome: pred.outcome,
            bookmaker: pred.bookmaker ?? 'best book',
            americanOdds: pred.best_price,
            evPercent: `${(ev * 100).toFixed(1)}%`,
            modelProbability: pred.model_probability,
            impliedProbability: pred.model_probability - ev / (pred.best_price > 0 ? pred.best_price / 100 + 1 : 100 / Math.abs(pred.best_price) + 1),
            quarterKelly: pred.kelly_fraction ? pred.kelly_fraction * 0.25 : null,
            confidence: conf,
            realData: true,
          },
        } as any);
      }
      return cards;
    }
  } catch { /* fall through */ }

  cards.push({
    type: CARD_TYPES.EV_BET,
    title: 'Expected Value Scanner',
    icon: 'TrendingUp',
    category: 'EV BETTING',
    subcategory: 'No Edges Found',
    gradient: 'from-emerald-600 to-teal-700',
    status: 'neutral',
    realData: false,
    data: {
      description: 'Scanning sportsbooks for positive expected value bets',
      note: 'EV edges appear as odds diverge from model predictions. Check back as lines move.',
      realData: false,
    },
  } as any);
  return cards;
}

// ── Sharp Money / Steam ───────────────────────────────────────────────────────

export async function generateSharpCards(count: number): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  try {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const sinceTs = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: moves } = await supabase
      .from('line_movement')
      .select('*')
      .gte('created_at', sinceTs)
      .order('created_at', { ascending: false })
      .limit(count * 3);

    if (moves && moves.length > 0) {
      const sharp = moves.filter((m: any) => Math.abs(m.price_change ?? 0) >= 15);
      const source = sharp.length > 0 ? sharp : moves;
      for (const mv of source.slice(0, count)) {
        const change: number = mv.price_change ?? 0;
        const isShort = change < 0;
        cards.push({
          type: CARD_TYPES.SHARP_MONEY,
          title: mv.player_name ?? mv.game_id ?? 'Line Movement',
          icon: 'Activity',
          category: 'SHARP MONEY',
          subcategory: Math.abs(change) >= 15 ? 'Steam Move' : 'Line Movement',
          gradient: isShort ? 'from-red-700 to-rose-900' : 'from-blue-600 to-indigo-800',
          status: Math.abs(change) >= 15 ? 'alert' : 'neutral',
          data: {
            market: mv.market,
            openPrice: mv.opening_price,
            currentPrice: mv.current_price,
            movement: Math.abs(change).toString(),
            direction: isShort ? 'shortening' : 'lengthening',
            isSharp: Math.abs(change) >= 15,
            bookmaker: mv.bookmaker,
            timestamp: new Date(mv.created_at).toLocaleTimeString(),
            realData: true,
          },
        } as any);
      }
      return cards;
    }
  } catch { /* fall through */ }

  cards.push({
    type: CARD_TYPES.SHARP_MONEY,
    title: 'Sharp Money Tracker',
    icon: 'Activity',
    category: 'SHARP MONEY',
    subcategory: 'No Steam Moves',
    gradient: 'from-blue-600 to-indigo-800',
    status: 'neutral',
    realData: false,
    data: {
      description: 'Monitoring sportsbooks for sharp money and steam moves',
      note: 'No significant line movements in the last 30 minutes',
      realData: false,
    },
  } as any);
  return cards;
}

// ── Line Movement (standalone category) ──────────────────────────────────────

export async function generateLineMovementCards(count: number): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  try {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: movements } = await supabase
      .from('line_movement')
      .select('*')
      .gt('updated_at', oneDayAgo)
      .order('updated_at', { ascending: false })
      .limit(count * 3);

    if (movements && movements.length > 0) {
      const gameMovements = new Map<string, any>();
      movements.forEach((move: any) => {
        const key = `${move.away_team}_${move.home_team}`;
        if (!gameMovements.has(key) || Math.abs(move.line_change || 0) > Math.abs(gameMovements.get(key).line_change || 0)) {
          gameMovements.set(key, move);
        }
      });

      for (const move of Array.from(gameMovements.values()).slice(0, count)) {
        const lineChange = move.line_change || 0;
        const direction = lineChange > 0 ? 'UP' : 'DOWN';
        const isSteam = Math.abs(lineChange) > 2;
        cards.push({
          type: CARD_TYPES.LINE_MOVEMENT,
          title: `${move.away_team} @ ${move.home_team}`,
          icon: isSteam ? 'TrendingUp' : 'Activity',
          category: 'LINE MOVEMENT',
          subcategory: isSteam ? `STEAM ${direction}` : `${direction} ${Math.abs(lineChange).toFixed(1)} pts`,
          gradient: isSteam ? 'from-red-600 to-orange-600' : 'from-blue-600 to-indigo-600',
          status: isSteam ? 'hot' : 'edge',
          data: {
            matchup: `${move.away_team} @ ${move.home_team}`,
            lineChange: `${lineChange > 0 ? '+' : ''}${lineChange.toFixed(1)} points`,
            oldLine: move.old_line ? `${move.old_line > 0 ? '+' : ''}${move.old_line}` : 'N/A',
            newLine: move.new_line ? `${move.new_line > 0 ? '+' : ''}${move.new_line}` : 'N/A',
            bookmaker: move.bookmaker || 'Multiple Books',
            timestamp: new Date(move.updated_at).toLocaleString(),
            isSteamMove: isSteam,
            direction,
            sharpMoney: isSteam ? `Heavy ${direction === 'UP' ? 'home' : 'away'} action` : 'Moderate movement',
            realData: true,
            status: isSteam ? 'STEAM' : 'MOVEMENT',
          },
        } as any);
      }
      return cards;
    }
  } catch { /* fall through */ }

  cards.push({
    type: CARD_TYPES.LINE_MOVEMENT,
    title: 'Line Movement Tracker',
    icon: 'Activity',
    category: 'LINE MOVEMENT',
    subcategory: 'No Recent Moves',
    gradient: 'from-blue-600 to-indigo-600',
    status: 'neutral',
    realData: false,
    data: { description: 'No significant line movements in the past 24 hours', realData: false },
  } as any);
  return cards;
}

// ── Portfolio / Kelly ─────────────────────────────────────────────────────────

export async function generatePortfolioCards(count: number): Promise<InsightCard[]> {
  const cards: InsightCard[] = [];
  try {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data: capitalState } = await supabase
      .from('capital_state')
      .select('*')
      .eq('active', true)
      .maybeSingle();

    if (capitalState) {
      const { data: allocations } = await supabase
        .from('bet_allocations')
        .select('*')
        .in('status', ['pending', 'placed'])
        .order('allocated_capital', { ascending: false })
        .limit(count);

      const totalAllocated = allocations?.reduce((sum: number, bet: any) => sum + bet.allocated_capital, 0) || 0;
      const utilization = (totalAllocated / capitalState.total_capital) * 100;

      cards.push({
        type: CARD_TYPES.PORTFOLIO,
        title: 'Portfolio Overview',
        icon: 'Wallet',
        category: 'PORTFOLIO',
        subcategory: `${utilization.toFixed(1)}% Deployed`,
        gradient: 'from-purple-600 to-pink-600',
        status: utilization > 80 ? 'hot' : utilization > 50 ? 'value' : 'neutral',
        data: {
          totalBankroll: `$${capitalState.total_capital.toFixed(2)}`,
          deployed: `$${totalAllocated.toFixed(2)}`,
          available: `$${(capitalState.total_capital - totalAllocated).toFixed(2)}`,
          utilizationRate: `${utilization.toFixed(1)}%`,
          riskBudget: `${(capitalState.risk_budget * 100).toFixed(0)}%`,
          kellyScale: `${(capitalState.kelly_scale * 100).toFixed(0)}% (${capitalState.kelly_scale === 0.25 ? 'Quarter Kelly' : capitalState.kelly_scale === 0.5 ? 'Half Kelly' : 'Custom'})`,
          maxSinglePosition: `${(capitalState.max_single_position * 100).toFixed(0)}%`,
          activeBets: allocations?.length || 0,
          realData: true,
          status: utilization > 80 ? 'HIGH_UTILIZATION' : utilization > 50 ? 'MODERATE' : 'CONSERVATIVE',
        },
        metadata: { realData: true, dataSource: 'Capital State Manager', timestamp: capitalState.updated_at },
      } as any);

      if (allocations && allocations.length > 0) {
        for (const bet of allocations.slice(0, Math.min(2, count - 1))) {
          const kellyFrac = bet.kelly_fraction ?? 0;
          const edgeVal = bet.edge ?? 0;
          const confVal = bet.confidence_score ?? 0;
          const capital = bet.allocated_capital ?? 0;
          const kellyPct = (kellyFrac * 100).toFixed(2);
          cards.push({
            type: CARD_TYPES.KELLY_BET,
            title: bet.matchup || 'Bet Allocation',
            icon: 'Target',
            category: 'KELLY SIZING',
            subcategory: `${kellyPct}% Kelly`,
            gradient: 'from-indigo-600 to-purple-600',
            data: {
              matchup: bet.matchup,
              sport: bet.sport?.toUpperCase(),
              edge: `${(edgeVal * 100).toFixed(2)}%`,
              confidence: `${(confVal * 100).toFixed(0)}%`,
              kellyFraction: `${kellyPct}%`,
              recommendedStake: capital > 0 ? `$${capital.toFixed(2)}` : '—',
              expectedValue: capital > 0 && edgeVal > 0 ? `$${(capital * edgeVal).toFixed(2)}` : '—',
              status: bet.status?.toUpperCase(),
              realData: true,
            },
            metadata: { realData: true, dataSource: 'Capital Allocator', timestamp: bet.created_at },
          } as any);
        }
      }
      return cards;
    }
  } catch { /* fall through to placeholder */ }

  cards.push({
    type: CARD_TYPES.PORTFOLIO,
    title: 'Portfolio Manager',
    icon: 'Wallet',
    category: 'PORTFOLIO',
    subcategory: 'Kelly Criterion',
    gradient: 'from-purple-600 to-pink-600',
    status: 'alert',
    data: {
      description: 'Optimal bet sizing using Kelly Criterion with fractional scaling',
      features: ['Risk Management', 'Capital Allocation', 'Bankroll Protection'],
      note: 'Initialize capital state to start tracking',
      realData: false,
      status: 'SETUP_REQUIRED',
    },
  } as any);
  return cards;
}
