'use client';

/**
 * MarketIntelligencePanel
 *
 * Right-side sliding drawer that displays the full market intelligence report
 * for the currently selected event. Polls /api/market-intelligence/snapshot
 * every 30 seconds to keep data fresh.
 *
 * Implemented as a fixed overlay with CSS translate so it does NOT affect the
 * existing chat layout — no restructuring of page-client.tsx is required.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, TrendingUp, Activity, Shield, Zap, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AnomalyFeed } from './AnomalyFeed';
import { ExplainabilityTimeline } from './ExplainabilityTimeline';
import { ProbabilitySurfaceCard } from './ProbabilitySurfaceCard';
import type { MarketIntelligenceReport, TimelineEvent } from '@/lib/market-intelligence';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sport?: string;
  eventId?: string;
  oddsEvent?: Record<string, unknown>;
  kalshiMarkets?: Array<Record<string, unknown>>;
}

const SEVERITY_BADGE: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/40',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  none: 'bg-white/10 text-white/40 border-white/15',
};

const MOVEMENT_ICON: Record<string, string> = {
  steam: '🔥',
  drift: '〰️',
  correction: '🔄',
  stable: '─',
};

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-white/40 mb-0.5">{label}</span>
      <span className="text-sm font-semibold text-white font-mono">{value}</span>
      {sub && <span className="text-xs text-white/30">{sub}</span>}
    </div>
  );
}

function SignalBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="text-white/70 font-mono">{score.toFixed(0)}</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}

export function MarketIntelligencePanel({
  isOpen,
  onClose,
  sport,
  eventId,
  oddsEvent,
  kalshiMarkets,
}: Props) {
  const [report, setReport] = useState<MarketIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!eventId || !sport || !oddsEvent) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/market-intelligence/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, sport, oddsEvent, kalshiMarkets }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success && json.report) {
        setReport(json.report);
        setLastFetch(new Date());
      }
    } catch (err) {
      setError('Unable to fetch market data');
    } finally {
      setLoading(false);
    }
  }, [eventId, sport, oddsEvent, kalshiMarkets]);

  // Start/stop polling based on panel state and available data
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isOpen) return;

    if (eventId && sport && oddsEvent) {
      fetchSnapshot();
      intervalRef.current = setInterval(fetchSnapshot, 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, fetchSnapshot, eventId, sport, oddsEvent]);

  const timeline: TimelineEvent[] = report?.timeline ?? [];

  return (
    <>
      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed right-0 top-0 h-full w-80 z-50
          bg-[#0a0a0f] border-l border-white/10
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-label="Market Intelligence Panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Market Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw className="w-3 h-3 text-white/40 animate-spin" />}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* No event selected */}
          {!eventId && (
            <div className="text-center py-10 text-sm text-white/30">
              Select an event from the feed to see market intelligence signals.
            </div>
          )}

          {/* Error state */}
          {error && eventId && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !report && eventId && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          )}

          {/* Report content */}
          {report && (
            <>
              {/* Anomaly header */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3 h-3" /> Anomaly Detection
                  </h3>
                  <Badge className={`text-xs border ${SEVERITY_BADGE[report.severity]}`}>
                    {report.severity.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Metric
                    label="Anomaly Score"
                    value={report.anomalyScore.toFixed(2)}
                    sub={report.affectedMarkets.length > 0 ? `${report.affectedMarkets.length} market(s)` : 'clean'}
                  />
                  <Metric
                    label="Velocity"
                    value={`${MOVEMENT_ICON[report.movementType] ?? '─'} ${report.movementType}`}
                    sub={report.direction !== 'flat' ? `${report.direction} pressure` : undefined}
                  />
                </div>
              </section>

              {/* Signal bars */}
              <section>
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Shield className="w-3 h-3" /> Signal Strength
                </h3>
                <div className="space-y-2">
                  <SignalBar label="Benford Trust" score={report.benfordTrustScore} color="bg-emerald-500" />
                  <SignalBar label="Velocity Score" score={report.velocityScore} color="bg-amber-500" />
                  <SignalBar label="Composite Signal" score={report.signalStrength} color="bg-blue-500" />
                </div>
              </section>

              {/* Probability surface */}
              <section>
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Zap className="w-3 h-3" /> Probability Surface
                </h3>
                <ProbabilitySurfaceCard
                  surfaceProbability={report.surfaceProbability}
                  components={{
                    sportsbookConsensus: report.sportsbookConsensus,
                    kalshiProbability: report.kalshiProbability,
                    historicalPrior: null,
                  }}
                  weights={{ sportsbook: 0.5, prediction_market: 0.3, historical: 0.2 }}
                  confidence={report.kalshiProbability !== null ? 0.66 : 0.33}
                />
              </section>

              {/* Timeline */}
              {timeline.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                    Explainability Timeline
                  </h3>
                  <ExplainabilityTimeline events={timeline} />
                </section>
              )}
            </>
          )}

          {/* Anomaly feed (always shown when panel is open) */}
          <section>
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
              Live Anomaly Feed
            </h3>
            <AnomalyFeed sport={sport} limit={8} />
          </section>
        </div>

        {/* Footer */}
        {lastFetch && (
          <div className="shrink-0 px-4 py-2 border-t border-white/10 text-xs text-white/25 text-center">
            Last updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · 30s interval
          </div>
        )}
      </aside>
    </>
  );
}
