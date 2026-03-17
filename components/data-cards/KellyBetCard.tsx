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

  const edgeColor =
    edgeNum !== null && edgeNum >= 5 ? 'text-emerald-400' :
    edgeNum !== null && edgeNum >= 2 ? 'text-sky-400' :
    'text-[oklch(0.60_0.01_280)]';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)] transition-all duration-200 animate-fade-in-up',
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
            <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">
              {category}
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            {subcategory}
          </span>
        </div>

        <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mb-4 truncate">{title}</h3>

        {/* Recommended stake — hero metric */}
        {data.recommendedStake && (
          <div className="mb-4">
            <p className="text-[9px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-0.5">
              Recommended Stake
            </p>
            <p className="text-3xl font-black text-[oklch(0.92_0.005_85)] tabular-nums leading-none">
              {data.recommendedStake}
            </p>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <MetricCell label="Edge" value={data.edge ?? '—'} valueClass={edgeColor} />
          <MetricCell label="Kelly %" value={data.kellyFraction ?? '—'} />
          <MetricCell label="Exp. Value" value={data.expectedValue ?? '—'} valueClass="text-blue-400" />
        </div>

        {/* Confidence bar */}
        {confidenceNum !== null && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[oklch(0.45_0.01_280)] uppercase tracking-wider">Model Confidence</span>
              <span className="font-bold text-[oklch(0.80_0.005_85)]">{data.confidence}</span>
            </div>
            <div className="w-full h-1.5 bg-[oklch(0.09_0.01_280)] rounded-full overflow-hidden">
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
          <div className="flex items-center gap-1.5 text-[10px] text-[oklch(0.45_0.01_280)]">
            <TrendingUp className="w-3 h-3" aria-hidden="true" />
            <span>{data.sport}</span>
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
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
  valueClass = 'text-[oklch(0.80_0.005_85)]',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
      <p className="text-[9px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1">{label}</p>
      <p className={cn('text-sm font-black tabular-nums', valueClass)}>{value}</p>
    </div>
  );
}
