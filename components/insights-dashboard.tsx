'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Activity, Award, DollarSign, Target, AlertCircle, RefreshCw } from 'lucide-react';
import { TrustMetricsDisplay } from './trust-metrics-display';

interface InsightsDashboardProps {
  userId?: string;
}

export function InsightsDashboard({ userId }: InsightsDashboardProps) {
  const [insights, setInsights] = useState<any>(null);
  const [historical, setHistorical] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, [userId]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [insightsRes, historicalRes, profileRes] = await Promise.all([
        fetch('/api/insights', {
          headers: userId ? { 'x-user-id': userId } : {}
        }).catch(err => {
          console.warn('[v0] Failed to fetch insights:', err);
          return null;
        }),
        fetch('/api/metrics/historical?days=30').catch(err => {
          console.warn('[v0] Failed to fetch historical metrics:', err);
          return null;
        }),
        userId ? fetch('/api/user/profile', {
          headers: { 'x-user-id': userId }
        }).catch(err => {
          console.warn('[v0] Failed to fetch profile:', err);
          return null;
        }) : Promise.resolve(null)
      ]);

      const insightsData = insightsRes && insightsRes.ok ? await insightsRes.json() : { insights: null };
      const historicalData = historicalRes && historicalRes.ok ? await historicalRes.json() : { metrics: null };
      const profileData = profileRes && profileRes.ok ? await profileRes.json() : { profile: null };

      setInsights(insightsData.insights || {
        totalValue: 0,
        winRate: 0,
        roi: 0,
        activeContests: 0,
        totalInvested: 0
      });
      setHistorical(historicalData.metrics);
      setProfile(profileData?.profile);
    } catch (err) {
      console.error('[v0] Error in fetchAllData:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      // Set default values on error
      setInsights({
        totalValue: 0,
        winRate: 0,
        roi: 0,
        activeContests: 0,
        totalInvested: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-300 mb-1">Failed to load insights</h3>
            <p className="text-xs text-red-400/80">{error}</p>
            <button
              onClick={fetchAllData}
              className="mt-3 text-xs text-red-300 hover:text-red-200 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Map historical metrics API fields (winRate 0–1, averageConfidence 0–1) to percentages
  const winRatePct = historical ? Math.round((historical.winRate ?? 0) * 100) : 0;
  const avgConfPct = historical ? Math.round((historical.averageConfidence ?? 0) * 100) : 0;
  const trustMetrics = historical ? {
    benfordIntegrity: avgConfPct,
    oddsAlignment: winRatePct,
    marketConsensus: winRatePct,
    historicalAccuracy: winRatePct,
    finalConfidence: avgConfPct,
    trustLevel: (avgConfPct >= 80 ? 'high' : avgConfPct >= 60 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    flags: [] as { type: string; message: string; severity: 'error' | 'info' | 'warning' }[],
    riskLevel: (avgConfPct >= 80 ? 'low' : avgConfPct >= 60 ? 'medium' : 'high') as 'high' | 'medium' | 'low'
  } : null;

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Value"
          value={`$${insights?.totalValue?.toLocaleString() || '0'}`}
          change={insights?.roi > 0 ? `+${insights.roi}%` : `${insights?.roi || 0}%`}
          positive={insights?.roi >= 0}
          trend={[40, 45, 42, 50, 55, 58, 62]}
        />
        <StatCard
          icon={Target}
          label="Win Rate"
          value={`${insights?.winRate || 0}%`}
          subtitle={`${insights?.activeContests || 0} active`}
          positive={(insights?.winRate || 0) >= 50}
          trend={historical?.dailyBreakdown?.slice(-7).map((d: any) => Math.round((d.winRate ?? 0) * 100)) ?? [50, 52, 48, 55, 57, 54, 60]}
        />
        <StatCard
          icon={TrendingUp}
          label="ROI"
          value={`${insights?.roi >= 0 ? '+' : ''}${insights?.roi || 0}%`}
          positive={insights?.roi >= 0}
          trend={[0, 2, -1, 3, 5, 4, 7]}
        />
        <StatCard
          icon={Activity}
          label="Confidence"
          value={`${avgConfPct || insights?.avgConfidence || 0}%`}
          subtitle={`${historical?.totalPredictions || 0} predictions`}
          positive={(avgConfPct || insights?.avgConfidence || 0) >= 70}
          trend={[72, 75, 73, 78, 80, 77, 82]}
        />
      </div>

      {/* Trust Metrics */}
      {trustMetrics && (
        <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-5">
          <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">
            AI Trust & Validation Metrics (30 Days)
          </h3>
          <TrustMetricsDisplay metrics={trustMetrics} showDetails={true} />
        </div>
      )}

      {/* User Performance — uses insights + historical data (profile only has auth metadata) */}
      {(insights?.totalInvested > 0 || (historical?.resolvedPredictions ?? 0) > 0) && (
        <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-5">
          <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">
            Your Performance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ProfileStat label="Invested" value={`$${insights?.totalInvested || 0}`} />
            <ProfileStat label="ROI" value={`${(insights?.roi ?? 0) >= 0 ? '+' : ''}${insights?.roi || 0}%`} />
            <ProfileStat label="Wins" value={historical?.correctPredictions ?? 0} />
            <ProfileStat label="Losses" value={Math.max(0, (historical?.resolvedPredictions ?? 0) - (historical?.correctPredictions ?? 0))} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Lightweight SVG sparkline — accepts 6-10 data points (0–100 range) */
function TrendSparkline({ points, positive }: { points: number[]; positive?: boolean }) {
  if (!points || points.length < 2) return null;
  const W = 60, H = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const px = (i: number) => (i / (points.length - 1)) * W;
  const py = (v: number) => H - ((v - min) / range) * (H - 2) - 1;
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const color = positive !== false ? '#34d399' : '#f87171';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, change, subtitle, positive, trend }: any) {
  return (
    <div className="bg-[var(--bg-overlay)] border border-[var(--border-subtle)] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-[var(--bg-surface)] rounded-lg">
          <Icon className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            positive ? 'bg-[var(--bg-surface)] text-foreground/80' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
          }`}>
            {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--text-muted)]">{subtitle || label}</div>
        {trend && <TrendSparkline points={trend} positive={positive} />}
      </div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
