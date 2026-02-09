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

export function TrustMetricsDisplay({ metrics, compact = false, showDetails = true }: TrustMetricsDisplayProps) {
  const getTrustColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-emerald-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-red-500';
      default: return 'text-slate-400';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-500';
      case 'medium': return 'text-amber-500';
      case 'high': return 'text-red-500';
      default: return 'text-slate-400';
    }
  };

  const getTrustIcon = (level: string) => {
    switch (level) {
      case 'high': return <CheckCircle2 className="w-4 h-4" />;
      case 'medium': return <Info className="w-4 h-4" />;
      case 'low': return <AlertTriangle className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500/10';
    if (score >= 70) return 'bg-amber-500/10';
    return 'bg-red-500/10';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <div className={`flex items-center gap-1.5 ${getTrustColor(metrics.trustLevel)}`}>
          {getTrustIcon(metrics.trustLevel)}
          <span className="font-medium capitalize">{metrics.trustLevel} Trust</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Activity className="w-4 h-4" />
          <span>{metrics.finalConfidence}% Confidence</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Trust Level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={getTrustColor(metrics.trustLevel)}>
            {getTrustIcon(metrics.trustLevel)}
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              <span className={getTrustColor(metrics.trustLevel)}>
                {metrics.trustLevel.toUpperCase()}
              </span>
              {' '}Trust Level
            </div>
            <div className="text-xs text-slate-400">
              Final Confidence: {metrics.finalConfidence}%
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">
            <span className={getRiskColor(metrics.riskLevel)}>
              {metrics.riskLevel.toUpperCase()}
            </span>
            {' '}Risk
          </div>
          <div className="text-xs text-slate-400">
            AI-calculated
          </div>
        </div>
      </div>

      {/* Metric Breakdown */}
      {showDetails && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Validation Metrics
          </div>
          
          <MetricBar
            icon={<BarChart3 className="w-4 h-4" />}
            label="Benford Integrity"
            value={metrics.benfordIntegrity}
            description="Statistical anomaly detection"
          />
          
          <MetricBar
            icon={<TrendingUp className="w-4 h-4" />}
            label="Odds Alignment"
            value={metrics.oddsAlignment}
            description="Market consensus verification"
          />
          
          <MetricBar
            icon={<Activity className="w-4 h-4" />}
            label="Market Consensus"
            value={metrics.marketConsensus}
            description="Cross-book agreement"
          />
          
          <MetricBar
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Historical Accuracy"
            value={metrics.historicalAccuracy}
            description="Past performance tracking"
          />
        </div>
      )}

      {/* Flags and Warnings */}
      {metrics.flags && metrics.flags.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Validation Flags
          </div>
          {metrics.flags.map((flag, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 p-3 rounded-xl border ${
                flag.severity === 'error'
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : flag.severity === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium capitalize">{flag.type}</div>
                <div className="text-xs opacity-80 mt-0.5">{flag.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data Source Attribution */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
        <Shield className="w-3.5 h-3.5 text-slate-500" />
        <div className="text-xs text-slate-500">
          Validated by Grok AI • Real-time odds data • Benford's Law analysis
        </div>
      </div>
    </div>
  );
}

interface MetricBarProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
}

function MetricBar({ icon, label, value, description }: MetricBarProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getTextColor = (score: number) => {
    if (score >= 85) return 'text-emerald-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-slate-400">{icon}</div>
          <div>
            <div className="text-sm font-medium text-white">{label}</div>
            <div className="text-xs text-slate-500">{description}</div>
          </div>
        </div>
        <div className={`text-sm font-semibold ${getTextColor(value)}`}>
          {value}%
        </div>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${getScoreColor(value)} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function TrustMetricsBadge({ metrics }: { metrics: TrustMetrics }) {
  const getTrustColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${getTrustColor(metrics.trustLevel)}`}>
      <Shield className="w-3 h-3" />
      <span>{metrics.trustLevel.toUpperCase()}</span>
      <span className="opacity-60">•</span>
      <span>{metrics.finalConfidence}%</span>
    </div>
  );
}
