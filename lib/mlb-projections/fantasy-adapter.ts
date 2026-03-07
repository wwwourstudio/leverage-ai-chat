/**
 * Fantasy Baseball Adapter
 * Converts projections into FantasyCard-compatible data for:
 * - ROS (Rest of Season) projections
 * - Waiver wire recommendations
 * - Streaming pitcher recommendations
 */

import { runProjectionPipeline, type MLBProjectionCardData } from './projection-pipeline';
import { getRemainingGames } from './mlb-stats-api';

export interface FantasyCardData {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  status: string;
  realData: boolean;
  data: {
    player: string;
    team: string;
    position: string;
    value: string;
    tier: string;
    projection: string;
    insight: string;
    rosHR?: string;
    rosK?: string;
    rosValue?: string;
    waiverPriority?: string;
    streamingGrade?: string;
    matchupRating?: string;
    breakoutAlert?: string;
    source: string;
  };
}

/** ROS projection cards for hitters */
export async function buildROSProjectionCards(opts: { limit?: number; date?: string } = {}): Promise<FantasyCardData[]> {
  const { limit = 6 } = opts;
  const remainingGames = getRemainingGames();

  const projections = await runProjectionPipeline({
    playerType: 'hitter',
    limit: limit * 2,
    date: opts.date,
  });

  return projections
    .filter(p => p.projections.hr_proj > 0.03)
    .sort((a, b) => b.projections.hr_proj - a.projections.hr_proj)
    .slice(0, limit)
    .map(proj => buildROSHitterCard(proj, remainingGames));
}

/** Streaming pitcher cards (best SP starts for the week) */
export async function buildStreamingPitcherCards(opts: { limit?: number; date?: string } = {}): Promise<FantasyCardData[]> {
  const { limit = 4 } = opts;

  const projections = await runProjectionPipeline({
    playerType: 'pitcher',
    limit: limit * 2,
    date: opts.date,
  });

  return projections
    .filter(p => p.projections.k_proj > 0)
    .sort((a, b) => {
      // Score: K projection + breakout bonus
      const scoreA = a.projections.k_proj * 2 + a.projections.breakout_score / 25;
      const scoreB = b.projections.k_proj * 2 + b.projections.breakout_score / 25;
      return scoreB - scoreA;
    })
    .slice(0, limit)
    .map(proj => buildStreamingPitcherCard(proj));
}

/** Waiver wire hitter recommendations — targets with strong matchup scores */
export async function buildWaiverCards(opts: { limit?: number; date?: string } = {}): Promise<FantasyCardData[]> {
  const { limit = 5 } = opts;

  const projections = await runProjectionPipeline({
    playerType: 'hitter',
    limit: 20,
    date: opts.date,
  });

  // Waiver wire = players ranked by matchup score who might be less-owned
  return projections
    .filter(p => p.matchup_score >= 0.55)
    .sort((a, b) => b.matchup_score - a.matchup_score)
    .slice(0, limit)
    .map(proj => buildWaiverCard(proj));
}

/** Unified entry point used by cards-generator */
export async function buildFantasyCards(opts: { limit?: number; date?: string } = {}): Promise<FantasyCardData[]> {
  const { limit = 6 } = opts;

  const [ros, streaming] = await Promise.allSettled([
    buildROSProjectionCards({ limit: Math.ceil(limit * 0.6), date: opts.date }),
    buildStreamingPitcherCards({ limit: Math.floor(limit * 0.4), date: opts.date }),
  ]);

  const cards: FantasyCardData[] = [
    ...(ros.status === 'fulfilled' ? ros.value : []),
    ...(streaming.status === 'fulfilled' ? streaming.value : []),
  ];

  return cards.slice(0, limit);
}

// ─── Card builders ────────────────────────────────────────────────────────────

function buildROSHitterCard(proj: MLBProjectionCardData, remainingGames: number): FantasyCardData {
  const rosHR = +(proj.projections.hr_proj * remainingGames).toFixed(0);
  const tier = rosHR >= 20 ? 'Elite' : rosHR >= 12 ? 'Solid' : rosHR >= 7 ? 'Streamer' : 'Bench';

  const barrelPct = proj.summary_metrics.find(m => m.label === 'Barrel Rate')?.value ?? '—';
  const ev        = proj.summary_metrics.find(m => m.label === 'Exit Velocity')?.value ?? '—';

  return {
    type: 'fantasy-insight',
    title: `${proj.player_name} — ROS Outlook`,
    category: 'MLB',
    subcategory: 'ROS Projection',
    gradient: 'from-blue-600/75 via-cyan-900/55 to-slate-900/40',
    status: tier === 'Elite' ? 'hot' : tier === 'Solid' ? 'value' : 'neutral',
    realData: true,
    data: {
      player:       proj.player_name,
      team:         proj.team,
      position:     proj.position,
      value:        `${rosHR} Proj HR`,
      tier,
      projection:   `${proj.projections.hr_proj.toFixed(3)} HR/game`,
      insight:      `${proj.player_name} projects ${rosHR} HRs over ${remainingGames} remaining games. Barrel rate ${barrelPct} at ${ev} avg exit velocity.`,
      rosHR:        `${rosHR}`,
      rosK:         `${+(proj.projections.k_proj * remainingGames).toFixed(0)}`,
      rosValue:     tier,
      matchupRating: `${(proj.matchup_score * 100).toFixed(0)}/100`,
      source:       'LeverageMetrics Engine',
    },
  };
}

function buildStreamingPitcherCard(proj: MLBProjectionCardData): FantasyCardData {
  const kProj = proj.projections.k_proj.toFixed(1);
  const grade = proj.projections.k_proj >= 9 ? 'A' : proj.projections.k_proj >= 7 ? 'B' : 'C';
  const breakout = proj.projections.breakout_score;

  return {
    type: 'fantasy-insight',
    title: `${proj.player_name} — Stream`,
    category: 'MLB',
    subcategory: 'Streaming Pitcher',
    gradient: 'from-violet-600/75 via-purple-900/55 to-slate-900/40',
    status: grade === 'A' || breakout >= 70 ? 'hot' : grade === 'B' ? 'value' : 'neutral',
    realData: true,
    data: {
      player:         proj.player_name,
      team:           proj.team,
      position:       'SP',
      value:          `${kProj} Proj Ks`,
      tier:           `Grade ${grade}`,
      projection:     `${kProj} Ks | Breakout: ${breakout}/100`,
      insight:        `${proj.player_name} is a Grade-${grade} streaming option projecting ${kProj} Ks.${breakout >= 70 ? ` Breakout score ${breakout}/100 — strong upside this start.` : ''}`,
      rosK:           `${proj.projections.k_proj.toFixed(1)} proj/game`,
      streamingGrade: `Grade ${grade}`,
      breakoutAlert:  breakout >= 70 ? `Breakout ${breakout}/100` : undefined,
      matchupRating:  `${(proj.matchup_score * 100).toFixed(0)}/100`,
      source:         'LeverageMetrics Engine',
    },
  };
}

function buildWaiverCard(proj: MLBProjectionCardData): FantasyCardData {
  const priority = proj.matchup_score >= 0.70 ? 'High' : proj.matchup_score >= 0.60 ? 'Medium' : 'Low';

  return {
    type: 'fantasy-insight',
    title: `${proj.player_name} — Waiver Target`,
    category: 'MLB',
    subcategory: 'Waiver Wire',
    gradient: 'from-emerald-600/75 via-teal-900/55 to-slate-900/40',
    status: priority === 'High' ? 'hot' : 'value',
    realData: true,
    data: {
      player:         proj.player_name,
      team:           proj.team,
      position:       proj.position,
      value:          `${(proj.matchup_score * 100).toFixed(0)}/100 Matchup`,
      tier:           `${priority} Priority`,
      projection:     `${(proj.projections.hr_proj * 100).toFixed(1)}% HR prob`,
      insight:        `Matchup score ${(proj.matchup_score * 100).toFixed(0)}/100 — ${priority.toLowerCase()} waiver priority. ${proj.trend_note}`,
      waiverPriority: `${priority} Priority`,
      matchupRating:  `${(proj.matchup_score * 100).toFixed(0)}/100`,
      source:         'LeverageMetrics Engine',
    },
  };
}
