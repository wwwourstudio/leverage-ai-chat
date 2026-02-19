'use client';

import { BarChart3, Activity, Sparkles } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataRow } from './DataRow';

interface KalshiCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, string | number>;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
}

const statusMap: Record<string, any> = {
  opportunity: { icon: BarChart3, label: 'OPPORTUNITY', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  edge: { icon: Activity, label: 'EDGE', bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
  synergy: { icon: Sparkles, label: 'SYNERGY', bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400' },
};

export function KalshiCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isLoading,
  error
}: KalshiCardProps) {
  const statusBadge = statusMap[status] || statusMap.opportunity;
  const d = data as any;

  return (
    <BaseCard
      icon={BarChart3}
      title={title}
      category={category}
      subcategory={subcategory}
      gradient={gradient}
      status={statusBadge}
      onAnalyze={onAnalyze}
      isLoading={isLoading}
      error={error}
    >
      <div className="space-y-2.5">
        {/* Subtitle / ticker */}
        {d.subtitle && (
          <div className="pb-2.5 border-b border-gray-700/30">
            <div className="text-sm font-medium text-gray-200 leading-relaxed">{d.subtitle}</div>
          </div>
        )}
        {d.ticker && !d.subtitle && <DataRow label="Ticker" value={d.ticker} highlight />}

        {/* Prices — values already formatted by kalshiMarketToCard (e.g. "50¢") */}
        {(d.yesPrice !== undefined || d.noPrice !== undefined) && (
          <DataRow
            label="Yes / No"
            value={`${d.yesPrice ?? '—'} / ${d.noPrice ?? '—'}`}
            highlight
          />
        )}
        {d.impliedProbability !== undefined && (
          <DataRow label="Implied Prob" value={String(d.impliedProbability)} />
        )}

        {/* Market depth — volume/openInterest are already locale-formatted numbers */}
        {d.volume !== undefined && <DataRow label="Volume" value={String(d.volume)} />}
        {d.openInterest !== undefined && <DataRow label="Open Interest" value={String(d.openInterest)} />}

        {/* Timing */}
        {d.closeTime && <DataRow label="Closes" value={d.closeTime} />}

        {/* Recommendation */}
        {d.recommendation && (
          <div className="pt-2 mt-1 border-t border-gray-700/40">
            <DataRow label="Signal" value={d.recommendation} highlight />
          </div>
        )}

        {/* Fallback description */}
        {d.description && !d.subtitle && (
          <div className="text-sm text-gray-400 leading-relaxed">{d.description}</div>
        )}
        {d.note && <DataRow label="Note" value={d.note} />}
      </div>
    </BaseCard>
  );
}
