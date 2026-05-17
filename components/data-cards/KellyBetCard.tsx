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

// Segmented horizontal dial for Kelly fraction
function KellyDial({ fraction }: { fraction: number }) {
  // fraction in 0-1 range; segments: 0-25% = green, 25-50% = amber, 50-100% = red
  const pct = Math.min(100, Math.max(0, fraction * 100));
  const segments = 20;
  const filled = Math.round((pct / 100) * segments);

  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: segments }).map((_, i) => {
        const isFilled = i < filled;
        const segColor =
          i < segments * 0.25 ? (isFilled ? 'bg-emerald-500' : 'bg-emerald-500/15')
          : i < segments * 0.5 ? (isFilled ? 'bg-amber-500' : 'bg-amber-500/15')
          : (isFilled ? 'bg-red-500' : 'bg-red-500/15');
        return (
          <div
            key={i}
            className={cn('h-3 flex-1 rounded-sm transition-all duration-500', segColor)}
          />
        );
      })}
    </div>
  );
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

  const kellyFractionNum = parseNumeric(data.kellyFraction);

  const edgeColor =
    edgeNum !== null && edgeNum >= 5 ? 'text-emerald-400' :
    edgeNum !== null && edgeNum >= 2 ? 'text-sky-400' :
    'text-[var(--text-muted)]';

  // Risk badge: infer from kellyFraction
  const riskLabel =
    kellyFractionNum !== null && kellyFractionNum >= 0.75 ? 'Full Kelly'
    : kellyFractionNum !== null && kellyFractionNum >= 0.4 ? 'Half Kelly'
    : 'Quarter Kelly';
  const riskBadgeClass =
    riskLabel === 'Full Kelly'    ? 'text-red-400 bg-red-500/15 border-red-500/30'
    : riskLabel === 'Half Kelly'  ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
    : 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)] transition-all duration-300 animate-fade-in-up',
        isHero && 'sm:rounded-3xl',
      )}
    >
      {/* Header gradient */}
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-blue-600/25 dark:via-cyan-800/10 to-transparent pointer-events-none" />

      <div
        className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)}
        aria-hidden="true"
      />

      <div className="relative pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {category}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border', riskBadgeClass)}>
              {riskLabel}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {subcategory}
            </span>
          </div>
        </div>

        <h3 className="text-sm font-black text-foreground mb-4 truncate">{title}</h3>

        {/* Low-edge warning */}
        {isLowEdge && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-[10px] font-semibold text-amber-300">
            <Target className="w-3 h-3 shrink-0" />
            Low-edge play — consider half kelly sizing
          </div>
        )}

        {/* Hero: Stake % of bankroll */}
        {bankrollPct !== null && (
          <div className="mb-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-4 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Stake % of Bankroll</p>
            <p className={cn('text-5xl font-black tabular-nums leading-none', isLowEdge ? 'text-amber-400' : 'text-white')}>
              {bankrollPct}%
            </p>
            {data.recommendedStake && (
              <p className="text-sm text-[var(--text-muted)] mt-1.5">
                ≈ <span className="font-black text-foreground">{data.recommendedStake}</span> on $1,000
              </p>
            )}
          </div>
        )}

        {/* Kelly dial */}
        {kellyFractionNum !== null && (
          <div className="mb-4">
            <div className="flex justify-between text-[9px] text-[var(--text-faint)] mb-1.5">
              <span className="uppercase tracking-wide">Kelly Fraction</span>
              <span className="font-bold text-foreground">{data.kellyFraction}</span>
            </div>
            <KellyDial fraction={kellyFractionNum} />
            <div className="flex justify-between text-[8px] text-[var(--text-faint)] mt-1">
              <span>Conservative</span>
              <span>Aggressive</span>
            </div>
          </div>
        )}

        {/* 3-col stat grid: Edge, Win Prob, EV */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Edge</p>
            <p className={cn('text-sm font-black tabular-nums', edgeColor)}>{data.edge ?? '—'}</p>
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Win Prob</p>
            <p className="text-sm font-black tabular-nums text-foreground">{data.confidence ?? '—'}</p>
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)] mb-1">EV</p>
            <p className={cn('text-sm font-black tabular-nums', roiPct ? 'text-blue-400' : 'text-foreground')}>
              {roiPct !== null ? `+${roiPct}%` : (data.expectedValue ?? '—')}
            </p>
          </div>
        </div>

        {/* Kelly variants */}
        {stakeNum !== null && (
          <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2.5 mb-3">
            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-2">Kelly Variants</p>
            <div className="space-y-1">
              {[
                { label: 'Full Kelly', val: data.recommendedStake, active: true, cls: 'text-red-300 bg-red-500/10 border border-red-500/20' },
                { label: 'Half Kelly', val: `$${halfKelly}`, active: false, cls: '' },
                { label: '¼ Kelly', val: `$${quarterKelly}`, active: false, cls: '' },
              ].map(({ label, val, active, cls }) => (
                <div key={label} className={cn('flex justify-between text-xs rounded-lg px-2.5 py-1.5', active ? cls : 'bg-transparent')}>
                  <span className={active ? 'text-red-300 font-bold' : 'text-[var(--text-muted)]'}>{label}</span>
                  <span className={cn('font-black tabular-nums', active ? 'text-red-300' : 'text-[var(--text-muted)]')}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence bar */}
        {confidenceNum !== null && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[var(--text-muted)] uppercase tracking-wider">Model Confidence</span>
              <span className="font-bold text-foreground">{data.confidence}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
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
