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
  if (v >= 80) return 'text-emerald-400';
  if (v >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function barFill(v: number) {
  if (v >= 80) return 'bg-emerald-500';
  if (v >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export function TrustMetricsDisplay({ metrics, compact = false, showDetails = true }: TrustMetricsDisplayProps) {
  if (compact) {
    const TrustIcon = metrics.trustLevel === 'high' ? CheckCircle2 : metrics.trustLevel === 'medium' ? Info : AlertTriangle;
    return (
      <div className="flex items-center gap-3 text-sm">
        <div className={`flex items-center gap-1.5 ${scoreColor(metrics.finalConfidence)}`}>
          <TrustIcon className="w-4 h-4" />
          <span className="font-medium capitalize">{metrics.trustLevel} Trust</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Activity className="w-4 h-4" />
          <span>{metrics.finalConfidence}% Confidence</span>
        </div>
      </div>
    );
  }

  const riskStyle =
    metrics.riskLevel === 'low'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
      : metrics.riskLevel === 'medium'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
      : 'bg-red-500/15 text-red-400 border-red-500/25';

  return (
    <div className="space-y-2.5">
      {/* Composite integrity bar */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-900/50 border border-gray-800/60">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Integrity Score</span>
            <span className={`text-[13px] font-black tabular-nums ${scoreColor(metrics.finalConfidence)}`}>
              {metrics.finalConfidence}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${barFill(metrics.finalConfidence)} transition-all duration-700 rounded-full`}
              style={{ width: `${metrics.finalConfidence}%` }}
            />
          </div>
        </div>
        <div className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${riskStyle}`}>
          {metrics.riskLevel} risk
        </div>
      </div>

      {/* Per-metric rows with mini progress bars */}
      {showDetails && (
        <div className="space-y-1.5">
          {METRIC_DEFS.map(({ key, label, icon: Icon, description }) => {
            const val = metrics[key];
            return (
              <div
                key={key}
                className="px-2.5 py-2 rounded-lg bg-gray-900/30 border border-gray-800/40"
                title={description}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3 text-gray-600" />
                    <span className="text-[10px] text-gray-500 font-semibold">{label}</span>
                  </div>
                  <span className={`text-[11px] font-bold tabular-nums ${scoreColor(val)}`}>{val}%</span>
                </div>
                <div className="h-[3px] bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barFill(val)} transition-all duration-500`}
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
          <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
            {metrics.flags.length} issue{metrics.flags.length !== 1 ? 's' : ''} flagged
          </div>
          {metrics.flags.map((flag, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] ${
                flag.severity === 'error'
                  ? 'bg-red-600/10 border-red-600/20 text-red-400'
                  : flag.severity === 'warning'
                  ? 'bg-amber-600/10 border-amber-600/20 text-amber-400'
                  : 'bg-blue-600/10 border-blue-600/20 text-blue-400'
              }`}
            >
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold capitalize">{flag.type}</div>
                <div className="text-gray-500 mt-0.5">{flag.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attribution */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-gray-800/60">
        <Shield className="w-3 h-3 text-gray-700" />
        <span className="text-[10px] text-gray-700">
          Validated by Grok AI · Live odds data · Benford&apos;s Law analysis
        </span>
      </div>
    </div>
  );
}

export function TrustMetricsBadge({ metrics }: { metrics: TrustMetrics }) {
  const colors: Record<string, string> = {
    high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${colors[metrics.trustLevel] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
      <Shield className="w-3 h-3" />
      <span>{metrics.trustLevel.toUpperCase()}</span>
      <span className="opacity-60">•</span>
      <span>{metrics.finalConfidence}%</span>
    </div>
  );
}
