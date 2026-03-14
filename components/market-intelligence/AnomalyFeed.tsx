'use client';

/**
 * AnomalyFeed
 *
 * Displays a live stream of market anomalies.
 * Polls /api/market-intelligence/anomalies every 30 seconds.
 * Severity is color-coded: high=red, medium=amber, low=blue.
 */

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';

interface Anomaly {
  id: string;
  event_id: string;
  sport: string;
  anomaly_score: number;
  severity: 'none' | 'low' | 'medium' | 'high';
  affected_markets: Array<{
    source: string;
    side: string;
    probability: number;
    deviation: number;
    direction: 'over' | 'under';
  }>;
  benford_trust: number;
  signal_strength: number;
  detected_at: string;
}

interface Props {
  sport?: string;
  limit?: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  none: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatScore(score: number): string {
  return score.toFixed(2);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1m ago';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function AnomalyFeed({ sport, limit = 10 }: Props) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAnomalies = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (sport) params.set('sport', sport);

      const res = await fetch(`/api/market-intelligence/anomalies?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.anomalies)) {
        setAnomalies(json.anomalies);
        setLastUpdated(new Date());
      }
    } catch {
      // Silent — panel degrades gracefully
    } finally {
      setLoading(false);
    }
  }, [sport, limit]);

  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 30_000);
    return () => clearInterval(interval);
  }, [fetchAnomalies]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-white/40">
        No anomalies detected{sport ? ` for ${sport.toUpperCase()}` : ''}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {anomalies.map(anomaly => (
        <div
          key={anomaly.id}
          className="rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/8 transition-colors"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <Badge className={`text-xs px-1.5 py-0 border ${SEVERITY_STYLES[anomaly.severity] ?? SEVERITY_STYLES.none}`}>
                {anomaly.severity.toUpperCase()}
              </Badge>
              <span className="text-xs font-mono text-white/60 uppercase truncate">
                {anomaly.sport}
              </span>
            </div>
            <span className="text-xs text-white/30 shrink-0">
              {timeAgo(anomaly.detected_at)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-white/80 font-medium">
              Score {formatScore(anomaly.anomaly_score)}
            </span>
            <div className="flex gap-3 text-xs text-white/50">
              <span>Trust {anomaly.benford_trust.toFixed(0)}/100</span>
              <span>Signal {anomaly.signal_strength.toFixed(0)}/100</span>
            </div>
          </div>

          {anomaly.affected_markets.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {anomaly.affected_markets.slice(0, 3).map((m, i) => (
                <span
                  key={i}
                  className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50"
                >
                  {m.source} {m.direction === 'over' ? '↑' : '↓'} {(m.probability * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {lastUpdated && (
        <div className="text-center text-xs text-white/25 pt-1">
          Updated {timeAgo(lastUpdated.toISOString())} · Auto-refresh 30s
        </div>
      )}
    </div>
  );
}
