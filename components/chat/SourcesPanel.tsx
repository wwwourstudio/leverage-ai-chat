'use client';

import { BookOpen, Zap, Shield, ChevronRight, Database, Activity, Sparkles, RefreshCw } from 'lucide-react';
import { TrustMetricsDisplay, type TrustMetrics } from '@/components/trust-metrics-display';

interface Source {
  name: string;
  type: string;
  reliability: number;
  url?: string;
}

interface SourcesPanelProps {
  role: 'user' | 'assistant';
  isWelcome?: boolean;
  sources?: Source[];
  trustMetrics?: TrustMetrics;
  modelUsed?: string;
  processingTime?: number;
}

export function SourcesPanel({
  role,
  isWelcome,
  sources,
  trustMetrics,
  modelUsed,
  processingTime,
}: SourcesPanelProps) {
  if (role !== 'assistant' || isWelcome || (!sources && !trustMetrics)) return null;

  return (
    <div className="mt-3 md:ml-11">
      {/* Compact Metadata Summary */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-faint)]">
        {modelUsed && (
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-purple-500/60 shrink-0" />
            <span>
              Model:{' '}
              <span className="text-[var(--text-faint)] font-semibold">
                {modelUsed
                  .replace('grok-3-fast', 'Grok 3 Fast')
                  .replace('grok-4', 'Grok 3 Fast')
                  .replace('Grok 4', 'Grok 3 Fast')}
              </span>
            </span>
          </span>
        )}
        {processingTime && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-500/60 shrink-0" />
            <span>
              Processed in:{' '}
              <span className="text-[var(--text-faint)] font-semibold tabular-nums">{processingTime}ms</span>
            </span>
          </span>
        )}
      </div>

      {/* Single collapsible: Sources & Trust combined */}
      {(sources?.length || trustMetrics) && (
        <details className="mt-2 group/trust">
          <summary className="cursor-pointer list-none flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors">
            <Shield
              className={`w-3.5 h-3.5 shrink-0 ${
                trustMetrics?.trustLevel === 'high'
                  ? 'text-blue-500/70'
                  : trustMetrics?.trustLevel === 'medium'
                    ? 'text-yellow-500/70'
                    : 'text-blue-500/60'
              }`}
            />
            <span className="font-semibold uppercase tracking-wide">Sources & Trust</span>
            {trustMetrics && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  trustMetrics.trustLevel === 'high'
                    ? 'bg-blue-600/20 text-blue-400'
                    : trustMetrics.trustLevel === 'medium'
                      ? 'bg-yellow-600/20 text-yellow-400'
                      : 'bg-red-600/20 text-red-400'
                }`}
              >
                {trustMetrics.finalConfidence}%
              </span>
            )}
            {sources?.length ? (
              <span className="text-[var(--text-faint)]">· {sources.length} sources</span>
            ) : null}
            {trustMetrics?.hasLiveOdds && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-500/80">LIVE</span>
            )}
            <ChevronRight className="w-3 h-3 group-open/trust:rotate-90 transition-transform shrink-0" />
          </summary>
          <div className="mt-2 space-y-2">
            {sources && sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sources.map((source, idx) => {
                  const reliabilityColor =
                    source.reliability >= 90
                      ? 'text-blue-500 border-blue-600/20'
                      : 'text-yellow-500 border-yellow-600/20';
                  const Icon =
                    source.type === 'database'
                      ? Database
                      : source.type === 'api'
                        ? Activity
                        : source.type === 'model'
                          ? Sparkles
                          : RefreshCw;
                  return (
                    <div
                      key={source.name ?? `src-${idx}`}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-[var(--bg-overlay)] ${reliabilityColor} text-[11px]`}
                      title={`${source.name} - ${source.reliability}% reliability`}
                    >
                      <Icon className="w-3 h-3" />
                      <span className="font-semibold">{source.name}</span>
                      <span className="font-bold tabular-nums">{source.reliability}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            {trustMetrics && (
              <TrustMetricsDisplay
                metrics={{
                  ...trustMetrics,
                  sources: trustMetrics.sources || sources,
                  modelUsed: trustMetrics.modelUsed || modelUsed || 'Grok 4',
                  processingTime: trustMetrics.processingTime || processingTime,
                }}
              />
            )}
          </div>
        </details>
      )}
    </div>
  );
}
