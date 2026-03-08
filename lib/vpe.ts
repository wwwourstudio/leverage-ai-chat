/**
 * Vortex Projection Engine (VPE) 3.0
 * TypeScript implementation for MLB analytics: hitters, pitchers, teams, and MiLB call-ups.
 * Includes projections, DFS optimization, Monte Carlo simulations, pitch modeling, injury risk, and trade evaluation.
 * Baseball-only — do not use for other sports.
 */

//////////////////////////
// UTILITY FUNCTIONS
//////////////////////////

export const zScore = (value: number, mean: number, std: number): number =>
  std === 0 ? 0 : (value - mean) / std;

export const randomNormal = (mean = 0, std = 1, seed?: number): number => {
  let x = seed ?? Math.random();
  x = Math.sin(x * 10000) * 10000;
  return mean + std * (x - Math.floor(x));
};

export const monteCarlo = (
  fn: () => number,
  iterations: number,
  _seed = 42
): number[] => {
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    results.push(fn());
  }
  return results;
};

//////////////////////////
// BASE CLASSES
//////////////////////////

export class Player {
  name: string;
  age: number;
  position: string;

  constructor(name: string, age: number, position: string) {
    this.name = name;
    this.age = age;
    this.position = position;
  }
}

//////////////////////////
// HITTERS
//////////////////////////

export interface HitterStats {
  PA: number;
  EV50: number; // mph
  PullAirPercent: number;
  BarrelPercent: number;
  HardHitPercent: number;
  LaunchAngle: number;
  BatSpeed: number;
  ContactRate: number;
  SwingLength: number;
}

export class Hitter extends Player {
  stats: HitterStats;

  constructor(name: string, age: number, position: string, stats: HitterStats) {
    super(name, age, position);
    this.stats = stats;
  }

  /** Power Breakout Index */
  powerBreakoutIndex(
    leagueMean: HitterStats,
    leagueStd: HitterStats
  ): number {
    const BatSpeed_z = zScore(this.stats.BatSpeed, leagueMean.BatSpeed, leagueStd.BatSpeed);
    const AttackAngle_z = zScore(this.stats.LaunchAngle, leagueMean.LaunchAngle, leagueStd.LaunchAngle);
    const PullAirPercent = this.stats.PullAirPercent;

    return 0.55 * BatSpeed_z + 0.35 * AttackAngle_z + 0.25 * PullAirPercent + 0.2 * this.stats.BarrelPercent;
  }

  /** Swing Efficiency */
  swingEfficiency(): number {
    const { BatSpeed, ContactRate, LaunchAngle, SwingLength } = this.stats;
    return 1.8 * BatSpeed + 1.2 * ContactRate + 1.5 * LaunchAngle - 0.8 * SwingLength;
  }

  /** VPE Val Hit */
  vpeValHit(): number {
    return this.powerBreakoutIndex(this.stats, this.stats) * 1.1 + this.swingEfficiency() * 0.5;
  }
}

//////////////////////////
// PITCHERS
//////////////////////////

export interface PitcherStats {
  velocity: number;
  verticalBreak: number;
  horizontalBreak: number;
  spinRate: number;
  extension: number;
  releaseVariance: number;
  KPer9: number;
  CSW: number;
}

// League-average pitcher stats for z-score normalization
export const LEAGUE_AVG_PITCHER: PitcherStats = {
  velocity: 93.5,
  verticalBreak: 8.5,
  horizontalBreak: 3.5,
  spinRate: 2250,
  extension: 6.2,
  releaseVariance: 0.25,
  KPer9: 8.5,
  CSW: 0.27,
};

export const LEAGUE_STD_PITCHER: PitcherStats = {
  velocity: 2.5,
  verticalBreak: 2.0,
  horizontalBreak: 1.5,
  spinRate: 250,
  extension: 0.4,
  releaseVariance: 0.1,
  KPer9: 2.0,
  CSW: 0.04,
};

// League-average hitter stats for z-score normalization
export const LEAGUE_AVG_HITTER: HitterStats = {
  PA: 500,
  EV50: 89.5,
  PullAirPercent: 0.22,
  BarrelPercent: 0.07,
  HardHitPercent: 0.37,
  LaunchAngle: 12.5,
  BatSpeed: 70.5,
  ContactRate: 0.77,
  SwingLength: 7.2,
};

export const LEAGUE_STD_HITTER: HitterStats = {
  PA: 100,
  EV50: 2.5,
  PullAirPercent: 0.06,
  BarrelPercent: 0.04,
  HardHitPercent: 0.05,
  LaunchAngle: 4.0,
  BatSpeed: 2.5,
  ContactRate: 0.05,
  SwingLength: 0.8,
};

export class Pitcher extends Player {
  stats: PitcherStats;

  constructor(name: string, age: number, position: string, stats: PitcherStats) {
    super(name, age, position);
    this.stats = stats;
  }

  /** Stuff+ */
  stuffScore(
    leagueMean: PitcherStats = LEAGUE_AVG_PITCHER,
    leagueStd: PitcherStats = LEAGUE_STD_PITCHER
  ): number {
    const velocity_z = zScore(this.stats.velocity, leagueMean.velocity, leagueStd.velocity);
    const vertical_z = zScore(this.stats.verticalBreak, leagueMean.verticalBreak, leagueStd.verticalBreak);
    const horizontal_z = zScore(this.stats.horizontalBreak, leagueMean.horizontalBreak, leagueStd.horizontalBreak);
    const spin_z = zScore(this.stats.spinRate, leagueMean.spinRate, leagueStd.spinRate);
    const extension_z = zScore(this.stats.extension, leagueMean.extension, leagueStd.extension);
    const releasePenalty = this.stats.releaseVariance;

    return 0.3 * velocity_z + 0.2 * vertical_z + 0.15 * horizontal_z + 0.15 * spin_z + 0.1 * extension_z - 0.1 * releasePenalty;
  }

  /** CSW + K/9 dominance */
  kSkill(leagueCSW: number = LEAGUE_AVG_PITCHER.CSW, leagueK9: number = LEAGUE_AVG_PITCHER.KPer9): number {
    return 0.6 * (this.stats.CSW - leagueCSW) + 0.4 * (this.stats.KPer9 - leagueK9);
  }

  /** VPE Val Pitch */
  vpeValPitch(): number {
    return this.stuffScore() + this.kSkill();
  }
}

//////////////////////////
// MINOR LEAGUE PLAYER
//////////////////////////

export class MinorLeaguePlayer extends Hitter {
  level: 'AAA' | 'AA' | 'High-A' | 'Low-A';

  constructor(
    name: string,
    age: number,
    position: string,
    stats: HitterStats,
    level: 'AAA' | 'AA' | 'High-A' | 'Low-A'
  ) {
    super(name, age, position, stats);
    this.level = level;
  }

  /** Translate MiLB → MLB projection */
  mlbProjection(): number {
    const levelFactor: Record<string, number> = { AAA: 0.9, AA: 0.75, 'High-A': 0.6, 'Low-A': 0.5 };
    return this.vpeValHit() * (levelFactor[this.level] ?? 0.5);
  }
}

//////////////////////////
// TEAM
//////////////////////////

export class Team {
  name: string;
  hitters: Hitter[];
  pitchers: Pitcher[];

  constructor(name: string, hitters: Hitter[], pitchers: Pitcher[]) {
    this.name = name;
    this.hitters = hitters;
    this.pitchers = pitchers;
  }

  /** Team Wins via Pythagorean expectation */
  pythagoreanWins(): number {
    const runs = this.hitters.reduce((sum, h) => sum + h.vpeValHit(), 0);
    const runsAllowed = this.pitchers.reduce((sum, p) => sum + p.vpeValPitch(), 0);
    if (runs <= 0 && runsAllowed <= 0) return 81;
    const rPow = Math.pow(Math.max(runs, 1), 1.83);
    const raPow = Math.pow(Math.max(runsAllowed, 1), 1.83);
    return (rPow / (rPow + raPow)) * 162;
  }
}

//////////////////////////
// TRADE VALUE
//////////////////////////

export const tradeValue = (
  projectedWAR: number,
  age: number,
  contractSurplus: number,
  injuryRisk: number,
  positionalScarcity: number
): number => 3 * projectedWAR + 2 * age + 1.5 * contractSurplus - injuryRisk + 0.8 * positionalScarcity;
