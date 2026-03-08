/**
 * VPE 3.0 — Constants
 * =====================
 * Park factors, MiLB translation factors, DFS scoring,
 * and Markov pitch-sequencing transition matrices.
 */

import type { ParkFactors, MiLBLevel } from './types';

// ── Park Factors (2025 MLB) ─────────────────────────────────────────────────

export const PARK_FACTORS: Record<string, ParkFactors> = {
  COL: { hr: 1.22, runs: 1.18, k: 0.95, name: 'Coors Field' },
  CIN: { hr: 1.15, runs: 1.08, k: 0.98, name: 'Great American' },
  TEX: { hr: 1.08, runs: 1.05, k: 1.00, name: 'Globe Life' },
  TOR: { hr: 1.10, runs: 1.04, k: 1.01, name: 'Rogers Centre' },
  BOS: { hr: 0.96, runs: 1.06, k: 0.97, name: 'Fenway Park' },
  CHC: { hr: 1.00, runs: 1.00, k: 1.00, name: 'Wrigley Field' },
  NYY: { hr: 1.12, runs: 1.03, k: 1.02, name: 'Yankee Stadium' },
  PHI: { hr: 1.05, runs: 1.02, k: 1.01, name: 'Citizens Bank' },
  ATL: { hr: 1.03, runs: 1.01, k: 1.00, name: 'Truist Park' },
  MIL: { hr: 1.06, runs: 1.03, k: 0.99, name: 'American Family' },
  MIN: { hr: 1.04, runs: 1.02, k: 1.01, name: 'Target Field' },
  BAL: { hr: 1.07, runs: 1.04, k: 0.99, name: 'Camden Yards' },
  CWS: { hr: 1.05, runs: 1.01, k: 1.02, name: 'Guaranteed Rate' },
  LAA: { hr: 0.98, runs: 0.99, k: 1.01, name: 'Angel Stadium' },
  WSH: { hr: 0.97, runs: 0.99, k: 1.00, name: 'Nationals Park' },
  DET: { hr: 0.95, runs: 0.98, k: 1.01, name: 'Comerica Park' },
  KC:  { hr: 0.93, runs: 0.97, k: 1.00, name: 'Kauffman Stadium' },
  STL: { hr: 0.96, runs: 0.99, k: 1.01, name: 'Busch Stadium' },
  SEA: { hr: 0.94, runs: 0.97, k: 1.02, name: 'T-Mobile Park' },
  LAD: { hr: 0.95, runs: 0.98, k: 1.01, name: 'Dodger Stadium' },
  NYM: { hr: 0.93, runs: 0.96, k: 1.03, name: 'Citi Field' },
  TB:  { hr: 0.92, runs: 0.96, k: 1.02, name: 'Tropicana Field' },
  SF:  { hr: 0.87, runs: 0.94, k: 1.03, name: 'Oracle Park' },
  PIT: { hr: 0.90, runs: 0.96, k: 1.01, name: 'PNC Park' },
  CLE: { hr: 0.93, runs: 0.97, k: 1.02, name: 'Progressive' },
  OAK: { hr: 0.88, runs: 0.95, k: 1.02, name: 'Oakland Coliseum' },
  SD:  { hr: 0.85, runs: 0.92, k: 1.04, name: 'Petco Park' },
  HOU: { hr: 1.00, runs: 1.00, k: 1.00, name: 'Minute Maid' },
  MIA: { hr: 0.88, runs: 0.94, k: 1.03, name: 'LoanDepot Park' },
  ARI: { hr: 1.04, runs: 1.03, k: 0.99, name: 'Chase Field' },
};

export const NEUTRAL_PARK: ParkFactors = { hr: 1.0, runs: 1.0, k: 1.0, name: 'Neutral' };

export function getParkFactors(team: string): ParkFactors {
  return PARK_FACTORS[team.toUpperCase()] ?? NEUTRAL_PARK;
}

// ── Indoor stadiums (weather-neutral) ───────────────────────────────────────

export const INDOOR_TEAMS = new Set(['TB', 'MIA', 'HOU', 'SEA', 'TOR', 'ARI', 'MIN']);

// ── MiLB Translation Factors ────────────────────────────────────────────────

export const MILB_TRANSLATION: Record<MiLBLevel, number> = {
  'AAA': 0.90,
  'AA': 0.75,
  'High-A': 0.60,
  'Low-A': 0.50,
};

// ── DraftKings Scoring ──────────────────────────────────────────────────────

export const DK_SCORING = {
  hitter: {
    single: 3,
    double: 5,
    triple: 8,
    hr: 10,
    rbi: 2,
    run: 2,
    bb: 2,
    sb: 5,
    k: -0.5,
  },
  pitcher: {
    out: 0.75,      // 2.25 per IP
    k: 2,
    win: 4,
    er: -2,
    hit: -0.6,
    bb: -0.6,
  },
} as const;

// ── Pitch Sequencing Transition Matrix ──────────────────────────────────────

export const PITCH_TRANSITIONS: Record<string, Record<string, number>> = {
  fastball:  { fastball: 0.35, slider: 0.25, curve: 0.15, changeup: 0.25 },
  slider:    { fastball: 0.45, slider: 0.20, curve: 0.15, changeup: 0.20 },
  curve:     { fastball: 0.50, slider: 0.20, curve: 0.10, changeup: 0.20 },
  changeup:  { fastball: 0.50, slider: 0.20, curve: 0.15, changeup: 0.15 },
};

export const COUNT_ADJUSTMENTS: Record<string, Record<string, number>> = {
  behind:      { fastball: 0.15, slider: -0.05, curve: -0.05, changeup: -0.05 },
  even:        { fastball: 0.0, slider: 0.0, curve: 0.0, changeup: 0.0 },
  ahead:       { fastball: -0.10, slider: 0.05, curve: 0.02, changeup: 0.03 },
  two_strikes: { fastball: -0.15, slider: 0.10, curve: 0.03, changeup: 0.02 },
};
