/**
 * DFS Matchup Engine — 9 Hidden Matchup Variables
 * Computes a composite DFS matchup score (0–1) from 9 contextual factors.
 */

import type { HitterFeatures, PitcherFeatures, WeatherConditions } from './feature-engineering';
import type { ParkFactors } from './park-factors';

export interface MatchupVariables {
  /** 1. Platoon advantage (L vs R, R vs L = +, same side = -) */
  platoon: number;
  /** 2. Hot/cold zone interaction (batter's power zones vs pitcher's tendencies) */
  hotZone: number;
  /** 3. Pitch-hitter interaction (FB% vs FB hitter advantage) */
  pitchHitterInteraction: number;
  /** 4. Umpire zone tendency (proxy: pitcher BB% inverse) */
  umpireZone: number;
  /** 5. Park factor (HR environment) */
  parkFactor: number;
  /** 6. Weather factor (wind + temperature) */
  weatherFactor: number;
  /** 7. Velocity gap (pitcher velo vs batter's best-hit pitch speed proxy) */
  velocityGap: number;
  /** 8. Pitch deception (movement variety = harder to time) */
  pitchDeception: number;
  /** 9. Spray angle matchup (pull hitter vs pitcher's ground-ball/pull tendencies) */
  sprayAngleMatchup: number;
  /** Composite DFS score (0–1, weighted average of all 9 variables) */
  dfsMatchupScore: number;
}

/**
 * Compute all 9 DFS matchup variables for a batter-pitcher matchup.
 * All individual variables normalized to 0–1 (higher = better for batter/DFS value).
 */
export function computeMatchupVariables(
  batter: HitterFeatures,
  pitcher: PitcherFeatures,
  weather: WeatherConditions,
  parkFactors: ParkFactors,
): MatchupVariables {
  // 1. Platoon advantage
  const platoon = normalizePlatoon(batter.platoonAdvantage);

  // 2. Hot zone interaction: batter barrel% vs pitcher HR/9 (weak pitchers allow more contact)
  const hotZone = normalizeHotZone(batter.barrelPct, pitcher.hrPer9);

  // 3. Pitch-hitter interaction: high-velocity pitcher vs contact hitter = bad match
  //    Barrel hitters hit velocity better; use barrelPct as FB-power proxy
  const pitchHitterInteraction = normalizePitchHitter(batter.barrelPct, pitcher.velocity, batter.xwOBA);

  // 4. Umpire zone: proxy via pitcher BB% (low BB% = pitcher with better zone command → more Ks)
  //    For batters, low BB% pitcher means fewer free passes — slightly negative
  const umpireZone = normalizeUmpireZone(pitcher.bbPct);

  // 5. Park factor (HR dimension, 0–1 normalized)
  const parkF = normalizeParkFactor(parkFactors.hr);

  // 6. Weather factor: blowing-out wind + warm temp = positive DFS environment
  const weatherF = normalizeWeather(weather);

  // 7. Velocity gap: elite velocity (96+) makes it harder → lower batter advantage
  const velocityGap = normalizeVelocityGap(pitcher.velocity, batter.exitVelocity);

  // 8. Pitch deception: high entropy pitch mix = deceptive = harder for batter
  const pitchDeception = normalizePitchDeception(pitcher.pitchMixEntropy, pitcher.whiffPct ?? 24);

  // 9. Spray angle matchup: pull hitters vs pitchers who pitch away (low horizontal break to pull side)
  const sprayAngleMatchup = normalizeSprayAngle(batter.pullPct, batter.pullPowerScore);

  // Weighted composite — weights reflect empirical DFS correlation research
  const weights = {
    platoon:               0.14,
    hotZone:               0.15,
    pitchHitterInteraction:0.12,
    umpireZone:            0.07,
    parkFactor:            0.13,
    weatherFactor:         0.10,
    velocityGap:           0.11,
    pitchDeception:        0.09,
    sprayAngleMatchup:     0.09,
  };

  const dfsMatchupScore =
    platoon               * weights.platoon +
    hotZone               * weights.hotZone +
    pitchHitterInteraction* weights.pitchHitterInteraction +
    umpireZone            * weights.umpireZone +
    parkF                 * weights.parkFactor +
    weatherF              * weights.weatherFactor +
    velocityGap           * weights.velocityGap +
    pitchDeception        * weights.pitchDeception +
    sprayAngleMatchup     * weights.sprayAngleMatchup;

  return {
    platoon,
    hotZone,
    pitchHitterInteraction,
    umpireZone,
    parkFactor:           parkF,
    weatherFactor:        weatherF,
    velocityGap,
    pitchDeception,
    sprayAngleMatchup,
    dfsMatchupScore:      Math.max(0, Math.min(1, dfsMatchupScore)),
  };
}

// ─── Individual normalizers ───────────────────────────────────────────────────

function normalizePlatoon(advantage: number): number {
  // advantage is in range [-0.05, +0.10]; normalize to 0–1
  return Math.max(0, Math.min(1, (advantage + 0.05) / 0.15));
}

function normalizeHotZone(barrelPct: number, hrPer9: number): number {
  // High barrel + high HR/9 allowed = great matchup
  const batterStrength = Math.min(1, barrelPct / 20);
  const pitcherWeakness = Math.min(1, hrPer9 / 2.0);
  return (batterStrength * 0.6 + pitcherWeakness * 0.4);
}

function normalizePitchHitter(barrelPct: number, velocity: number, xwOBA: number): number {
  // Elite barrels handle velocity better; normalize barrel advantage vs velocity penalty
  const barrelAdv = Math.min(1, barrelPct / 20);
  const veloHurdle = Math.max(0, 1 - (velocity - 90) / 10);
  const contactQuality = Math.min(1, xwOBA / 0.420);
  return (barrelAdv * 0.4 + veloHurdle * 0.3 + contactQuality * 0.3);
}

function normalizeUmpireZone(pitcherBBPct: number): number {
  // Lower BB% pitcher = better command = tighter zone → slightly negative for batter
  // Returns normalized "zone looseness" — higher = more favorable for batter
  return Math.min(1, pitcherBBPct / 12);
}

function normalizeParkFactor(hrFactor: number): number {
  // hrFactor 0.82–1.22 → normalized to 0–1
  return Math.max(0, Math.min(1, (hrFactor - 0.80) / 0.45));
}

function normalizeWeather(w: WeatherConditions): number {
  if (!w.isOutdoor) return 0.5; // Neutral for indoor parks
  const tempScore = Math.max(0, Math.min(1, (w.tempF - 45) / 50));
  // Wind direction: blowing out (roughly toward CF) is good
  const angleDiffRad = ((w.windDirectionDeg - 90 + 360) % 360) * (Math.PI / 180);
  const windOut = Math.max(0, Math.cos(angleDiffRad));
  const windScore = Math.min(1, windOut * w.windSpeedMph / 15);
  return (tempScore * 0.4 + windScore * 0.6);
}

function normalizeVelocityGap(pitcherVelo: number, batterEV: number): number {
  // Higher EV relative to pitcher velocity = batter can handle the heat
  // Elite hitters (EV 95+) handle 97+ mph velocity; weaker hitters struggle
  const ratio = batterEV / (pitcherVelo * 0.97);
  return Math.max(0, Math.min(1, ratio - 0.8));
}

function normalizePitchDeception(entropy: number, whiffPct: number): number {
  // High entropy + high whiff = deceptive pitcher → BAD for batter (so invert)
  const deception = (entropy / 1.58 * 0.5 + whiffPct / 40 * 0.5);
  return Math.max(0, 1 - deception); // Invert: lower deception = better for batter
}

function normalizeSprayAngle(pullPct: number, pullPowerScore: number): number {
  // Pull power hitters in pull-friendly parks get extra value
  return Math.min(1, (pullPct / 60 * 0.5 + pullPowerScore / 20 * 0.5));
}

/** Human-readable label for DFS score tier */
export function getDFSMatchupLabel(score: number): string {
  if (score >= 0.72) return 'Elite Matchup';
  if (score >= 0.60) return 'Strong Matchup';
  if (score >= 0.48) return 'Favorable';
  if (score >= 0.36) return 'Neutral';
  return 'Tough Matchup';
}
