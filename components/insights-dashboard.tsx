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
        }),
        fetch('/api/metrics/historical?days=30'),
        userId ? fetch('/api/user/profile', {
          headers: { 'x-user-id': userId }
        }) : Promise.resolve(null)
      ]);

      const insightsData = await insightsRes.json();
      const historicalData = await historicalRes.json();
      const profileData = profileRes ? await profileRes.json() : null;

      setInsights(insightsData.insights);
      setHistorical(historicalData.metrics);
      setProfile(profileData?.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
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

  const trustMetrics = historical ? {
    benfordIntegrity: historical.avgBenford,
    oddsAlignment: historical.avgOdds,
    marketConsensus: historical.avgConsensus,
    historicalAccuracy: historical.avgConfidence,
    finalConfidence: historical.recentAvg,
    trustLevel: (historical.recentAvg >= 80 ? 'high' : historical.recentAvg >= 60 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    flags: [] as { type: string; message: string; severity: 'error' | 'info' | 'warning' }[],
    riskLevel: (historical.recentAvg >= 80 ? 'low' : historical.recentAvg >= 60 ? 'medium' : 'high') as 'high' | 'medium' | 'low'
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
        />
        <StatCard
          icon={Target}
          label="Win Rate"
          value={`${insights?.winRate || 0}%`}
          subtitle={`${insights?.activeContests || 0} active`}
        />
        <StatCard
          icon={TrendingUp}
          label="ROI"
          value={`${insights?.roi >= 0 ? '+' : ''}${insights?.roi || 0}%`}
          change={historical?.trend || 'stable'}
          positive={insights?.roi >= 0}
        />
        <StatCard
          icon={Activity}
          label="Confidence"
          value={`${insights?.avgConfidence || 0}%`}
          subtitle={`${historical?.totalPredictions || 0} predictions`}
        />
      </div>

      {/* Trust Metrics */}
      {trustMetrics && (
        <div className="bg-linear-to-br from-slate-900/60 to-slate-800/60 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-4">
            AI Trust & Validation Metrics (30 Days)
          </h3>
          <TrustMetricsDisplay metrics={trustMetrics} showDetails={true} />
        </div>
      )}

      {/* User Profile Summary */}
      {profile && (
        <div className="bg-linear-to-br from-blue-900/20 to-indigo-900/20 border border-blue-700/30 rounded-xl p-6">
          <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wide mb-4">
            Your Performance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ProfileStat label="Invested" value={`$${profile.total_invested || 0}`} />
            <ProfileStat label="Profit" value={`$${profile.total_profit || 0}`} />
            <ProfileStat label="Wins" value={profile.win_count || 0} />
            <ProfileStat label="Losses" value={profile.loss_count || 0} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change, subtitle, positive }: any) {
  return (
    <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Icon className="w-4 h-4 text-blue-400" />
        </div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-slate-400">{subtitle || label}</div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-blue-300/70">{label}</div>
    </div>
  );
}
