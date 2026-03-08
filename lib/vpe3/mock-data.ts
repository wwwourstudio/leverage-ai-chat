/**
 * VPE 3.0 — Mock / Placeholder Data
 * ====================================
 * Realistic mock data for testing all VPE 3.0 calculations.
 */

import type {
  HitterStats,
  PitcherStats,
  MinorLeaguePlayerStats,
  WeatherConditions,
} from './types';

// ── Mock Hitters ────────────────────────────────────────────────────────────

export function mockEliteHitter(overrides?: Partial<HitterStats>): HitterStats {
  return {
    playerId: '592450',
    name: 'Aaron Judge',
    team: 'NYY',
    age: 32,
    position: 'RF',
    handedness: 'R',
    salary: 6200,
    vpeVal: 0,
    projectedDkPts: 0,
    ev: 95.2,
    ev50: 112.5,
    launchAngle: 15.8,
    barrelPct: 20.5,
    hardHitPct: 55.2,
    sweetSpotPct: 38.0,
    pullAirPct: 18.5,
    batSpeed: 78.5,
    attackAngle: 13.0,
    swingLength: 7.8,
    blastRate: 7.2,
    kPct: 25.0,
    bbPct: 14.5,
    chaseRate: 22.0,
    contactPct: 72.0,
    xwoba: 0.420,
    xba: 0.290,
    xslg: 0.580,
    iso: 0.290,
    hrFbRatio: 28.0,
    pa: 600,
    ab: 500,
    wrcPlus: 175,
    oppPitcherThrows: 'R',
    oppPitcherKPct: 22.0,
    oppPitcherVelocity: 93.5,
    batSpeedZ: 0,
    ev50Z: 0,
    attackAngleZ: 0,
    evZ: 0,
    ...overrides,
  };
}

export function mockAverageHitter(overrides?: Partial<HitterStats>): HitterStats {
  return {
    playerId: '000001',
    name: 'League Average',
    team: 'CHC',
    age: 27,
    position: 'SS',
    handedness: 'R',
    salary: 4500,
    vpeVal: 0,
    projectedDkPts: 0,
    ev: 88.4,
    ev50: 103.5,
    launchAngle: 12.1,
    barrelPct: 8.0,
    hardHitPct: 37.5,
    sweetSpotPct: 33.0,
    pullAirPct: 12.0,
    batSpeed: 71.5,
    attackAngle: 10.0,
    swingLength: 7.2,
    blastRate: 4.5,
    kPct: 22.5,
    bbPct: 8.5,
    chaseRate: 28.5,
    contactPct: 76.0,
    xwoba: 0.315,
    xba: 0.250,
    xslg: 0.420,
    iso: 0.155,
    hrFbRatio: 13.5,
    pa: 550,
    ab: 480,
    wrcPlus: 100,
    oppPitcherThrows: 'R',
    oppPitcherKPct: 22.0,
    oppPitcherVelocity: 93.5,
    batSpeedZ: 0,
    ev50Z: 0,
    attackAngleZ: 0,
    evZ: 0,
    ...overrides,
  };
}

export function mockBreakoutHitter(overrides?: Partial<HitterStats>): HitterStats {
  return {
    ...mockAverageHitter(),
    playerId: '000003',
    name: 'Breakout Candidate',
    team: 'BAL',
    age: 24,
    position: '2B',
    handedness: 'L',
    ev: 91.5,
    ev50: 108.0,
    launchAngle: 14.5,
    barrelPct: 12.5,
    hardHitPct: 46.0,
    pullAirPct: 16.5,
    batSpeed: 76.0,
    attackAngle: 12.5,
    blastRate: 6.5,
    kPct: 18.0,
    bbPct: 10.0,
    chaseRate: 24.0,
    contactPct: 80.0,
    xwoba: 0.360,
    iso: 0.200,
    wrcPlus: 125,
    ...overrides,
  };
}

// ── Mock Pitchers ───────────────────────────────────────────────────────────

export function mockAcePitcher(overrides?: Partial<PitcherStats>): PitcherStats {
  return {
    playerId: '543037',
    name: 'Gerrit Cole',
    team: 'NYY',
    age: 34,
    position: 'SP',
    handedness: 'R',
    salary: 10800,
    vpeVal: 0,
    projectedDkPts: 0,
    velocity: 97.2,
    spinRate: 2550,
    extension: 6.7,
    releaseHeight: 6.2,
    verticalBreak: 16.5,
    horizontalBreak: 7.5,
    whiffPct: 32.0,
    era: 3.10,
    whip: 1.05,
    kPer9: 11.5,
    bbPer9: 2.2,
    hrPer9: 0.85,
    kPct: 30.0,
    bbPct: 6.0,
    cswPct: 33.5,
    ip: 200.0,
    fastballPct: 45,
    breakingPct: 35,
    offspeedPct: 20,
    pitchSkills: { fastball: 0.80, slider: 0.75, curve: 0.65, changeup: 0.60 },
    pitchUsage: { fastball: 0.45, slider: 0.25, curve: 0.15, changeup: 0.15 },
    velocityTrend: -0.5,
    spinTrend: -20,
    armSlotVariance: 1.2,
    releasePointDrift: 0.8,
    workloadInnings: 180,
    saves: 0,
    saveOpportunities: 0,
    leverageIndex: 1.0,
    velocityZ: 0,
    spinRateZ: 0,
    extensionZ: 0,
    vertBreakZ: 0,
    horizBreakZ: 0,
    ...overrides,
  };
}

export function mockAveragePitcher(overrides?: Partial<PitcherStats>): PitcherStats {
  return {
    playerId: '000002',
    name: 'League Average SP',
    team: 'CHC',
    age: 27,
    position: 'SP',
    handedness: 'R',
    salary: 7500,
    vpeVal: 0,
    projectedDkPts: 0,
    velocity: 93.8,
    spinRate: 2280,
    extension: 6.3,
    releaseHeight: 6.0,
    verticalBreak: 14.0,
    horizontalBreak: 8.0,
    whiffPct: 25.0,
    era: 4.30,
    whip: 1.289,
    kPer9: 8.5,
    bbPer9: 3.2,
    hrPer9: 1.20,
    kPct: 23.0,
    bbPct: 8.0,
    cswPct: 29.5,
    ip: 160.0,
    fastballPct: 50,
    breakingPct: 30,
    offspeedPct: 20,
    pitchSkills: { fastball: 0.50, slider: 0.50, curve: 0.50, changeup: 0.50 },
    pitchUsage: { fastball: 0.50, slider: 0.20, curve: 0.15, changeup: 0.15 },
    velocityTrend: 0.0,
    spinTrend: 0,
    armSlotVariance: 0.0,
    releasePointDrift: 0.0,
    workloadInnings: 150,
    saves: 0,
    saveOpportunities: 0,
    leverageIndex: 1.0,
    velocityZ: 0,
    spinRateZ: 0,
    extensionZ: 0,
    vertBreakZ: 0,
    horizBreakZ: 0,
    ...overrides,
  };
}

export function mockCloser(overrides?: Partial<PitcherStats>): PitcherStats {
  return {
    ...mockAveragePitcher(),
    playerId: '000004',
    name: 'Elite Closer',
    position: 'CL',
    velocity: 98.5,
    spinRate: 2450,
    era: 2.50,
    whip: 0.95,
    kPer9: 13.0,
    kPct: 35.0,
    cswPct: 35.0,
    ip: 65.0,
    saves: 38,
    saveOpportunities: 42,
    leverageIndex: 2.1,
    ...overrides,
  };
}

// ── Mock Minor Leaguers ─────────────────────────────────────────────────────

export function mockProspect(overrides?: Partial<MinorLeaguePlayerStats>): MinorLeaguePlayerStats {
  return {
    playerId: 'ML001',
    name: 'Jackson Holliday',
    team: 'BAL',
    age: 21,
    position: 'SS',
    handedness: 'L',
    salary: 0,
    vpeVal: 0,
    projectedDkPts: 0,
    level: 'AAA',
    ev: 90.5,
    ev50: 106.0,
    launchAngle: 13.0,
    barrelPct: 10.0,
    hardHitPct: 42.0,
    pullPct: 40.0,
    kPct: 20.0,
    bbPct: 11.0,
    velocity: 0,
    spinRate: 0,
    pitchMix: {},
    milbVpeVal: 1.8,
    expectedPlayingTime: 0.85,
    teamNeed: 0.70,
    positionalScarcity: 1.15,
    ...overrides,
  };
}

export function mockPitchingProspect(overrides?: Partial<MinorLeaguePlayerStats>): MinorLeaguePlayerStats {
  return {
    playerId: 'ML002',
    name: 'Paul Skenes',
    team: 'PIT',
    age: 22,
    position: 'SP',
    handedness: 'R',
    salary: 0,
    vpeVal: 0,
    projectedDkPts: 0,
    level: 'AAA',
    ev: 0,
    ev50: 0,
    launchAngle: 0,
    barrelPct: 0,
    hardHitPct: 0,
    pullPct: 0,
    kPct: 32.0,
    bbPct: 6.0,
    velocity: 99.0,
    spinRate: 2500,
    pitchMix: { fastball: 0.50, slider: 0.25, curve: 0.15, changeup: 0.10 },
    milbVpeVal: 2.2,
    expectedPlayingTime: 0.95,
    teamNeed: 0.90,
    positionalScarcity: 0.80,
    ...overrides,
  };
}

// ── Mock Weather ────────────────────────────────────────────────────────────

export function mockSummerWeather(): WeatherConditions {
  return {
    tempF: 85,
    windSpeedMph: 12,
    windDirectionDeg: 225, // SW — blowing out
    humidityPct: 45,
    isOutdoor: true,
    isDayGame: true,
  };
}

export function mockColdWeather(): WeatherConditions {
  return {
    tempF: 48,
    windSpeedMph: 18,
    windDirectionDeg: 0, // North — blowing in
    humidityPct: 65,
    isOutdoor: true,
    isDayGame: false,
  };
}

export function mockDomeWeather(): WeatherConditions {
  return {
    tempF: 72,
    windSpeedMph: 0,
    windDirectionDeg: 0,
    humidityPct: 50,
    isOutdoor: false,
    isDayGame: false,
  };
}
