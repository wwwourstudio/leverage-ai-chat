/**
 * VPE 3.0 — Type Definitions
 * ============================
 * All types, interfaces, enums, and league-average constants
 * for the Vortex Projection Engine 3.0.
 *
 * Z-score variables (e.g., BatSpeed_z, EV50_z) are standardized
 * against league averages defined in LEAGUE_AVG.
 */

// ── Enums ───────────────────────────────────────────────────────────────────

export type Position =
  | 'C' | '1B' | '2B' | '3B' | 'SS'
  | 'LF' | 'CF' | 'RF' | 'DH'
  | 'SP' | 'RP' | 'CL';

export type Handedness = 'L' | 'R' | 'S';

export type Granularity = 'daily' | 'weekly' | 'season';

export type BreakoutTier = 'Confirmed Breakout' | 'Trending' | 'Watch' | 'No Signal';

export type StuffGrade = 'Elite' | 'Plus' | 'Average' | 'Below' | 'Poor';

export type TunnelGrade = 'Elite Tunneler' | 'Plus Tunneler' | 'Average' | 'Poor Tunneler';

export type CSWTier = 'Elite' | 'Above Average' | 'Average' | 'Below Average';

// ── League Average Constants (2025 MLB) ─────────────────────────────────────

export const LEAGUE_AVG = {
  // Hitter baselines
  EV: 88.4,
  EV50: 103.5,
  LAUNCH_ANGLE: 12.1,
  BARREL_PCT: 8.0,
  HARD_HIT_PCT: 37.5,
  PULL_AIR_PCT: 12.0,
  BAT_SPEED: 71.5,
  ATTACK_ANGLE: 10.0,
  K_PCT_HITTER: 22.5,
  BB_PCT_HITTER: 8.5,
  XWOBA: 0.315,
  ISO: 0.155,
  WRC_PLUS: 100.0,
  HR_FB_RATIO: 13.5,
  CONTACT_PCT: 76.0,
  CHASE_RATE: 28.5,
  BLAST_RATE: 4.5,
  SWING_LENGTH: 7.2,

  // Pitcher baselines
  ERA: 4.30,
  WHIP: 1.289,
  K_PER_9: 8.5,
  BB_PER_9: 3.2,
  VELOCITY: 93.8,
  SPIN_RATE: 2280,
  EXTENSION: 6.3,
  CSW_PCT: 29.5,
  HR_PER_9: 1.20,

  // Standard deviations for z-score computation
  SD: {
    EV: 3.2,
    EV50: 3.5,
    BAT_SPEED: 4.0,
    ATTACK_ANGLE: 3.0,
    LA: 5.0,
    VELOCITY: 2.5,
    SPIN_RATE: 180,
    EXTENSION: 0.35,
    VERT_BREAK: 3.0,
    HORIZ_BREAK: 4.0,
  },
} as const;

// ── Park Factors ────────────────────────────────────────────────────────────

export interface ParkFactors {
  hr: number;
  runs: number;
  k: number;
  name: string;
}

// ── Weather ─────────────────────────────────────────────────────────────────

export interface WeatherConditions {
  tempF: number;
  windSpeedMph: number;
  windDirectionDeg: number;  // 0=N, 90=E, 180=S, 270=W
  humidityPct: number;
  isOutdoor: boolean;
  isDayGame: boolean;
}

// ── DFS Modifiers ───────────────────────────────────────────────────────────

export interface DFSModifiers {
  weather: number;
  fatigue: number;
  dayNight: number;
  opponentStrength: number;
  platoon: number;
  park: number;
}

// ── Base Player ─────────────────────────────────────────────────────────────

export interface PlayerBase {
  playerId: string;
  name: string;
  team: string;
  age: number;
  position: Position;
  handedness: Handedness;
  salary: number;
  vpeVal: number;
  projectedDkPts: number;
}

// ── Hitter ──────────────────────────────────────────────────────────────────

export interface HitterStats extends PlayerBase {
  // Statcast metrics
  ev: number;
  ev50: number;
  launchAngle: number;
  barrelPct: number;
  hardHitPct: number;
  sweetSpotPct: number;
  pullAirPct: number;

  // Bat tracking
  batSpeed: number;
  attackAngle: number;
  swingLength: number;
  blastRate: number;

  // Plate discipline
  kPct: number;
  bbPct: number;
  chaseRate: number;
  contactPct: number;

  // Expected stats
  xwoba: number;
  xba: number;
  xslg: number;
  iso: number;
  hrFbRatio: number;

  // Traditional
  pa: number;
  ab: number;
  wrcPlus: number;

  // Opposing pitcher context
  oppPitcherThrows: Handedness;
  oppPitcherKPct: number;
  oppPitcherVelocity: number;

  // Computed z-scores
  batSpeedZ: number;
  ev50Z: number;
  attackAngleZ: number;
  evZ: number;
}

// ── Pitcher ─────────────────────────────────────────────────────────────────

export interface PitcherStats extends PlayerBase {
  // Statcast
  velocity: number;
  spinRate: number;
  extension: number;
  releaseHeight: number;
  verticalBreak: number;
  horizontalBreak: number;
  whiffPct: number;

  // Results
  era: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
  kPct: number;
  bbPct: number;
  cswPct: number;
  ip: number;

  // Arsenal
  fastballPct: number;
  breakingPct: number;
  offspeedPct: number;
  pitchSkills: Record<string, number>;
  pitchUsage: Record<string, number>;

  // Biomechanics / injury
  velocityTrend: number;
  spinTrend: number;
  armSlotVariance: number;
  releasePointDrift: number;
  workloadInnings: number;

  // Saves context
  saves: number;
  saveOpportunities: number;
  leverageIndex: number;

  // Computed z-scores
  velocityZ: number;
  spinRateZ: number;
  extensionZ: number;
  vertBreakZ: number;
  horizBreakZ: number;
}

// ── Minor League Player ─────────────────────────────────────────────────────

export type MiLBLevel = 'AAA' | 'AA' | 'High-A' | 'Low-A';

export interface MinorLeaguePlayerStats extends PlayerBase {
  level: MiLBLevel;

  // MiLB Statcast-equivalent
  ev: number;
  ev50: number;
  launchAngle: number;
  barrelPct: number;
  hardHitPct: number;
  pullPct: number;
  kPct: number;
  bbPct: number;

  // Pitcher-specific
  velocity: number;
  spinRate: number;
  pitchMix: Record<string, number>;

  // Call-up context
  milbVpeVal: number;
  expectedPlayingTime: number;
  teamNeed: number;
  positionalScarcity: number;
}

// ── Pitch-Level Types ───────────────────────────────────────────────────────

export interface StuffPlusResult {
  pitchType: string;
  stuffScore: number;
  velocityZ: number;
  vertBreakZ: number;
  horizBreakZ: number;
  spinRateZ: number;
  extensionZ: number;
  releasePenalty: number;
  grade: StuffGrade;
}

export interface TunnelResult {
  tunnelScore: number;
  tunnelDistance: number;
  releaseSimilarity: number;
  velocityDifferential: number;
  spinAxisSimilarity: number;
  predictedKBoost: number;
  grade: TunnelGrade;
}

export interface CSWResult {
  cswPct: number;
  kSkill: number;
  cswAboveAvg: number;
  k9AboveAvg: number;
  dominanceTier: CSWTier;
  projectedKPct: number;
}

export interface PitchSequencePrediction {
  pitchType: string;
  probability: number;
  expectedLocation: [number, number];
  confidence: number;
}

// ── Breakout Types ──────────────────────────────────────────────────────────

export interface BreakoutResult {
  powerBreakoutIndex: number;
  swingEfficiency: number;
  sleeperScore: number;
  mvpScore: number;
  breakoutProbability: number;
  tier: BreakoutTier;
  signals: string[];
}

// ── Injury Types ────────────────────────────────────────────────────────────

export interface InjuryRiskResult {
  riskScore: number;
  velocityDrop: number;
  releaseVariance: number;
  spinRateDrop: number;
  workloadSpike: number;
  ageFactor: number;
  riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Critical';
  warnings: string[];
}

// ── Game State Types ────────────────────────────────────────────────────────

export interface DecisionTimeResult {
  decisionTimeScore: number;
  reactionWindowZ: number;
  earlyContactRateZ: number;
  lateSwingRateZ: number;
}

export interface DefensivePositionResult {
  expectedOutsAdded: number;
  positions: Array<{ fielderId: string; x: number; y: number; probability: number }>;
}

// ── Simulation Types ────────────────────────────────────────────────────────

export interface SimulationResult {
  mean: number;
  stdDev: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  distribution: number[];
}

export interface HitterSimResult {
  hrs: SimulationResult;
  hits: SimulationResult;
  rbis: SimulationResult;
  runs: SimulationResult;
  sbs: SimulationResult;
  ks: SimulationResult;
  dkPts: SimulationResult;
}

export interface PitcherSimResult {
  ks: SimulationResult;
  whip: SimulationResult;
  wins: SimulationResult;
  dkPts: SimulationResult;
}

export interface SeasonSimResult {
  teamName: string;
  projectedWins: SimulationResult;
  playoffProbability: number;
  divisionWinProbability: number;
  worldSeriesProbability: number;
  runsScored: SimulationResult;
  runsAllowed: SimulationResult;
}

// ── MiLB Types ──────────────────────────────────────────────────────────────

export interface MiLBProjection {
  mlbDebutVpeVal: number;
  confidenceInterval: [number, number];
  translationFactor: number;
  parkModifier: number;
  dayNightModifier: number;
  oppModifier: number;
  callUpScore: number;
}

// ── Optimizer Types ─────────────────────────────────────────────────────────

export interface DFSLineup {
  players: Array<{ player: PlayerBase; position: Position; salary: number; projectedPts: number }>;
  totalSalary: number;
  totalProjectedPts: number;
  ceilingPts: number;
  floorPts: number;
}

export interface BettingEdge {
  playerName: string;
  propType: string;
  fairProbability: number;
  marketProbability: number;
  edgePct: number;
  kellyFraction: number;
  fairOdds: number;
  marketOdds: number;
  recommendation: 'Strong Bet' | 'Value' | 'Lean' | 'Pass';
}

export interface TradeValue {
  playerName: string;
  tradeValue: number;
  projectedWAR: number;
  ageFactor: number;
  contractSurplus: number;
  injuryRisk: number;
  positionalScarcity: number;
  rank: number;
}

// ── VPE Engine Result ───────────────────────────────────────────────────────

export interface VPE3Result {
  hitters: Array<HitterStats & { breakout: BreakoutResult; vpeVal: number }>;
  pitchers: Array<PitcherStats & { stuffPlus: Record<string, StuffPlusResult>; csw: CSWResult; injuryRisk: InjuryRiskResult; vpeVal: number }>;
  teamProjections: SeasonSimResult[];
  milbCallUps: MiLBProjection[];
  dfsLineup: DFSLineup | null;
  bettingEdges: BettingEdge[];
  tradeValues: TradeValue[];
  metadata: {
    version: string;
    timestamp: string;
    granularity: Granularity;
    seed: number;
  };
}
