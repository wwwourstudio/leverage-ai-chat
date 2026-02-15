/**
 * Bayesian Updating for Player Projections
 * 
 * Uses Normal-Normal Conjugate Prior Update
 * Mathematically verified formula
 */

export interface BayesianPrior {
  mean: number;
  variance: number;
}

export interface BayesianUpdate {
  posteriorMean: number;
  posteriorVariance: number;
  credibleInterval: [number, number]; // 95% credible interval
}

/**
 * Update Bayesian prior with new sample data
 * Uses Normal-Normal conjugate update (mathematically correct)
 * 
 * @param priorMean - Prior mean estimate
 * @param priorVariance - Prior variance
 * @param sampleMean - Mean of new sample data
 * @param sampleVariance - Variance of new sample data
 * @param sampleSize - Number of observations in sample
 */
export function bayesianUpdate(
  priorMean: number,
  priorVariance: number,
  sampleMean: number,
  sampleVariance: number,
  sampleSize: number
): BayesianUpdate {
  // Convert to precisions (inverse variance)
  const precisionPrior = 1 / priorVariance;
  const precisionSample = sampleSize / sampleVariance;

  // Posterior variance (precision)
  const posteriorVariance = 1 / (precisionPrior + precisionSample);

  // Posterior mean (weighted average)
  const posteriorMean =
    posteriorVariance * (precisionPrior * priorMean + precisionSample * sampleMean);

  // Calculate 95% credible interval (±1.96 standard deviations)
  const posteriorStdDev = Math.sqrt(posteriorVariance);
  const credibleInterval: [number, number] = [
    posteriorMean - 1.96 * posteriorStdDev,
    posteriorMean + 1.96 * posteriorStdDev,
  ];

  return {
    posteriorMean,
    posteriorVariance,
    credibleInterval,
  };
}

/**
 * Update player projection based on recent performance
 */
export function updatePlayerProjection(
  seasonMean: number,
  seasonVariance: number,
  recentGames: number[],
  gameWeights?: number[] // Optional weights for recency
): BayesianUpdate {
  if (recentGames.length === 0) {
    return {
      posteriorMean: seasonMean,
      posteriorVariance: seasonVariance,
      credibleInterval: [seasonMean - 1.96 * Math.sqrt(seasonVariance), seasonMean + 1.96 * Math.sqrt(seasonVariance)],
    };
  }

  // Calculate sample statistics
  const weights = gameWeights || recentGames.map(() => 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Weighted mean
  const sampleMean =
    recentGames.reduce((sum, val, idx) => sum + val * weights[idx], 0) / totalWeight;

  // Weighted variance
  const sampleVariance =
    recentGames.reduce(
      (sum, val, idx) => sum + weights[idx] * Math.pow(val - sampleMean, 2),
      0
    ) / totalWeight;

  return bayesianUpdate(seasonMean, seasonVariance, sampleMean, sampleVariance, recentGames.length);
}

/**
 * Calculate credibility score for a projection
 * Higher score = more data / lower uncertainty
 */
export function calculateCredibility(
  posteriorVariance: number,
  sampleSize: number
): number {
  // Lower variance and more samples = higher credibility
  const varianceScore = Math.exp(-posteriorVariance / 10); // Normalize to 0-1
  const sampleScore = Math.min(sampleSize / 20, 1); // Cap at 20 games

  return (varianceScore + sampleScore) / 2;
}
