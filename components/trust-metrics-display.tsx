'use client';

import React from 'react';
import { Shield, AlertTriangle, CheckCircle2, TrendingUp, Activity, BarChart3, Info } from 'lucide-react';

export interface TrustMetrics {
  benfordIntegrity: number;
  oddsAlignment: number;
  marketConsensus: number;
  historicalAccuracy: number;
  finalConfidence: number;
  trustLevel: 'high' | 'medium' | 'low';
  flags?: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  adjustedTone?: string;
}

interface TrustMetricsDisplayProps {
  metrics: TrustMetrics;
  compact?: boolean;
  showDetails?: boolean;
}

const METRIC_DEFS: Array<{
  key: keyof Pick<TrustMetrics, 'benfordIntegrity' | 'oddsAlignment' | 'marketConsensus' | 'historicalAccuracy'>;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    key: 'benfordIntegrity',
    label: "Benford Integrity",
    icon: BarChart3,
    description: "Benford's Law digit-distribution test — flags artificially generated or manipulated odds patterns",
  },
  {
    key: 'oddsAlignment',
    label: 'Odds Alignment',
    icon: TrendingUp,
    description: 'Consistency of odds across multiple sportsbooks',
  },
  {
    key: 'marketConsensus',
    label: 'Market Consensus',
    icon: Activity,
    description: 'Degree of agreement between bookmakers on the current line',
  },
  {
    key: 'historicalAccuracy',
    label: 'Historical Accuracy',
    icon: CheckCircle2,
    description: "Model's track record against prior similar predictions",
  },
];

function scoreColor(v: number) {
  if (v >= 80) return 'text-[oklch(0.92_0.005_85)]';
  if (v >= 60) return 'text-[oklch(0.70_0.005_85)]';
  return 'text-[oklch(0.50_0.005_85)]';
}

function barFill(v: number) {
  if (v >= 80) return 'bg-[oklch(0.85_0.005_85)]';
  if (v >= 60) return 'bg-[oklch(0.55_0.005_85)]';
  return 'bg-[oklch(0.35_0.005_85)]';
}

function scoreLabel(v: number) {
  if (v >= 90) return 'Excellent';
  if (v >= 80) return 'Strong';
  if (v >= 60) return 'Fair';
  return 'Weak';
}

export function TrustMetricsDisplay({ metrics, compact = false, showDetails = true }: TrustMetricsDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <div className={`flex items-center gap-1.5 ${scoreColor(metrics.finalConfidence)}`}>
          <Shield className="w-4 h-4" />
          <span className="font-medium capitalize">{metrics.trustLevel} Trust</span>
        </div>
        <div className="flex items-center gap-1.5 text-[oklch(0.50_0.005_85)]">
          <Activity className="w-4 h-4" />
          <span className="tabular-nums">{metrics.finalConfidence}%</span>
        </div>
      </div>
    );
  }

  const riskStyle =
    metrics.riskLevel === 'low'
      ? 'bg-[oklch(0.18_0.005_85)] text-[oklch(0.80_0.005_85)] border-[oklch(0.25_0.005_85)]'
      : metrics.riskLevel === 'medium'
      ? 'bg-[oklch(0.15_0.005_85)] text-[oklch(0.65_0.005_85)] border-[oklch(0.22_0.005_85)]'
      : 'bg-[oklch(0.12_0.005_85)] text-[oklch(0.50_0.005_85)] border-[oklch(0.20_0.005_85)]';

  return (
    <div className="space-y-2.5">
      {/* Composite integrity score */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[oklch(0.45_0.01_280)] uppercase tracking-widest">Integrity Score</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-black tabular-nums ${scoreColor(metrics.finalConfidence)}`}>
                {metrics.finalConfidence}%
              </span>
              <span className="text-[10px] text-[oklch(0.40_0.01_280)]">{scoreLabel(metrics.finalConfidence)}</span>
            </div>
          </div>
          <div className="h-1 bg-[oklch(0.16_0.01_280)] rounded-full overflow-hidden">
            <div
              className={`h-full ${barFill(metrics.finalConfidence)} transition-all duration-700 rounded-full`}
              style={{ width: `${metrics.finalConfidence}%` }}
            />
          </div>
        </div>
        <div className={`shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${riskStyle}`}>
          {metrics.riskLevel}
        </div>
      </div>

      {/* Per-metric rows */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-2">
          {METRIC_DEFS.map(({ key, label, icon: Icon, description }) => {
            const val = metrics[key];
            return (
              <div
                key={key}
                className="px-3 py-2.5 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)]"
                title={description}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="w-3 h-3 text-[oklch(0.40_0.01_280)]" />
                  <span className="text-[10px] text-[oklch(0.45_0.01_280)] font-semibold">{label}</span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-1.5">
                  <span className={`text-lg font-black tabular-nums ${scoreColor(val)}`}>{val}%</span>
                  <span className="text-[9px] text-[oklch(0.40_0.01_280)]">{scoreLabel(val)}</span>
                </div>
                <div className="h-[3px] bg-[oklch(0.16_0.01_280)] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barFill(val)} transition-all duration-500 rounded-full`}
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Adjusted tone */}
      {metrics.adjustedTone && (
        <div className="text-[10px] text-gray-600 px-1">
          Analysis tone: <span className="text-gray-500 font-semibold">{metrics.adjustedTone}</span>
        </div>
      )}

      {/* Flags */}
      {metrics.flags && metrics.flags.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-[oklch(0.40_0.01_280)] uppercase tracking-wide">
            {metrics.flags.length} issue{metrics.flags.length !== 1 ? 's' : ''} flagged
          </div>
          {metrics.flags.map((flag, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] ${
                flag.severity === 'error'
                  ? 'bg-[oklch(0.12_0.01_280)] border-[oklch(0.22_0.01_280)] text-[oklch(0.60_0.005_85)]'
                  : flag.severity === 'warning'
                  ? 'bg-[oklch(0.12_0.01_280)] border-[oklch(0.20_0.01_280)] text-[oklch(0.55_0.005_85)]'
                  : 'bg-[oklch(0.12_0.01_280)] border-[oklch(0.20_0.01_280)] text-[oklch(0.50_0.005_85)]'
              }`}
            >
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold capitalize">{flag.type}</div>
                <div className="text-[oklch(0.40_0.01_280)] mt-0.5">{flag.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attribution */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-[oklch(0.18_0.01_280)]">
        <Shield className="w-3 h-3 text-[oklch(0.30_0.01_280)]" />
        <span className="text-[10px] text-[oklch(0.35_0.01_280)]">
          Validated by Grok AI · Live odds data · Benford&apos;s Law analysis
        </span>
      </div>
    </div>
  );
}

export function TrustMetricsBadge({ metrics }: { metrics: TrustMetrics }) {
  const intensity: Record<string, string> = {
    high: 'bg-[oklch(0.16_0.005_85)] text-[oklch(0.85_0.005_85)] border-[oklch(0.25_0.005_85)]',
    medium: 'bg-[oklch(0.14_0.005_85)] text-[oklch(0.65_0.005_85)] border-[oklch(0.22_0.005_85)]',
    low: 'bg-[oklch(0.12_0.005_85)] text-[oklch(0.50_0.005_85)] border-[oklch(0.20_0.005_85)]',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${intensity[metrics.trustLevel] ?? intensity.medium}`}>
      <Shield className="w-3 h-3" />
      <span>{metrics.trustLevel.toUpperCase()}</span>
      <span className="opacity-40">|</span>
      <span className="tabular-nums">{metrics.finalConfidence}%</span>
    </div>
  );
}
