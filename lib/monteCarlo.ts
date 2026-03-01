/**
 * Monte Carlo Game Simulator
 *
 * Uses Poisson-distributed run and home-run counts to simulate MLB games.
 * 20 000 simulations run in < 20 ms in V8 — safe to call from any API route.
 *
 * No external dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimulationParams {
  /** Expected runs per game for the home team */
  homeRunRate: number;
  /** Expected runs per game for the away team */
  awayRunRate: number;
  /** Expected home runs per game for the home team */
  homeHRRate: number;
  /** Expected home runs per game for the away team */
  awayHRRate: number;
  /** Number of simulations (default 20 000) */
  simulations?: number;
}

export interface SimulationResult {
  homeWinProbability: number;
  awayWinProbability: number;
  pushProbability: number;
  expectedTotal: number;
  expectedHomeRuns: number;
  p10Total: number;   // 10th-percentile game total
  p90Total: number;   // 90th-percentile game total
  /** Histogram: index = combined total, value = count */
  totalDistribution: number[];
  /** Histogram: index = combined HRs, value = count */
  hrDistribution: number[];
  simulations: number;
}

// ---------------------------------------------------------------------------
// Poisson random number generator
// ---------------------------------------------------------------------------

/**
 * Knuth's inverse-transform algorithm for Poisson random variables.
 * Exact (not approximation) for small λ; fine for λ < 30.
 */
function poisson(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// ---------------------------------------------------------------------------
// Main simulation
// ---------------------------------------------------------------------------

/**
 * Simulate N MLB games and return win probabilities, total distribution, and
 * HR distribution.
 *
 * Runs are modeled as Poisson(homeRunRate / awayRunRate) per game — a standard
 * approximation for team-level run scoring.
 * Home runs are modeled independently as Poisson(homeHRRate / awayHRRate).
 */
export function simulateGame(params: SimulationParams): SimulationResult {
  const {
    homeRunRate,
    awayRunRate,
    homeHRRate,
    awayHRRate,
    simulations = 20_000,
  } = params;

  // Validate inputs — clamp to reasonable MLB ranges
  const safeHome  = Math.max(0.5, Math.min(homeRunRate, 15));
  const safeAway  = Math.max(0.5, Math.min(awayRunRate, 15));
  const safeHomeHR = Math.max(0, Math.min(homeHRRate, 8));
  const safeAwayHR = Math.max(0, Math.min(awayHRRate, 8));

  let homeWins = 0;
  let awayWins = 0;
  let pushes   = 0;

  let totalRuns = 0;
  let totalHRs  = 0;

  // Histograms: index = count, capped at 30 to bound array size
  const totalDist = new Array<number>(31).fill(0);
  const hrDist    = new Array<number>(21).fill(0);

  const allTotals: number[] = [];

  for (let i = 0; i < simulations; i++) {
    const homeScore = poisson(safeHome);
    const awayScore = poisson(safeAway);
    const homeHRs   = poisson(safeHomeHR);
    const awayHRs   = poisson(safeAwayHR);

    const gameTotal = homeScore + awayScore;
    const gameHRs   = homeHRs  + awayHRs;

    totalRuns += gameTotal;
    totalHRs  += gameHRs;
    allTotals.push(gameTotal);

    totalDist[Math.min(gameTotal, 30)] += 1;
    hrDist[Math.min(gameHRs, 20)]      += 1;

    if (homeScore > awayScore) homeWins++;
    else if (awayScore > homeScore) awayWins++;
    else pushes++;
  }

  // Percentiles from sorted totals
  allTotals.sort((a, b) => a - b);
  const p10Total = allTotals[Math.floor(simulations * 0.10)];
  const p90Total = allTotals[Math.floor(simulations * 0.90)];

  return {
    homeWinProbability: parseFloat((homeWins / simulations).toFixed(4)),
    awayWinProbability: parseFloat((awayWins / simulations).toFixed(4)),
    pushProbability:    parseFloat((pushes   / simulations).toFixed(4)),
    expectedTotal:      parseFloat((totalRuns / simulations).toFixed(2)),
    expectedHomeRuns:   parseFloat((totalHRs  / simulations).toFixed(2)),
    p10Total,
    p90Total,
    totalDistribution:  totalDist,
    hrDistribution:     hrDist,
    simulations,
  };
}

// ---------------------------------------------------------------------------
// Helpers for card data
// ---------------------------------------------------------------------------

/**
 * Format SimulationResult as summary_metrics for a game_simulation_card.
 */
export function simulationToMetrics(
  result: SimulationResult,
  homeTeam: string,
  awayTeam: string,
): Array<{ label: string; value: string }> {
  return [
    { label: `${homeTeam} Win %`, value: `${(result.homeWinProbability * 100).toFixed(1)}%` },
    { label: `${awayTeam} Win %`, value: `${(result.awayWinProbability * 100).toFixed(1)}%` },
    { label: 'Expected Total',   value: result.expectedTotal.toFixed(1) },
    { label: 'Expected HRs',     value: result.expectedHomeRuns.toFixed(1) },
    { label: 'Total Range (80%)',value: `${result.p10Total}–${result.p90Total}` },
    { label: 'Simulations',      value: result.simulations.toLocaleString() },
  ];
}
