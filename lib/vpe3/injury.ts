/**
 * VPE 3.0 — Injury Risk Model
 * ==============================
 * Track velocity drop, spin drop, arm slot change, release point drift,
 * and workload spikes to predict injuries (UCL/Tommy John) before
 * surface stats degrade.
 *
 * InjuryRisk = 2.2*VelocityDrop + 1.8*ReleaseVariance + 1.6*SpinRateDrop
 *            + 1.4*WorkloadSpike + 1.0*AgeFactor
 */

import { type PitcherStats, type InjuryRiskResult } from './types';
import { ageFactor } from './core';

type RiskLevel = InjuryRiskResult['riskLevel'];

function riskLevel(score: number): RiskLevel {
  if (score >= 8.0) return 'Critical';
  if (score >= 6.0) return 'High';
  if (score >= 4.0) return 'Elevated';
  if (score >= 2.0) return 'Moderate';
  return 'Low';
}

/**
 * Calculate injury risk score for a pitcher.
 *
 * @param pitcher Current-season pitcher stats
 * @param priorVelocity Last season's average fastball velocity
 * @param priorSpinRate Last season's average spin rate
 * @param priorWorkload Last season's innings pitched
 * @param priorArmSlot Last season's arm slot (degrees)
 */
export function calculateInjuryRisk(
  pitcher: PitcherStats,
  priorVelocity: number = pitcher.velocity,
  priorSpinRate: number = pitcher.spinRate,
  priorWorkload: number = pitcher.workloadInnings,
  priorArmSlot: number = 0,
): InjuryRiskResult {
  // Velocity drop (mph lost, normalized)
  const veloDrop = Math.max(0, priorVelocity - pitcher.velocity) / 2.0;

  // Release point variance (drift in inches, 0-1 scale)
  const releaseVar = Math.min(1.0, pitcher.releasePointDrift / 4.0);

  // Spin rate decline (normalized)
  const spinDrop = Math.max(0, (priorSpinRate - pitcher.spinRate) / 200);

  // Workload spike: current season IP / prior season IP > 1.3 = concerning
  const priorIP = Math.max(priorWorkload, 50);
  const workloadRatio = pitcher.workloadInnings / priorIP;
  const workloadSpike = Math.max(0, (workloadRatio - 1.0) * 2.0);

  // Age factor: risk increases after 30
  const ageRisk = pitcher.age > 30 ? (pitcher.age - 30) * 0.15 : 0;

  // Arm slot variance (degrees of change)
  const armSlotChange = priorArmSlot > 0
    ? Math.abs(pitcher.armSlotVariance - priorArmSlot) / 3.0
    : pitcher.armSlotVariance / 5.0;

  // Composite injury risk score
  const riskScore =
    2.2 * veloDrop +
    1.8 * releaseVar +
    1.6 * spinDrop +
    1.4 * workloadSpike +
    1.0 * ageRisk +
    0.8 * armSlotChange;

  // Warning generation
  const warnings: string[] = [];
  if (veloDrop > 0.3)
    warnings.push(`Velocity decline: -${(priorVelocity - pitcher.velocity).toFixed(1)} mph from prior season`);
  if (releaseVar > 0.4)
    warnings.push(`Release point drift: ${pitcher.releasePointDrift.toFixed(1)} inches`);
  if (spinDrop > 0.3)
    warnings.push(`Spin rate decline: -${(priorSpinRate - pitcher.spinRate).toFixed(0)} rpm`);
  if (workloadSpike > 0.6)
    warnings.push(`Workload spike: ${(workloadRatio * 100).toFixed(0)}% of prior season IP`);
  if (ageRisk > 0.5)
    warnings.push(`Age risk: ${pitcher.age} years old`);
  if (armSlotChange > 0.3)
    warnings.push(`Arm slot instability: ${pitcher.armSlotVariance.toFixed(1)}° variance`);

  // UCL-specific warning
  if (veloDrop > 0.5 && spinDrop > 0.3 && pitcher.age >= 28) {
    warnings.push('⚠ UCL stress pattern detected — velocity + spin decline combination');
  }

  return {
    riskScore: Math.round(riskScore * 100) / 100,
    velocityDrop: Math.round(veloDrop * 100) / 100,
    releaseVariance: Math.round(releaseVar * 100) / 100,
    spinRateDrop: Math.round(spinDrop * 100) / 100,
    workloadSpike: Math.round(workloadSpike * 100) / 100,
    ageFactor: Math.round(ageRisk * 100) / 100,
    riskLevel: riskLevel(riskScore),
    warnings,
  };
}
