/**
 * DFS Adapter — Converts PlayerProjections into DFSCard-compatible data
 *
 * DraftKings MLB scoring:
 * Singles: 3 | Doubles: 5 | Triples: 8 | HR: 10
 * RBI: 2 | Run: 2 | BB: 2 | SB: 5 | K: -0.5
 * Pitcher Out: 0.75 | K: 2 | W: 4 | ER: -2
 */

import { runProjectionPipeline, type MLBProjectionCardData } from './projection-pipeline';

export interface DFSCardData {
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
    salary: string;
    projection: string;       // Projected DK pts
    ownership: string;        // Estimated ownership %
    boomCeiling: string;      // P90 DK pts
    bustFloor: string;        // P10 DK pts
    targetGame: string;
    tips: string;
    matchupScore: string;
    parkFactor: string;
    hrProb: string;
    dkValue: string;          // Pts per $1000 (value score)
    source: string;
  };
}

/**
 * Build DFS-ready cards from the projection pipeline.
 * Returns DFSCard-compatible objects sorted by projected DK pts.
 */
export async function buildDFSCards(opts: { limit?: number; date?: string } = {}): Promise<DFSCardData[]> {
  const { limit = 9 } = opts;

  const projections = await runProjectionPipeline({
    playerType: 'all',
    limit: limit * 2, // Over-fetch to filter and rank
    date: opts.date,
  });

  if (projections.length === 0) return [];

  // Sort by DK pts projection descending
  const sorted = [...projections].sort((a, b) => {
    const aDK = a.summary_metrics.find(m => m.label === 'DK Proj Pts');
    const bDK = b.summary_metrics.find(m => m.label === 'DK Proj Pts');
    return parseFloat(bDK?.value ?? '0') - parseFloat(aDK?.value ?? '0');
  });

  return sorted.slice(0, limit).map(proj => projectionToDFSCard(proj));
}

function projectionToDFSCard(proj: MLBProjectionCardData): DFSCardData {
  const dkPts    = proj.summary_metrics.find(m => m.label === 'DK Proj Pts')?.value ?? '0';
  const dkPtsNum = parseFloat(dkPts) || 0;
  const isHitter = proj.position !== 'SP' && proj.position !== 'RP';

  // Estimated salary from DK pts (calibrated to 2025 DK MLB pricing)
  // Rule of thumb: 1 DK pt ≈ $800 in salary; starters have salary floor ~$7,000
  const estimatedSalary = isHitter
    ? Math.round(Math.max(2800, Math.min(7200, dkPtsNum * 820)) / 100) * 100
    : Math.round(Math.max(6000, Math.min(10500, dkPtsNum * 420)) / 100) * 100;

  // Estimated ownership: top-projected players get higher ownership
  const ownershipBase = isHitter ? (dkPtsNum > 8 ? 28 : dkPtsNum > 6 ? 18 : 10) : (dkPtsNum > 22 ? 32 : 20);
  // Park factor and matchup adjust ownership (favorable matchups = higher ownership)
  const parkFactor = parseFloat(proj.summary_metrics.find(m => m.label === 'Park Factor')?.value ?? '1.0');
  const ownershipAdj = (parkFactor - 1.0) * 10;
  const estimatedOwnership = Math.max(5, Math.min(55, ownershipBase + ownershipAdj + (Math.random() * 6 - 3)));

  // Value score: DK pts / ($salary / 1000) — aim for ≥ 3.5
  const valueScore = estimatedSalary > 0 ? dkPtsNum / (estimatedSalary / 1000) : 0;

  // P10/P90 from lightbox (Monte Carlo)
  const p10Section = proj.lightbox.sections[0]?.metrics;
  const p10DK = p10Section?.find(m => m.label.includes('DK Pts Floor'))?.value ?? '0';
  const p90DK = p10Section?.find(m => m.label.includes('DK Pts Ceiling'))?.value ?? '0';

  const matchupLabel = proj.summary_metrics.find(m => m.label === 'Matchup')?.value ??
    proj.summary_metrics.find(m => m.label === 'K/9 Proj')?.value ?? '—';

  const tip = isHitter
    ? buildHitterTip(proj, parkFactor, valueScore)
    : buildPitcherTip(proj);

  return {
    type: 'dfs-lineup',
    title: `${proj.player_name} — DFS Play`,
    category: 'MLB',
    subcategory: `DK ${proj.position} · ${proj.team}`,
    gradient: proj.gradient,
    status: proj.status === 'hot' ? 'hot' : valueScore >= 3.5 ? 'value' : proj.status === 'edge' ? 'optimal' : 'value',
    realData: true,
    data: {
      player:       proj.player_name,
      team:         proj.team,
      position:     proj.position,
      salary:       `$${estimatedSalary.toLocaleString()}`,
      projection:   dkPtsNum.toFixed(1),
      ownership:    `${estimatedOwnership.toFixed(0)}%`,
      boomCeiling:  p90DK,
      bustFloor:    p10DK,
      targetGame:   '',
      tips:         tip,
      matchupScore: `${(proj.matchup_score * 100).toFixed(0)}/100`,
      parkFactor:   parkFactor.toFixed(2),
      hrProb:       isHitter ? `${(proj.projections.hr_proj * 100).toFixed(1)}%` : '—',
      dkValue:      valueScore.toFixed(2),
      source:       'LeverageMetrics Engine',
    },
  };
}

function buildHitterTip(proj: MLBProjectionCardData, parkFactor: number, valueScore: number): string {
  const tips: string[] = [];
  if (proj.projections.hr_proj > 0.12) tips.push(`Elite HR upside (${(proj.projections.hr_proj * 100).toFixed(0)}%)`);
  if (parkFactor >= 1.10) tips.push('Very HR-friendly park');
  if (proj.matchup_score >= 0.65) tips.push('Strong matchup score');
  if (valueScore >= 3.5) tips.push(`Good value (${valueScore.toFixed(1)} pts/$k)`);
  return tips.join(' · ') || 'LeverageMetrics projection';
}

function buildPitcherTip(proj: MLBProjectionCardData): string {
  const tips: string[] = [];
  if (proj.projections.breakout_score >= 70) tips.push(`Breakout candidate (${proj.projections.breakout_score}/100)`);
  if (proj.projections.k_proj >= 7) tips.push(`High K upside (${proj.projections.k_proj.toFixed(1)} proj Ks)`);
  return tips.join(' · ') || 'LeverageMetrics pitcher projection';
}
