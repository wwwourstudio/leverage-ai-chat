/**
 * Waiver Engine
 *
 * Detects breakout candidates using rolling z-score analysis on
 * usage and efficiency trends. Generates waiver recommendations
 * with FAAB bid suggestions based on positional need, breakout
 * score, and rest-of-season value.
 */

import type { WaiverRecommendation, BreakoutCandidate } from '../types';

// ============================================================================
// Types
// ============================================================================

interface PlayerProjection {
  playerName: string;
  position: string;
  fantasyPoints: number;
  stats: Record<string, number>;
  adp: number;
  week?: number | null;
}

interface RosterEntry {
  playerName: string;
  position: string;
  rosterSlot: string;
}

// ============================================================================
// Breakout Detection
// ============================================================================

export function detectBreakoutCandidates(
  projections: PlayerProjection[],
  currentWeek: number,
  rollingWindow: number = 3,
  zThreshold: number = 1.5
): BreakoutCandidate[] {
  // Group weekly projections by player
  const playerWeekly = new Map<string, PlayerProjection[]>();

  for (const p of projections) {
    if (p.week == null) continue;
    const existing = playerWeekly.get(p.playerName) || [];
    existing.push(p);
    playerWeekly.set(p.playerName, existing);
  }

  const candidates: BreakoutCandidate[] = [];

  for (const [playerName, weeks] of playerWeekly) {
    // Need enough weeks of data
    if (weeks.length < rollingWindow + 1) continue;

    const sorted = [...weeks].sort((a, b) => (a.week || 0) - (b.week || 0));

    // Extract usage metric (targets + carries + touches, or points as proxy)
    const usageByWeek = sorted.map(w => ({
      week: w.week || 0,
      usage: (w.stats.targets || 0) + (w.stats.carries || 0) + (w.stats.touches || 0) || w.fantasyPoints * 0.8,
      efficiency: w.fantasyPoints,
    }));

    // Only look at recent weeks
    const recentWeeks = usageByWeek.filter(w => w.week <= currentWeek);
    if (recentWeeks.length < rollingWindow + 1) continue;

    // Calculate rolling averages
    const early = recentWeeks.slice(0, -rollingWindow);
    const recent = recentWeeks.slice(-rollingWindow);

    if (early.length === 0) continue;

    const earlyUsageMean = early.reduce((s, w) => s + w.usage, 0) / early.length;
    const recentUsageMean = recent.reduce((s, w) => s + w.usage, 0) / recent.length;

    const earlyEffMean = early.reduce((s, w) => s + w.efficiency, 0) / early.length;
    const recentEffMean = recent.reduce((s, w) => s + w.efficiency, 0) / recent.length;

    // Calculate std dev of early period
    const earlyUsageStd = Math.sqrt(
      early.reduce((s, w) => s + (w.usage - earlyUsageMean) ** 2, 0) / early.length
    ) || 1;

    const earlyEffStd = Math.sqrt(
      early.reduce((s, w) => s + (w.efficiency - earlyEffMean) ** 2, 0) / early.length
    ) || 1;

    // Z-scores
    const usageZScore = (recentUsageMean - earlyUsageMean) / earlyUsageStd;
    const efficiencyZScore = (recentEffMean - earlyEffMean) / earlyEffStd;

    // Breakout = significant positive trend in usage or efficiency
    if (usageZScore >= zThreshold || efficiencyZScore >= zThreshold) {
      const breakoutScore = Math.round(
        ((usageZScore + efficiencyZScore) / 2) * 100
      ) / 100;

      candidates.push({
        playerName,
        position: sorted[0].position,
        breakoutScore,
        usageTrend: Math.round((recentUsageMean - earlyUsageMean) * 100) / 100,
        efficiencyTrend: Math.round((recentEffMean - earlyEffMean) * 100) / 100,
        usageZScore: Math.round(usageZScore * 100) / 100,
        efficiencyZScore: Math.round(efficiencyZScore * 100) / 100,
        weeklyStats: recentWeeks.map(w => ({
          week: w.week,
          usage: Math.round(w.usage * 100) / 100,
          efficiency: Math.round(w.efficiency * 100) / 100,
        })),
      });
    }
  }

  return candidates.sort((a, b) => b.breakoutScore - a.breakoutScore);
}

// ============================================================================
// FAAB Bid Calculation
// ============================================================================

function calculateFAABBid(
  breakoutScore: number,
  positionalNeed: number,
  rosValue: number,
  totalBudget: number
): number {
  // Base bid scales with breakout score (0-3 typical range for z-scores)
  const normalizedBreakout = Math.min(breakoutScore / 3, 1);
  const baseBidPct = normalizedBreakout * 0.25; // max 25% of budget for top breakout

  // Adjust for positional need (0-1 scale)
  const needMultiplier = 0.5 + positionalNeed * 0.5; // 0.5x to 1.0x

  // Adjust for rest-of-season value
  const rosMultiplier = Math.min(rosValue / 100, 1.5); // cap at 1.5x

  const bidPct = baseBidPct * needMultiplier * rosMultiplier;
  const bid = Math.round(totalBudget * bidPct);

  return Math.max(1, Math.min(bid, Math.round(totalBudget * 0.5))); // min $1, max 50% of budget
}

// ============================================================================
// Positional Need Assessment
// ============================================================================

function assessPositionalNeed(
  position: string,
  roster: RosterEntry[],
  rosterSlots: Record<string, number>
): number {
  const playersAtPosition = roster.filter(r => r.position === position).length;
  const slotsForPosition = rosterSlots[position] || 0;
  const flexSlots = rosterSlots['FLEX'] || 0;

  // Positions eligible for FLEX
  const flexPositions = ['RB', 'WR', 'TE'];
  const isFlexEligible = flexPositions.includes(position);

  const totalSlots = slotsForPosition + (isFlexEligible ? flexSlots : 0);

  if (totalSlots === 0) return 0;

  // High need if below starting requirements
  if (playersAtPosition < slotsForPosition) return 1.0;

  // Medium need if at starting level but no depth
  if (playersAtPosition === slotsForPosition) return 0.7;

  // Lower need as depth increases
  const depthRatio = playersAtPosition / (totalSlots + 2); // +2 for bench depth
  return Math.max(0.1, 1 - depthRatio);
}

// ============================================================================
// Identify Droppable Players
// ============================================================================

function findDropCandidate(
  roster: RosterEntry[],
  addPosition: string,
  projections: Map<string, number>
): { playerName: string; position: string } | undefined {
  // Find the weakest bench player
  const benchPlayers = roster.filter(r => r.rosterSlot === 'BENCH' || r.rosterSlot === 'BN');

  if (benchPlayers.length === 0) {
    // If no explicit bench, find worst player overall
    const sorted = [...roster].sort((a, b) => {
      const ptsA = projections.get(a.playerName) || 0;
      const ptsB = projections.get(b.playerName) || 0;
      return ptsA - ptsB;
    });
    return sorted.length > 0 ? { playerName: sorted[0].playerName, position: sorted[0].position } : undefined;
  }

  const sorted = benchPlayers.sort((a, b) => {
    const ptsA = projections.get(a.playerName) || 0;
    const ptsB = projections.get(b.playerName) || 0;
    return ptsA - ptsB;
  });

  return { playerName: sorted[0].playerName, position: sorted[0].position };
}

// ============================================================================
// Main: Generate Waiver Recommendations
// ============================================================================

export function generateWaiverRecommendations(
  breakouts: BreakoutCandidate[],
  roster: RosterEntry[],
  rosteredPlayers: Set<string>,
  faabBudget: number,
  rosterSlots: Record<string, number>,
  fullAccess: boolean
): WaiverRecommendation[] {
  // Build projection lookup from breakout data
  const projectionMap = new Map<string, number>();
  for (const r of roster) {
    projectionMap.set(r.playerName, 0); // baseline
  }

  const recommendations: WaiverRecommendation[] = [];

  for (const candidate of breakouts) {
    // Skip already-rostered players
    if (rosteredPlayers.has(candidate.playerName)) continue;

    const positionalNeed = assessPositionalNeed(candidate.position, roster, rosterSlots);

    // Rest-of-season value estimate based on efficiency trend
    const rosValue = Math.max(0, candidate.efficiencyTrend * 10 + 50);
    const threeWeekValue = candidate.weeklyStats.length > 0
      ? candidate.weeklyStats.slice(-3).reduce((s, w) => s + w.efficiency, 0) / Math.min(candidate.weeklyStats.length, 3)
      : 0;

    const faabBid = calculateFAABBid(candidate.breakoutScore, positionalNeed, rosValue, faabBudget);
    const faabPercentage = Math.round((faabBid / faabBudget) * 10000) / 10000;

    const dropCandidate = findDropCandidate(roster, candidate.position, projectionMap);

    // Urgency: higher for high breakout + high positional need
    const urgencyScore = Math.round(
      ((candidate.breakoutScore * 0.6) + (positionalNeed * 0.4)) * 100
    ) / 100;

    // Generate reasoning
    const reasoning = buildReasoning(candidate, positionalNeed, faabBid, faabBudget);

    recommendations.push({
      addPlayer: candidate.playerName,
      addPosition: candidate.position,
      dropPlayer: dropCandidate?.playerName,
      dropPosition: dropCandidate?.position,
      faabBid,
      faabPercentage,
      breakoutScore: candidate.breakoutScore,
      rosValue: Math.round(rosValue * 100) / 100,
      threeWeekValue: Math.round(threeWeekValue * 100) / 100,
      urgencyScore,
      positionalNeed: Math.round(positionalNeed * 100) / 100,
      reasoning,
    });
  }

  return recommendations.sort((a, b) => b.urgencyScore - a.urgencyScore);
}

// ============================================================================
// Reasoning Generator
// ============================================================================

function buildReasoning(
  candidate: BreakoutCandidate,
  positionalNeed: number,
  faabBid: number,
  budget: number
): string {
  const parts: string[] = [];

  if (candidate.usageZScore >= 2) {
    parts.push(`Significant usage spike (z=${candidate.usageZScore})`);
  } else if (candidate.usageZScore >= 1.5) {
    parts.push(`Rising usage trend (z=${candidate.usageZScore})`);
  }

  if (candidate.efficiencyZScore >= 2) {
    parts.push(`efficiency breakout (z=${candidate.efficiencyZScore})`);
  } else if (candidate.efficiencyZScore >= 1.5) {
    parts.push(`improving efficiency (z=${candidate.efficiencyZScore})`);
  }

  if (positionalNeed >= 0.8) {
    parts.push(`fills critical ${candidate.position} need`);
  } else if (positionalNeed >= 0.5) {
    parts.push(`addresses ${candidate.position} depth`);
  }

  const bidPct = Math.round((faabBid / budget) * 100);
  parts.push(`recommend ${bidPct}% FAAB ($${faabBid}/$${budget})`);

  return parts.join('; ') + '.';
}
