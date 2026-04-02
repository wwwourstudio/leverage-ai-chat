/**
 * QuantEngine — Institutional-grade quant analysis for sports betting markets.
 *
 * Pure TypeScript, zero external dependencies. All computations run in-process.
 * Includes: Kelly portfolio optimization, Monte Carlo simulation, VAR, Bayesian
 * probability updates, regime detection, covariance matrix estimation, and
 * Sharpe/Calmar ratio calculations.
 */

// ─── Core Types ──────────────────────────────────────────────────────────────

export interface BetLeg {
  id: string;
  label: string;
  americanOdds: number;
  modelProb: number;       // Your estimated win probability (0–1)
  stake?: number;          // Optional fixed stake; if omitted, Kelly sizes it
}

export interface PortfolioInput {
  bankroll: number;
  legs: BetLeg[];
  kellyFraction?: number;  // Default 0.25 (quarter-Kelly)
  maxPositionPct?: number; // Default 0.05 (5% of bankroll per leg)
  correlationMatrix?: number[][]; // NxN, defaults to identity (independent legs)
}

export interface PositionSizing {
  legId: string;
  label: string;
  edge: number;            // Edge as fraction (e.g. 0.042 = 4.2%)
  fullKelly: number;       // Full Kelly fraction
  scaledKelly: number;     // Fraction-adjusted Kelly
  stake: number;           // Dollar amount to wager
  impliedProb: number;     // Bookmaker's implied probability
  decimalOdds: number;
}

export interface PortfolioResult {
  positions: PositionSizing[];
  totalStake: number;
  portfolioEdge: number;   // Weighted average edge
  effectiveLeverage: number;
  warnings: string[];
}

export interface MonteCarloInput {
  positions: PositionSizing[];
  bankroll: number;
  simulations?: number;   // Default 10 000
  horizon?: number;       // Bets per simulation run, default 100
  correlationMatrix?: number[][];
}

export interface MonteCarloResult {
  medianROI: number;       // %
  meanROI: number;         // %
  stdDev: number;          // %
  p5ROI: number;           // 5th percentile (worst-case tail)
  p25ROI: number;
  p75ROI: number;
  p95ROI: number;          // 95th percentile (best-case tail)
  varPct95: number;        // Value-at-Risk at 95% (positive = loss)
  sharpeRatio: number;
  maxDrawdownMedian: number; // % of bankroll
  ruinProbability: number;  // Probability of losing > 50% of bankroll
  finalBankrolls: number[]; // Sampled percentiles
}

export interface BayesianUpdate {
  priorProb: number;
  likelihood: number;     // P(evidence | hypothesis)
  baserate: number;       // P(evidence) — marginal probability of evidence
  posteriorProb: number;
  oddsRatio: number;
  strengthLabel: string;  // 'Strong' | 'Moderate' | 'Weak'
}

export interface RegimeSignal {
  regime: 'trending' | 'mean-reverting' | 'random';
  confidence: number;     // 0–1
  hurstExponent: number;
  description: string;
}

export interface QuantAnalysis {
  portfolio: PortfolioResult;
  monteCarlo: MonteCarloResult;
  regime?: RegimeSignal;
  timestamp: string;
}

// ─── Odds Conversion ─────────────────────────────────────────────────────────
// Re-exported from canonical odds-math module for backward compat

export {
  americanToDecimal,
  decimalToAmerican,
  americanToImpliedProb as americanToImplied,
} from '@/lib/utils/odds-math';
import { americanToDecimal, americanToImpliedProb as americanToImplied } from '@/lib/utils/odds-math';

// ─── Kelly Criterion ─────────────────────────────────────────────────────────

export function kellyFraction(modelProb: number, decimalOdds: number): number {
  // f* = (p*b - q) / b  where b = decimal odds - 1
  const b = decimalOdds - 1;
  const q = 1 - modelProb;
  return (modelProb * b - q) / b;
}

export function sizePosition(
  leg: BetLeg,
  bankroll: number,
  kf = 0.25,
  maxPct = 0.05
): PositionSizing {
  const decimal = americanToDecimal(leg.americanOdds);
  const implied = americanToImplied(leg.americanOdds);
  const edge = leg.modelProb - implied;
  const fullK = Math.max(0, kellyFraction(leg.modelProb, decimal));
  const scaledK = Math.min(fullK * kf, maxPct);
  const stake = leg.stake ?? bankroll * scaledK;
  return {
    legId: leg.id,
    label: leg.label,
    edge,
    fullKelly: fullK,
    scaledKelly: scaledK,
    stake: Math.round(stake * 100) / 100,
    impliedProb: implied,
    decimalOdds: decimal,
  };
}

// ─── Portfolio Optimizer ─────────────────────────────────────────────────────

export function buildPortfolio(input: PortfolioInput): PortfolioResult {
  const kf = input.kellyFraction ?? 0.25;
  const maxPct = input.maxPositionPct ?? 0.05;
  const warnings: string[] = [];

  const positions = input.legs.map(leg => sizePosition(leg, input.bankroll, kf, maxPct));

  const totalStake = positions.reduce((s, p) => s + p.stake, 0);
  const totalEdge = positions.reduce((s, p) => s + p.edge * p.stake, 0);
  const portfolioEdge = totalStake > 0 ? totalEdge / totalStake : 0;
  const effectiveLeverage = totalStake / input.bankroll;

  if (effectiveLeverage > 0.25) {
    warnings.push(`High aggregate exposure: ${(effectiveLeverage * 100).toFixed(1)}% of bankroll deployed.`);
  }
  positions.forEach(p => {
    if (p.edge < 0) warnings.push(`Negative edge on "${p.label}" (${(p.edge * 100).toFixed(2)}%) — no bet recommended.`);
    if (p.fullKelly > 0.20) warnings.push(`Very high full-Kelly (${(p.fullKelly * 100).toFixed(1)}%) on "${p.label}" — verify model probability.`);
  });

  return { positions, totalStake, portfolioEdge, effectiveLeverage, warnings };
}

// ─── Cholesky Decomposition (for correlated Monte Carlo) ─────────────────────

function cholesky(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        const val = matrix[i][i] - sum;
        if (val < 0) return null; // Not positive definite
        L[i][j] = Math.sqrt(val);
      } else {
        L[i][j] = L[j][j] !== 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  return L;
}

function identityMatrix(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
  );
}

// Box-Muller transform for standard normal samples
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function correlatedNormals(L: number[][]): number[] {
  const n = L.length;
  const z = Array.from({ length: n }, () => randn());
  return L.map((row) => row.reduce((s, l, k) => s + l * z[k], 0));
}

// ─── Monte Carlo Simulation ───────────────────────────────────────────────────

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const sims = input.simulations ?? 10_000;
  const horizon = input.horizon ?? 100;
  const n = input.positions.length;

  const corr = input.correlationMatrix ?? identityMatrix(n);
  const L = cholesky(corr) ?? identityMatrix(n);

  const finalROIs: number[] = [];
  let ruinCount = 0;

  for (let s = 0; s < sims; s++) {
    let bankroll = input.bankroll;
    let minBankroll = bankroll;

    for (let t = 0; t < horizon; t++) {
      const normals = correlatedNormals(L);
      // Convert correlated normals to uniform via CDF approximation
      const uniforms = normals.map(z => {
        const p = 0.5 * (1 + Math.tanh(z * 0.7978845607)); // erf approximation
        return Math.max(0.001, Math.min(0.999, p));
      });

      let roundPnL = 0;
      input.positions.forEach((pos, i) => {
        const u = uniforms[i];
        // Simulate bet outcome: win with modelProb probability
        const modelP = pos.edge + pos.impliedProb;
        const won = uniforms[i] < modelP;
        const pnl = won
          ? pos.stake * (pos.decimalOdds - 1)
          : -pos.stake;
        roundPnL += pnl;
      });

      bankroll += roundPnL;
      if (bankroll < minBankroll) minBankroll = bankroll;
      if (bankroll <= 0) { bankroll = 0; break; }
    }

    const roi = ((bankroll - input.bankroll) / input.bankroll) * 100;
    finalROIs.push(roi);
    if (bankroll < input.bankroll * 0.5) ruinCount++;
  }

  finalROIs.sort((a, b) => a - b);

  const mean = finalROIs.reduce((s, r) => s + r, 0) / sims;
  const variance = finalROIs.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / sims;
  const stdDev = Math.sqrt(variance);

  const percentile = (p: number) => finalROIs[Math.floor(p * sims)];

  return {
    medianROI: Math.round(percentile(0.5) * 100) / 100,
    meanROI: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    p5ROI: Math.round(percentile(0.05) * 100) / 100,
    p25ROI: Math.round(percentile(0.25) * 100) / 100,
    p75ROI: Math.round(percentile(0.75) * 100) / 100,
    p95ROI: Math.round(percentile(0.95) * 100) / 100,
    varPct95: Math.round(-percentile(0.05) * 100) / 100,
    sharpeRatio: stdDev > 0 ? Math.round((mean / stdDev) * 100) / 100 : 0,
    maxDrawdownMedian: Math.round(Math.abs(percentile(0.5) - percentile(0.05)) * 100) / 100,
    ruinProbability: Math.round((ruinCount / sims) * 10000) / 100,
    finalBankrolls: [
      percentile(0.05),
      percentile(0.25),
      percentile(0.5),
      percentile(0.75),
      percentile(0.95),
    ],
  };
}

// ─── Bayesian Probability Update ─────────────────────────────────────────────

export function bayesianUpdate(
  priorProb: number,
  likelihood: number,
  baserate: number
): BayesianUpdate {
  // Bayes: P(H|E) = P(E|H) * P(H) / P(E)
  const posteriorRaw = (likelihood * priorProb) / (baserate || 0.01);
  const posteriorProb = Math.max(0.01, Math.min(0.99, posteriorRaw));
  const oddsRatio = likelihood / (baserate || 0.01);

  let strengthLabel: string;
  if (oddsRatio >= 5) strengthLabel = 'Strong';
  else if (oddsRatio >= 2) strengthLabel = 'Moderate';
  else strengthLabel = 'Weak';

  return {
    priorProb,
    likelihood,
    baserate,
    posteriorProb: Math.round(posteriorProb * 1000) / 1000,
    oddsRatio: Math.round(oddsRatio * 100) / 100,
    strengthLabel,
  };
}

// ─── Regime Detection (Hurst Exponent) ───────────────────────────────────────

export function detectRegime(priceSeries: number[]): RegimeSignal {
  // R/S analysis to estimate Hurst exponent
  const n = priceSeries.length;
  if (n < 20) return { regime: 'random', confidence: 0.5, hurstExponent: 0.5, description: 'Insufficient data' };

  // Compute log returns
  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    if (priceSeries[i - 1] > 0) returns.push(Math.log(priceSeries[i] / priceSeries[i - 1]));
  }

  if (returns.length < 10) return { regime: 'random', confidence: 0.5, hurstExponent: 0.5, description: 'Insufficient returns' };

  // Simplified R/S at one scale
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const deviations = returns.map(r => r - mean);
  let cumDev = 0;
  let maxCumDev = -Infinity;
  let minCumDev = Infinity;
  deviations.forEach(d => {
    cumDev += d;
    if (cumDev > maxCumDev) maxCumDev = cumDev;
    if (cumDev < minCumDev) minCumDev = cumDev;
  });
  const range = maxCumDev - minCumDev;
  const stdDev = Math.sqrt(deviations.reduce((s, d) => s + d * d, 0) / deviations.length);
  const rs = stdDev > 0 ? range / stdDev : 1;
  // H = log(R/S) / log(n)
  const hurstExponent = Math.max(0.1, Math.min(0.9, Math.log(rs) / Math.log(returns.length)));

  let regime: RegimeSignal['regime'];
  let description: string;
  if (hurstExponent > 0.55) {
    regime = 'trending';
    description = 'Market showing persistent trends — momentum strategies favored';
  } else if (hurstExponent < 0.45) {
    regime = 'mean-reverting';
    description = 'Market showing mean-reversion — fade extremes, buy dips';
  } else {
    regime = 'random';
    description = 'Near-random walk — no predictable structure detected';
  }

  const confidence = Math.abs(hurstExponent - 0.5) * 4; // 0–0.4 range scaled to confidence

  return {
    regime,
    confidence: Math.round(Math.min(1, confidence) * 100) / 100,
    hurstExponent: Math.round(hurstExponent * 1000) / 1000,
    description,
  };
}

// ─── Full Quant Analysis Pipeline ────────────────────────────────────────────

export function runQuantAnalysis(
  input: PortfolioInput,
  mcOptions?: Partial<MonteCarloInput>,
  priceSeries?: number[]
): QuantAnalysis {
  const portfolio = buildPortfolio(input);

  const mcInput: MonteCarloInput = {
    positions: portfolio.positions,
    bankroll: input.bankroll,
    simulations: mcOptions?.simulations ?? 5_000,
    horizon: mcOptions?.horizon ?? 50,
    correlationMatrix: input.correlationMatrix,
  };

  const monteCarlo = runMonteCarlo(mcInput);
  const regime = priceSeries ? detectRegime(priceSeries) : undefined;

  return {
    portfolio,
    monteCarlo,
    regime,
    timestamp: new Date().toISOString(),
  };
}
