/**
 * Vortex Projection Engine (VPE)
 *
 * Custom baseball projection scoring system that produces a unified VPE-Val
 * score (higher = more valuable) for hitters and pitchers.
 *
 * Calibrated to 2025 MLB league averages:
 *   ERA 4.30 | WHIP 1.289 | K/9 8.5 | K% 23–24% | Pull Air% 18.2%
 *   AIR% 40–41% | HardHit% 35% | Barrel% 8%
 *
 * Inputs come from Baseball Savant (StatcastPlayer). Full VPE fields that
 * aren't in the Statcast CSV (wRC+, K%, Pull Air%, WHIP, K/9, IP, Saves)
 * are approximated from the available Statcast metrics using the mappings
 * documented below. Handedness bonus and park factors default to neutral
 * (0 and 100 respectively) until those data sources are integrated.
 *
 * Field approximations:
 *   Pull Air%  ← barrelRate  (high barrel → pull-power tendency)
 *   AIR%       ← launchAngle / 25, clamped 0–0.65
 *   wRC+       ← xwOBA: ((xwoba - 0.320) / 0.320) * 100 + 100
 *   WHIP (P)   ← xwOBA: 1.289 + (xwoba - 0.320) * 3.8
 *   K/9  (P)   ← hardHitPct: 8.5 + (0.35 - hardHitPct) * 15
 *   HR/9 (P)   ← barrelRate: barrelRate * 0.9
 *   IP   (P)   ← pa * 0.28  (starter: ~180 IP / 650 BF)
 */

import type { StatcastPlayer } from '@/lib/baseball-savant';

// ── League calibration constants (2025 MLB actuals) ───────────────────────────

export const VPE_LEAGUE = {
  ERA:          4.30,
  WHIP:         1.289,
  K9:           8.5,
  K_PCT:        0.235,
  PULL_AIR_PCT: 0.182,
  AIR_PCT:      0.41,
  HARD_HIT_PCT: 0.35,
  BARREL_PCT:   0.08,
  XWOBA:        0.320,
} as const;

// ── Output type ───────────────────────────────────────────────────────────────

export interface VPEResult {
  name: string;
  playerType: 'batter' | 'pitcher';
  /** Unified value score — higher is better */
  vpeVal: number;
  /** Intermediate breakdown fields (for debugging / display) */
  powerCore?: number;
  enhancedWRC?: number;
  vpeERA?: number;
}

// ── Hitter VPE-Val ────────────────────────────────────────────────────────────

/**
 * Computes VPE-Val for a batter.
 *
 * Formula (simplified from full VPE, using Statcast proxies):
 *   PowerCore      = 100 + 20*(PullAir% - 0.182) + 12*(Barrel% - 0.08) + 10*(HardHit% - 0.35)
 *   Enhanced_wRC+  = BaseWRC+ + PowerCore
 *   AirBoost       = max(1 + (AIR% - 0.41), 0.8)
 *   VPE-Val        = ((Enhanced_wRC+ - 100) * PA * 0.125 + 20) / 10 * AirBoost
 */
export function computeVPEBatter(p: StatcastPlayer): VPEResult {
  const L = VPE_LEAGUE;

  // Pull Air% proxy: barrelRate and pull-power are tightly correlated
  const pullAirProxy = L.PULL_AIR_PCT + (p.barrelRate / 100 - L.BARREL_PCT) * 0.8;

  // PowerCore (same formula as spec, using Statcast-available inputs)
  const powerCore = 100
    + 20 * (pullAirProxy        - L.PULL_AIR_PCT)
    + 12 * (p.barrelRate / 100  - L.BARREL_PCT)
    + 10 * (p.hardHitPct / 100  - L.HARD_HIT_PCT);

  // wRC+ approximation from xwOBA (0.320 xwOBA ≈ wRC+ 100)
  const baseWRC = ((p.xwoba - L.XWOBA) / L.XWOBA) * 100 + 100;
  const enhancedWRC = baseWRC + powerCore;

  // AIR% from launch angle (league average ~10–12° → AIR% ~41%)
  const airPctProxy = Math.min(Math.max(p.launchAngle / 25, 0), 0.65);
  const airBoost = Math.max(1 + (airPctProxy - L.AIR_PCT), 0.8);

  const pa = Math.max(p.pa, 50);
  const vpeVal = ((enhancedWRC - 100) * pa * 0.125 + 20) / 10 * airBoost;

  return {
    name: p.name,
    playerType: 'batter',
    vpeVal: Math.round(vpeVal * 10) / 10,
    powerCore: Math.round(powerCore * 10) / 10,
    enhancedWRC: Math.round(enhancedWRC * 10) / 10,
  };
}

// ── Pitcher VPE-Val ───────────────────────────────────────────────────────────

/**
 * Computes VPE-Val for a pitcher.
 *
 * Formula:
 *   VPE_ERA = 4.30*(PF/100) + 13.5*HR/9 + 3.4*(WHIP - 1.289)
 *             - 1.10*(K/9 - 8.5) + 1.8*(AIR% - 0.41)
 *   VPE-Val = ((4.30 - VPE_ERA) * IP/9 * 1.22) / 10
 *
 * All VPE_ERA inputs are approximated from Statcast (see file header).
 * Park factor defaults to 100 (neutral) until PF data is integrated.
 */
export function computeVPEPitcher(p: StatcastPlayer): VPEResult {
  const L = VPE_LEAGUE;

  // WHIP proxy from xwOBA allowed (lower xwOBA allowed = lower WHIP)
  const whipProxy = L.WHIP + (p.xwoba - L.XWOBA) * 3.8;

  // K/9 proxy from hardHitPct allowed (suppressing hard contact → more Ks)
  const k9Proxy = L.K9 + (L.HARD_HIT_PCT - p.hardHitPct / 100) * 15;

  // HR/9 proxy from barrelRate allowed
  const hr9Proxy = Math.max(p.barrelRate / 100 * 0.9, 0);

  // AIR% allowed proxy from launch angle of balls in play
  const airProxy = Math.min(Math.max(p.launchAngle / 25, 0), 0.65);

  // Park factor default 100 (neutral)
  const parkFactor = 100;

  const vpeERA = 4.30 * (parkFactor / 100)
    + 13.5 * hr9Proxy
    + 3.4  * (whipProxy - L.WHIP)
    - 1.10 * (k9Proxy   - L.K9)
    + 1.8  * (airProxy  - L.AIR_PCT);

  // IP estimate from PA faced (starter: ~0.28 IP/PA)
  const ip = Math.max(p.pa * 0.28, 20);
  const vpeVal = ((4.30 - vpeERA) * ip / 9 * 1.22) / 10;

  return {
    name: p.name,
    playerType: 'pitcher',
    vpeVal: Math.round(vpeVal * 10) / 10,
    vpeERA: Math.round(vpeERA * 100) / 100,
  };
}

// ── Ranking ───────────────────────────────────────────────────────────────────

/**
 * Computes and sorts VPE-Val for a list of Statcast players (batters + pitchers).
 * Returns highest-valued players first.
 */
export function rankByVPE(players: StatcastPlayer[]): VPEResult[] {
  return players
    .map(p => p.playerType === 'batter' ? computeVPEBatter(p) : computeVPEPitcher(p))
    .sort((a, b) => b.vpeVal - a.vpeVal);
}
