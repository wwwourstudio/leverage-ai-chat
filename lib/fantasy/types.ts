/**
 * Fantasy Platform - Shared Type Definitions
 *
 * Core interfaces for the fantasy sports intelligence platform:
 * Draft Assistant, Waiver Engine, Win Probability, DFS Optimizer,
 * Injury Alerts, and Bankroll Management.
 */

// ============================================================================
// Enums & Constants
// ============================================================================

export type FantasySport = 'nfl' | 'nba' | 'mlb' | 'nhl';
export type FantasyPlatform = 'espn' | 'yahoo' | 'sleeper' | 'fantrax' | 'custom';
export type ScoringFormat = 'ppr' | 'half_ppr' | 'standard' | 'points' | 'categories';
export type DraftType = 'snake' | 'auction' | 'linear' | 'third_round_reversal';
export type SubscriptionTier = 'free' | 'core' | 'pro' | 'high_stakes';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'SUPERFLEX'
  | 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'G' | 'F' | 'UTIL'  // NBA
  | 'SP' | 'RP' | 'P' | 'OF' | '1B' | '2B' | '3B' | 'SS' | 'DH';  // MLB

// ============================================================================
// League & Team Configuration
// ============================================================================

export interface RosterSlots {
  [position: string]: number;  // e.g. { "QB": 1, "RB": 2, "WR": 2, "TE": 1, "FLEX": 1, "K": 1, "DEF": 1, "BENCH": 6 }
}

export interface ScoringSettings {
  // NFL
  pass_yards_per_point?: number;    // e.g. 25 (1 pt per 25 yards)
  pass_td?: number;                  // points per passing TD
  interception?: number;             // points per INT (negative)
  rush_yards_per_point?: number;
  rush_td?: number;
  reception?: number;                // PPR value (0, 0.5, or 1)
  receiving_yards_per_point?: number;
  receiving_td?: number;
  fumble_lost?: number;
  // NBA
  points?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  // MLB
  runs?: number;
  home_runs?: number;
  rbis?: number;
  stolen_bases?: number;
  batting_avg?: number;
  wins?: number;
  strikeouts?: number;
  era?: number;
  whip?: number;
  saves?: number;
  // Custom
  [key: string]: number | undefined;
}

export interface FantasyLeague {
  id: string;
  userId: string;
  name: string;
  sport: FantasySport;
  platform: FantasyPlatform;
  leagueSize: number;
  scoringType: ScoringFormat;
  scoringSettings: ScoringSettings;
  rosterSlots: RosterSlots;
  draftType: DraftType;
  faabBudget: number;
  tradeDeadline?: string;
  seasonYear: number;
  createdAt: string;
  updatedAt: string;
}

export interface FantasyTeam {
  id: string;
  leagueId: string;
  userId?: string;
  teamName: string;
  draftPosition?: number;
  isUserTeam: boolean;
  recordWins: number;
  recordLosses: number;
  recordTies: number;
  pointsFor: number;
  pointsAgainst: number;
  createdAt: string;
}

export interface FantasyRoster {
  id: string;
  teamId: string;
  playerName: string;
  playerId?: string;
  position: string;
  rosterSlot: string;
  acquisitionType: 'draft' | 'waiver' | 'trade' | 'fa';
  acquisitionCost: number;
  addedAt: string;
}

// ============================================================================
// Player Projections
// ============================================================================

export interface FantasyProjection {
  id: string;
  sport: FantasySport;
  playerName: string;
  playerId?: string;
  position: string;
  seasonYear: number;
  week?: number;
  projectionSource: string;
  stats: Record<string, number>;
  fantasyPoints: number;
  adp: number;
  vbd: number;
  tier: number;
  updatedAt: string;
}

export interface PlayerWithVBD {
  playerName: string;
  playerId?: string;
  position: string;
  projectedPoints: number;
  adp: number;
  vbd: number;
  tier: number;
  positionRank: number;
  overallRank: number;
  scarcityScore: number;
}

// ============================================================================
// Draft Types
// ============================================================================

export interface DraftState {
  draftRoomId: string;
  leagueId: string;
  leagueSize: number;
  totalRounds: number;
  currentPick: number;
  totalPicks: number;
  draftOrder: string[];  // team IDs in snake order
  picks: DraftPick[];
  availablePlayers: PlayerWithVBD[];
  teamRosters: Map<string, FantasyRoster[]>;
  userTeamId: string;
  userDraftPosition: number;
  status: 'pending' | 'active' | 'completed';
}

export interface DraftPick {
  id: string;
  draftRoomId: string;
  pickNumber: number;
  round: number;
  teamId: string;
  playerName: string;
  position: string;
  vbdAtPick: number;
  recommendation?: string;
  wasRecommended: boolean;
  survivalProbability?: number;
  pickedAt: string;
}

export interface DraftRecommendation {
  playerName: string;
  position: string;
  utility: number;
  vbd: number;
  survivalProbability: number;
  regretScore: number;
  rosterFitScore: number;
  scarcityWeight: number;
  opponentLeverage: number;
  reasoning: string;
  rank: number;
}

export interface DraftSimulationResult {
  playerName: string;
  position: string;
  survivalProbability: number;
  expectedVBDLoss: number;
  pickedByOpponentPct: number;
  avgPickWhenTaken: number;
}

// ============================================================================
// Opponent Modeling
// ============================================================================

export interface OpponentProfile {
  teamId: string;
  teamName: string;
  positionBias: Record<string, number>;   // e.g. { "RB": 0.35, "WR": 0.30 }
  reachTendency: number;                   // avg ADP difference
  bestAvailableAdherence: number;          // 0-1, how often they take BPA
  riskTolerance: number;                   // 0-1, upside vs floor preference
  earlyQBBias: number;                     // 0-1, tendency to draft QB early
  stackingPreference: number;              // 0-1, tendency to stack same team
  handcuffPattern: number;                 // 0-1, tendency to cuff their RBs
  pickHistory: DraftPick[];
}

export interface OpponentPickPrediction {
  teamId: string;
  predictions: {
    playerName: string;
    position: string;
    probability: number;
  }[];
}

// ============================================================================
// Tier Cliff Detection
// ============================================================================

export interface TierCliff {
  position: string;
  tierNumber: number;
  cliffAfterRank: number;
  cliffPlayerName: string;
  projectionDrop: number;
  dropPercentage: number;
  slopeZScore: number;
  playersAbove: string[];
  playersBelow: string[];
}

export interface TierAssignment {
  playerName: string;
  position: string;
  tier: number;
  projectedPoints: number;
  positionRank: number;
}

// ============================================================================
// Roster Evaluation
// ============================================================================

export interface RosterGrade {
  overall: string;          // 'A+' through 'F'
  overallScore: number;     // 0-100
  positionalBalance: number;
  starterStrength: number;
  benchDepth: number;
  ceilingScore: number;
  floorScore: number;
  byeWeekConflicts: number;
  handcuffCoverage: number;
  weakPositions: string[];
  strongPositions: string[];
  recommendations: string[];
}

// ============================================================================
// Waiver Engine Types
// ============================================================================

export interface WaiverRecommendation {
  addPlayer: string;
  addPosition: string;
  dropPlayer?: string;
  dropPosition?: string;
  faabBid: number;
  faabPercentage: number;
  breakoutScore: number;
  rosValue: number;
  threeWeekValue: number;
  urgencyScore: number;
  positionalNeed: number;
  reasoning: string;
  opponentBidEstimate?: number;
}

export interface BreakoutCandidate {
  playerName: string;
  position: string;
  breakoutScore: number;
  usageTrend: number;
  efficiencyTrend: number;
  usageZScore: number;
  efficiencyZScore: number;
  weeklyStats: { week: number; usage: number; efficiency: number }[];
}

// ============================================================================
// Win Probability Types
// ============================================================================

export interface MatchupSimulation {
  teamAId: string;
  teamBId: string;
  teamAWinProbability: number;
  teamBWinProbability: number;
  teamAProjectedPoints: number;
  teamBProjectedPoints: number;
  teamAPointsStdDev: number;
  teamBPointsStdDev: number;
  simulations: number;
}

export interface SeasonSimulation {
  teamId: string;
  teamName: string;
  projectedWins: number;
  projectedLosses: number;
  playoffProbability: number;
  championshipProbability: number;
  luckIndex: number;
  strengthOfSchedule: number;
  expectedRecord: { wins: number; losses: number };
  actualRecord: { wins: number; losses: number };
}

// ============================================================================
// DFS Types
// ============================================================================

export interface DFSPlayer {
  playerName: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projection: number;
  projectionStdDev: number;
  ownership: number;
  ceilingProjection: number;
  floorProjection: number;
  value: number;           // projection / salary * 1000
}

export interface DFSLineup {
  id: string;
  players: DFSPlayer[];
  totalSalary: number;
  projectedPoints: number;
  projectedOwnership: number;
  sharpeRatio: number;
  uniqueness: number;      // 0-1, how differentiated from field
}

export interface DFSPortfolio {
  lineups: DFSLineup[];
  totalExposure: Record<string, number>;  // player -> % of lineups
  expectedROI: number;
  varianceOfROI: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface CovarianceEntry {
  playerA: string;
  playerB: string;
  correlation: number;
  reason: string;  // 'same_team', 'game_stack', 'opposing', 'independent'
}

// ============================================================================
// Bankroll Management Types
// ============================================================================

export interface BankrollEntry {
  id: string;
  userId: string;
  entryType: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'loss' | 'fee';
  amount: number;
  balanceAfter: number;
  sport?: string;
  platform?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface BankrollProfile {
  userId: string;
  totalBankroll: number;
  riskTolerance: number;     // 0-1
  historicalROI: number;
  drawdownThreshold: number;
  kellyFraction: number;     // typically 0.25 (quarter Kelly)
  riskOfRuin: number;
  expectedGrowthRate: number;
  varianceBands: { upper: number; lower: number };
}

// ============================================================================
// Injury Alert Types
// ============================================================================

export interface InjuryAlert {
  id: string;
  playerName: string;
  sport: FantasySport;
  injuryType: 'questionable' | 'doubtful' | 'out' | 'ir' | 'day_to_day';
  sourceText: string;
  projectionDelta: number;
  beneficiaryPlayers: { name: string; position: string; projectionBoost: number }[];
  detectedAt: string;
  gameTime?: string;
}

// ============================================================================
// Subscription & Feature Gating
// ============================================================================

export type FantasyFeature =
  | 'basic_projections'
  | 'draft_assistant_basic'
  | 'draft_simulation'
  | 'opponent_modeling'
  | 'waiver_rankings_basic'
  | 'waiver_rankings_full'
  | 'faab_optimizer'
  | 'win_probability_weekly'
  | 'win_probability_realtime'
  | 'injury_alerts_delayed'
  | 'injury_alerts_realtime'
  | 'dfs_optimizer_basic'
  | 'dfs_optimizer_full'
  | 'hedge_fund_mode'
  | 'bankroll_management'
  | 'api_access';

export const TIER_FEATURES: Record<SubscriptionTier, FantasyFeature[]> = {
  free: ['basic_projections'],
  core: [
    'basic_projections',
    'draft_assistant_basic',
    'waiver_rankings_basic',
    'win_probability_weekly',
    'injury_alerts_delayed',
  ],
  pro: [
    'basic_projections',
    'draft_assistant_basic',
    'draft_simulation',
    'opponent_modeling',
    'waiver_rankings_full',
    'faab_optimizer',
    'win_probability_realtime',
    'injury_alerts_realtime',
    'dfs_optimizer_basic',
  ],
  high_stakes: [
    'basic_projections',
    'draft_assistant_basic',
    'draft_simulation',
    'opponent_modeling',
    'waiver_rankings_full',
    'faab_optimizer',
    'win_probability_realtime',
    'injury_alerts_realtime',
    'dfs_optimizer_full',
    'hedge_fund_mode',
    'bankroll_management',
    'api_access',
  ],
};

export function hasFeatureAccess(tier: SubscriptionTier, feature: FantasyFeature): boolean {
  return TIER_FEATURES[tier].includes(feature);
}
