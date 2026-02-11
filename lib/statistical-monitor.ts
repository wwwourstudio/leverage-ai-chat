/**
 * Statistical Monitoring System
 * Real-time collection, validation, and anomaly detection for AI-generated outputs
 */

import { validateBenford } from './benford-validator';
import { validateOddsAlignment } from './odds-alignment';

export interface StatisticalSnapshot {
  timestamp: Date;
  datasetId: string;
  values: number[];
  benfordScore: number;
  oddsAlignmentScore: number;
  anomaliesDetected: string[];
  confidence: 'high' | 'medium' | 'low';
  distribution: Record<string, number>;
}

export interface Alert {
  severity: 'critical' | 'warning' | 'info';
  type: 'benford_deviation' | 'odds_misalignment' | 'sample_size' | 'outlier_detected';
  message: string;
  timestamp: Date;
  metrics: Record<string, any>;
}

/**
 * Collect and validate AI outputs
 */
export async function collectAndValidate(
  values: number[],
  datasetId: string,
  marketOdds?: Array<{ aiOdds: number; marketOdds: number[] }>
): Promise<{ snapshot: StatisticalSnapshot; alerts: Alert[] }> {
  console.log(`[v0] [Stats Monitor] Collecting ${values.length} values for ${datasetId}`);
  
  const alerts: Alert[] = [];
  
  // Benford validation
  const benfordResult = validateBenford(values);
  
  if (!benfordResult.isValid) {
    alerts.push({
      severity: benfordResult.score < 0.5 ? 'critical' : 'warning',
      type: 'benford_deviation',
      message: `Benford's Law violation detected. Score: ${benfordResult.score.toFixed(3)}, Chi-Square: ${benfordResult.chiSquare.toFixed(2)}`,
      timestamp: new Date(),
      metrics: {
        score: benfordResult.score,
        chiSquare: benfordResult.chiSquare,
        confidence: benfordResult.confidence
      }
    });
  }
  
  // Odds alignment validation
  let oddsAlignmentScore = 1.0;
  if (marketOdds && marketOdds.length > 0) {
    const alignmentResult = validateOddsAlignment(marketOdds);
    oddsAlignmentScore = alignmentResult.overallScore;
    
    if (alignmentResult.outliers > alignmentResult.totalPredictions * 0.2) {
      alerts.push({
        severity: 'warning',
        type: 'odds_misalignment',
        message: `${alignmentResult.outliers} outliers detected out of ${alignmentResult.totalPredictions} predictions`,
        timestamp: new Date(),
        metrics: {
          outliers: alignmentResult.outliers,
          averageDeviation: alignmentResult.averageDeviation
        }
      });
    }
  }
  
  // Sample size check
  if (values.length < 30) {
    alerts.push({
      severity: 'info',
      type: 'sample_size',
      message: `Small sample size (${values.length}). Results may not be statistically significant.`,
      timestamp: new Date(),
      metrics: { sampleSize: values.length }
    });
  }
  
  // Determine overall confidence
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (benfordResult.confidence === 'low' || oddsAlignmentScore < 0.7) {
    confidence = 'low';
  } else if (benfordResult.confidence === 'medium' || oddsAlignmentScore < 0.85) {
    confidence = 'medium';
  }
  
  const snapshot: StatisticalSnapshot = {
    timestamp: new Date(),
    datasetId,
    values,
    benfordScore: benfordResult.score,
    oddsAlignmentScore,
    anomaliesDetected: alerts.map(a => a.type),
    confidence,
    distribution: benfordResult.distribution
  };
  
  console.log(`[v0] [Stats Monitor] Snapshot created. Benford: ${benfordResult.score.toFixed(3)}, Alignment: ${oddsAlignmentScore.toFixed(3)}, Alerts: ${alerts.length}`);
  
  return { snapshot, alerts };
}

/**
 * Log alert to console and potentially external systems
 */
export async function logAlert(alert: Alert): Promise<void> {
  const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`[v0] [Alert] ${emoji} [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`);
  
  // In production, this would send to alerting system (Sentry, PagerDuty, etc.)
  // For now, just console logging
}

/**
 * Calculate Z-score for anomaly detection
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(values: number[]): { outliers: number[]; indices: number[] } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const outliers: number[] = [];
  const indices: number[] = [];
  
  values.forEach((v, i) => {
    if (v < lowerBound || v > upperBound) {
      outliers.push(v);
      indices.push(i);
    }
  });
  
  console.log(`[v0] [Outlier Detection] Found ${outliers.length} outliers out of ${values.length} values`);
  
  return { outliers, indices };
}
