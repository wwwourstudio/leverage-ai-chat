'use client';

import { Target, ChevronRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KellyBetData {
  matchup?: string;
  sport?: string;
  edge?: string;
  confidence?: string;
  kellyFraction?: string;
  recommendedStake?: string;
  expectedValue?: string;
  status?: string;
  realData?: boolean;
}

interface KellyBetCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: KellyBetData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

function parseNumeric(val?: string): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace('%', '').replace('$', '').replace(',', ''));
  return isNaN(n) ? null : n;
}

export function KellyBetCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: KellyBetCardProps) {
  const edgeNum = parseNumeric(data.edge);
  const confidenceNum = parseNumeric(data.confidence);
  const stakeNum = parseNumeric(data.recommendedStake);
  const evNum = parseNumeric(data.expectedValue);
  const halfKelly = stakeNum !== null ? (stakeNum / 2).toFixed(0) : null;
  const quarterKelly = stakeNum !== null ? (stakeNum / 4).toFixed(0) : null;
  const bankrollPct = stakeNum !== null ? (stakeNum / 1000 * 100).toFixed(1) : null;
  const roiPct = stakeNum !== null && evNum !== null && stakeNum > 0 ? (evNum / stakeNum * 100).toFixed(1) : null;
  const isLowEdge = edgeNum !== null && edgeNum < 3;

  const edgeColor =
    edgeNum !== null && edgeNum >= 5 ? 'text-emerald-400' :
    edgeNum !== null && edgeNum >= 2 ? 'text-sky-400' :
    'text-[var(--text-muted)]';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-background border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all duration-200 animate-fade-in-up',
        isHero && 'sm:rounded-3xl',
      )}
    >
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)}
        aria-hidden="true"
      />

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {category}
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            {subcategory}
          </span>
        </div>

        <h3 className="text-sm font-black text-foreground mb-4 truncate">{title}</h3>

        {/* Low-edge warning banner */}
        {isLowEdge && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-[10px] font-semibold text-amber-300">
            <Target className="w-3 h-3 shrink-0" />
            Low-edge play — consider half kelly sizing
          </div>
        )}

        {/* Recommended stake — hero metric */}
        {data.recommendedStake && (
          <div className="mb-1">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-0.5">
              Recommended Stake
            </p>
            <p className={cn('text-3xl font-black tabular-nums leading-none', isLowEdge ? 'text-amber-400' : 'text-foreground')}>
              {data.recommendedStake}
            </p>
            {bankrollPct !== null && (
              <p className="text-[9px] text-[var(--text-faint)] mt-0.5">{bankrollPct}% of $1,000 bankroll</p>
            )}
          </div>
        )}

        {/* Kelly variants comparison */}
        {stakeNum !== null && (
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5 mb-3">
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-2">Kelly Variants</p>
            <div className="space-y-1">
              {[
                { label: 'Full Kelly', val: data.recommendedStake, active: true },
                { label: 'Half Kelly', val: `$${halfKelly}` },
                { label: '¼ Kelly', val: `$${quarterKelly}` },
              ].map(({ label, val, active }) => (
                <div key={label} className={cn('flex justify-between text-xs rounded-lg px-2.5 py-1.5', active ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-transparent')}>
                  <span className={active ? 'text-indigo-300 font-bold' : 'text-[var(--text-muted)]'}>{label}</span>
                  <span className={cn('font-black tabular-nums', active ? 'text-indigo-300' : 'text-[var(--text-muted)]')}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <MetricCell label="Edge" value={data.edge ?? '—'} valueClass={edgeColor} />
          <MetricCell label="Kelly %" value={data.kellyFraction ?? '—'} />
          <MetricCell label="ROI" value={roiPct !== null ? `+${roiPct}%` : (data.expectedValue ?? '—')} valueClass="text-blue-400" />
        </div>

        {/* Confidence bar */}
        {confidenceNum !== null && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[var(--text-muted)] uppercase tracking-wider">Model Confidence</span>
              <span className="font-bold text-foreground">{data.confidence}</span>
            </div>
            <div className="w-full h-1.5 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  confidenceNum >= 70 ? 'bg-emerald-500' :
                  confidenceNum >= 50 ? 'bg-sky-500' :
                  'bg-amber-500',
                )}
                style={{ width: `${Math.min(confidenceNum, 100)}%` }}
                role="progressbar"
                aria-valuenow={confidenceNum}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {data.sport && (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <TrendingUp className="w-3 h-3" aria-hidden="true" />
            <span>{data.sport}</span>
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
            aria-label="Full Kelly bet analysis"
          >
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}

function MetricCell({
  label,
  value,
  valueClass = 'text-foreground',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
      <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">{label}</p>
      <p className={cn('text-sm font-black tabular-nums', valueClass)}>{value}</p>
    </div>
  );
}
