/**
 * VPE 3.0 — Game-State AI
 * =========================
 * Decision time analysis, pitch sequencing probability distributions,
 * and defensive positioning for Expected Outs Added (EOA).
 */

import type {
  HitterStats,
  DecisionTimeResult,
  DefensivePositionResult,
} from './types';

// ── Decision Time Score ─────────────────────────────────────────────────────

/**
 * Evaluate a hitter's pitch-recognition speed and decision quality.
 *
 * DecisionTimeScore = 1.5*ReactionWindow_z + 1.2*EarlyContactRate_z - 0.8*LateSwingRate_z
 *
 * Higher = better pitch recognition and timing.
 */
export function decisionTimeScore(
  reactionWindowZ: number,
  earlyContactRateZ: number,
  lateSwingRateZ: number,
): DecisionTimeResult {
  const score =
    1.5 * reactionWindowZ +
    1.2 * earlyContactRateZ -
    0.8 * lateSwingRateZ;

  return {
    decisionTimeScore: Math.round(score * 1000) / 1000,
    reactionWindowZ,
    earlyContactRateZ,
    lateSwingRateZ,
  };
}

/**
 * Estimate decision time metrics from available Statcast data.
 * Uses contact%, chase rate, and bat speed as proxies.
 */
export function estimateDecisionTime(h: HitterStats): DecisionTimeResult {
  // Contact% maps to reaction window (higher contact = better recognition)
  const reactionZ = (h.contactPct - 76.0) / 5.0;
  // Low chase rate = good early recognition
  const earlyContactZ = (28.5 - h.chaseRate) / 4.0;
  // High swing length = late swing tendency
  const lateSwingZ = (h.swingLength - 7.2) / 0.8;

  return decisionTimeScore(reactionZ, earlyContactZ, lateSwingZ);
}

// ── Defensive Positioning / Expected Outs Added ─────────────────────────────

interface BattedBallTendency {
  pullPct: number;   // 0-1
  centerPct: number; // 0-1
  oppoPct: number;   // 0-1
  groundBallPct: number; // 0-1
  flyBallPct: number;    // 0-1
  lineDrivePct: number;  // 0-1
}

interface FielderPosition {
  fielderId: string;
  x: number;   // feet from home plate (positive = right field)
  y: number;   // feet from home plate (positive = outfield)
  range: number; // feet coverage radius
}

/**
 * Calculate Expected Outs Added from defensive positioning.
 *
 * EOA = Σ [Probability of out based on fielder position × run value prevented]
 *
 * Uses spray chart tendencies to optimize positioning.
 */
export function calculateEOA(
  tendency: BattedBallTendency,
  fielders: FielderPosition[],
): DefensivePositionResult {
  // Simplified: model 9 zones on the field
  const zones = [
    { x: -60, y: 50, name: '3B area', weight: tendency.pullPct * tendency.groundBallPct },
    { x: -30, y: 80, name: 'SS area', weight: 0.15 },
    { x: 30, y: 80, name: '2B area', weight: tendency.centerPct * tendency.groundBallPct },
    { x: 60, y: 50, name: '1B area', weight: tendency.oppoPct * tendency.groundBallPct },
    { x: -120, y: 280, name: 'LF', weight: tendency.pullPct * tendency.flyBallPct * 0.5 },
    { x: 0, y: 320, name: 'CF', weight: tendency.centerPct * tendency.flyBallPct },
    { x: 120, y: 280, name: 'RF', weight: tendency.oppoPct * tendency.flyBallPct * 0.5 },
    { x: -40, y: 150, name: 'LF line', weight: tendency.pullPct * tendency.lineDrivePct * 0.3 },
    { x: 40, y: 150, name: 'RF line', weight: tendency.oppoPct * tendency.lineDrivePct * 0.3 },
  ];

  let totalEOA = 0;
  const positions: DefensivePositionResult['positions'] = [];

  for (const fielder of fielders) {
    let fielderOuts = 0;
    for (const zone of zones) {
      const dist = Math.sqrt(
        (fielder.x - zone.x) ** 2 + (fielder.y - zone.y) ** 2,
      );
      // Probability of reaching the ball decreases with distance
      const reachProb = dist <= fielder.range
        ? Math.max(0, 1 - dist / (fielder.range * 1.5))
        : 0;
      fielderOuts += reachProb * zone.weight;
    }

    // Run value prevented per out ≈ 0.27 runs
    const runValuePrevented = fielderOuts * 0.27;
    totalEOA += runValuePrevented;

    positions.push({
      fielderId: fielder.fielderId,
      x: fielder.x,
      y: fielder.y,
      probability: Math.round(fielderOuts * 1000) / 1000,
    });
  }

  return {
    expectedOutsAdded: Math.round(totalEOA * 1000) / 1000,
    positions,
  };
}

/**
 * Generate optimal defensive positioning from hitter spray tendencies.
 */
export function optimizeDefensivePositioning(
  hitter: HitterStats,
): DefensivePositionResult {
  // Estimate batted ball tendencies from available data
  const isLefty = hitter.handedness === 'L';
  const pullMult = isLefty ? -1 : 1;

  const tendency: BattedBallTendency = {
    pullPct: (hitter.pullAirPct / 100) * 2.5 + 0.25,
    centerPct: 0.35,
    oppoPct: Math.max(0.1, 1 - ((hitter.pullAirPct / 100) * 2.5 + 0.25) - 0.35),
    groundBallPct: Math.max(0.2, 0.45 - hitter.launchAngle / 50),
    flyBallPct: Math.min(0.5, 0.25 + hitter.launchAngle / 40),
    lineDrivePct: 0.22,
  };

  // Standard defensive positions with shift adjustments
  const fielders: FielderPosition[] = [
    { fielderId: '3B', x: -55 * pullMult, y: 45, range: 25 },
    { fielderId: 'SS', x: -25 * pullMult, y: 75, range: 30 },
    { fielderId: '2B', x: 25 * pullMult, y: 75, range: 28 },
    { fielderId: '1B', x: 55 * pullMult, y: 45, range: 20 },
    { fielderId: 'LF', x: -110, y: 270, range: 50 },
    { fielderId: 'CF', x: 0, y: 310, range: 55 },
    { fielderId: 'RF', x: 110, y: 270, range: 50 },
  ];

  // Apply pull shift for extreme pull hitters
  if (tendency.pullPct > 0.45) {
    const shiftAmount = (tendency.pullPct - 0.45) * 40;
    fielders[1].x -= shiftAmount * pullMult; // SS shifts toward pull
    fielders[2].x -= shiftAmount * pullMult; // 2B shifts toward pull
  }

  return calculateEOA(tendency, fielders);
}
