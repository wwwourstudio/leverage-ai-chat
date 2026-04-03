/**
 * Betting Edges Adapter
 * Converts HR/K projections into StatcastCard `hr_prop_card` compatible data
 * with fair odds vs market odds comparison.
 *
 * Market odds are sourced from the live Odds API `batter_home_runs` market via
 * hr-prop-market.ts. Each fetch also records snapshots to line-movement-tracker
 * so that future requests can detect sharp money signals.
 * Falls back to a barrel-rate heuristic when live odds are unavailable.
 */

import { runProjectionPipeline, type MLBProjectionCardData } from './projection-pipeline';
import {
  fetchHRPropMarketLines,
  lookupHRPropOdds,
  type HRPropMarketLine,
} from './hr-prop-market';
import { getOddsApiKey } from '@/lib/config';

export interface BettingEdgeCardData {
  type: 'hr_prop_card';
  title: string;
  category: 'MLB';
  subcategory: string;
  gradient: string;
  status: string;
  realData: boolean;
  summary_metrics: Array<{ label: string; value: string }>;
  lightbox: { sections: Array<{ title: string; metrics: Array<{ label: string; value: string }> }> };
  trend_note: string;
  last_updated: string;
}

/**
 * Build hr_prop_card / pitch_analysis_card betting edge cards from projections.
 * These render via the existing StatcastCard component — no new component needed.
 */
export async function buildBettingEdgeCards(opts: { limit?: number; date?: string } = {}): Promise<BettingEdgeCardData[]> {
  const { limit = 6 } = opts;

  // Fetch projections and live HR prop market odds in parallel
  const apiKey = getOddsApiKey();
  const [projections, propLines] = await Promise.all([
    runProjectionPipeline({ playerType: 'hitter', limit: limit * 2, date: opts.date }),
    apiKey
      ? fetchHRPropMarketLines(apiKey).catch(() => new Map<string, HRPropMarketLine>())
      : Promise.resolve(new Map<string, HRPropMarketLine>()),
  ]);

  // Filter to players with meaningful HR upside
  const edgePlayers = projections
    .filter(p => p.projections.hr_proj > 0.05)
    .sort((a, b) => b.projections.hr_proj - a.projections.hr_proj)
    .slice(0, limit);

  return edgePlayers.map(proj => buildHRPropCard(proj, propLines));
}

/**
 * Build K prop edge cards for starting pitchers.
 */
export async function buildKPropEdgeCards(opts: { limit?: number; date?: string } = {}): Promise<BettingEdgeCardData[]> {
  const { limit = 4 } = opts;

  const projections = await runProjectionPipeline({
    playerType: 'pitcher',
    limit: limit * 2,
    date: opts.date,
  });

  return projections
    .filter(p => p.projections.k_proj > 0)
    .sort((a, b) => b.projections.k_proj - a.projections.k_proj)
    .slice(0, limit)
    .map(proj => buildKPropCard(proj));
}

// ─── HR prop card ──────────────────────────────────────────────────────────────

function buildHRPropCard(
  proj: MLBProjectionCardData,
  propLines?: Map<string, HRPropMarketLine>,
): BettingEdgeCardData {
  const hrProbGame = proj.projections.hr_proj;

  // Fair odds from model probability
  const fairOdds = probToAmericanOdds(hrProbGame);

  // Market odds: use live Odds API data when available, fall back to barrel-rate estimate
  const barrelPct = parseFloat(proj.summary_metrics.find(m => m.label === 'Barrel Rate')?.value ?? '8') || 8;
  const liveLine  = propLines ? lookupHRPropOdds(propLines, proj.player_name) : null;
  const isLiveOdds = !!liveLine;
  const marketImpliedProb = liveLine
    ? liveLine.impliedProb
    : Math.max(0.06, Math.min(0.18, barrelPct * 0.006 + 0.025));
  const marketOdds = liveLine ? liveLine.overOdds : probToAmericanOdds(marketImpliedProb);

  const edge = hrProbGame - marketImpliedProb;
  const edgePct = +(edge * 100).toFixed(1);
  // Quarter-Kelly, capped at 2%
  const kelly = edge > 0
    ? +Math.min(2.0, (edge / (1 - marketImpliedProb)) * 25).toFixed(2)
    : 0;

  const status = edgePct >= 6 ? 'hot' : edgePct >= 3 ? 'edge' : edgePct >= 1 ? 'value' : 'neutral';

  return {
    type: 'hr_prop_card',
    title: `${proj.player_name} — HR Prop Edge`,
    category: 'MLB',
    subcategory: 'HR Props',
    gradient: 'from-indigo-600/80 via-violet-700/60 to-indigo-900/40',
    status,
    realData: true,
    summary_metrics: [
      { label: 'HR Probability', value: `${(hrProbGame * 100).toFixed(1)}%` },
      { label: 'Fair Odds',      value: formatAmericanOdds(fairOdds) },
      { label: 'Market Odds',    value: formatAmericanOdds(marketOdds) },
      { label: 'Edge',           value: `${edgePct >= 0 ? '+' : ''}${edgePct}%` },
      { label: 'Kelly Fraction', value: `${kelly}%` },
      { label: 'Barrel Rate',    value: proj.summary_metrics.find(m => m.label === 'Barrel Rate')?.value ?? '—' },
      { label: 'Exit Velocity',  value: proj.summary_metrics.find(m => m.label === 'Exit Velocity')?.value ?? '—' },
    ],
    lightbox: {
      sections: [
        {
          title: 'Model vs Market',
          metrics: [
            { label: 'Model HR Prob',    value: `${(hrProbGame * 100).toFixed(2)}%` },
            { label: 'Market Implied',   value: `${(marketImpliedProb * 100).toFixed(2)}%` },
            { label: 'Market Source',    value: isLiveOdds ? `Live (${liveLine!.bookmaker})` : 'Estimated' },
            { label: 'Edge',             value: `${edgePct >= 0 ? '+' : ''}${edgePct}%` },
            { label: 'Fair Odds',        value: formatAmericanOdds(fairOdds) },
            { label: 'Kelly (25%)',      value: `${kelly}% bankroll` },
          ],
        },
        {
          title: 'Statcast Power Profile',
          metrics: proj.lightbox.sections[1]?.metrics ?? [],
        },
        {
          title: 'Monte Carlo Percentiles',
          metrics: [
            { label: 'P10 (no HR)',    value: `${proj.percentiles.p10} HR` },
            { label: 'P50 (median)',   value: `${proj.percentiles.p50} HR` },
            { label: 'P90 (ceiling)',  value: `${proj.percentiles.p90} HR` },
            { label: 'Park Factor',    value: proj.summary_metrics.find(m => m.label === 'Park Factor')?.value ?? '1.00' },
          ],
        },
      ],
    },
    trend_note: edge > 0
      ? `${proj.player_name} projects ${edgePct}% edge over market — fair odds ${formatAmericanOdds(fairOdds)} vs market ${formatAmericanOdds(marketOdds)}.`
      : `${proj.player_name} at ${(hrProbGame * 100).toFixed(1)}% HR probability — no significant edge detected.`,
    last_updated: `LeverageMetrics Engine — ${new Date().toLocaleDateString()}`,
  };
}

function buildKPropCard(proj: MLBProjectionCardData): BettingEdgeCardData {
  const kProj = proj.projections.k_proj;
  const ksPer9 = proj.summary_metrics.find(m => m.label === 'K/9 Proj')?.value ?? kProj.toFixed(1);

  // Market K line is typically set near pitcher's season K/9 / 9 × expected IP
  const expectedIP = 5.5;
  const marketKLine = Math.round((parseFloat(ksPer9) / 9) * expectedIP * 2) / 2; // Half-unit line
  const fairKLine = +(kProj).toFixed(1);
  const edge = fairKLine - marketKLine;

  return {
    type: 'hr_prop_card', // Reuse hr_prop_card type (StatcastCard handles display)
    title: `${proj.player_name} — K Prop`,
    category: 'MLB',
    subcategory: 'Pitcher K Props',
    gradient: 'from-violet-600/80 via-purple-700/60 to-indigo-900/40',
    status: Math.abs(edge) >= 1.5 ? 'edge' : 'value',
    realData: true,
    summary_metrics: [
      { label: 'K Projection',     value: `${fairKLine}` },
      { label: 'Market Line',      value: `O/U ${marketKLine}` },
      { label: 'Edge',             value: edge >= 0 ? `Over +${edge.toFixed(1)}` : `Under ${edge.toFixed(1)}` },
      { label: 'K/9 Season',       value: ksPer9 },
      { label: 'Breakout Score',   value: `${proj.projections.breakout_score}/100` },
      { label: 'Avg Velocity',     value: proj.summary_metrics.find(m => m.label === 'Avg Velocity')?.value ?? '—' },
    ],
    lightbox: { sections: proj.lightbox.sections },
    trend_note: `${proj.player_name} projects ${fairKLine} Ks vs market line ${marketKLine}. ${edge >= 0 ? 'Over leans' : 'Under leans'} at ${Math.abs(edge).toFixed(1)} K gap.`,
    last_updated: `LeverageMetrics Engine — ${new Date().toLocaleDateString()}`,
  };
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

/** Convert decimal probability to American moneyline odds */
function probToAmericanOdds(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) {
    return Math.round(-(prob / (1 - prob)) * 100);
  }
  return Math.round(((1 - prob) / prob) * 100);
}

function formatAmericanOdds(odds: number): string {
  if (odds === 0) return 'N/A';
  return odds > 0 ? `+${odds}` : `${odds}`;
}
