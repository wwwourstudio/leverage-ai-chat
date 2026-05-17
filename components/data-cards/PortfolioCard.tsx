'use client';

import { Wallet, ChevronRight, PieChart, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PortfolioData {
  totalBankroll?: string;
  deployed?: string;
  available?: string;
  utilizationRate?: string;
  riskBudget?: string;
  openBets?: string | number;
  winRate?: string;
  roi?: string;
  description?: string;
  features?: string[];
  note?: string;
  status?: string;
  realData?: boolean;
}

interface PortfolioCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: PortfolioData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

function parseUtilization(val?: string): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace('%', ''));
  return isNaN(n) ? null : n;
}

// Single metric tile for the dashboard grid
function MetricTile({
  label,
  value,
  trend,
  valueClass = 'text-white',
  subtext,
}: {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
  valueClass?: string;
  subtext?: string;
}) {
  return (
    <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-3 flex flex-col gap-1">
      <p className="text-[8px] uppercase tracking-widest text-[var(--text-faint)]">{label}</p>
      <div className="flex items-end gap-1.5">
        <p className={cn('text-lg font-black tabular-nums leading-none', valueClass)}>{value}</p>
        {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mb-0.5 shrink-0" />}
        {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-400 mb-0.5 shrink-0" />}
        {trend === 'flat' && <Minus className="w-3.5 h-3.5 text-[var(--text-muted)] mb-0.5 shrink-0" />}
      </div>
      {subtext && <p className="text-[9px] text-[var(--text-faint)]">{subtext}</p>}
    </div>
  );
}

export function PortfolioCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: PortfolioCardProps) {
  const utilNum = parseUtilization(data.utilizationRate);
  const hasLiveData = !!(data.totalBankroll);
  const roiNum = data.roi ? parseFloat(String(data.roi).replace('%', '')) : null;

  const utilColor =
    utilNum !== null && utilNum > 80 ? 'bg-red-500' :
    utilNum !== null && utilNum > 50 ? 'bg-amber-500' :
    'bg-emerald-500';

  const utilTextColor =
    utilNum !== null && utilNum > 80 ? 'text-red-400' :
    utilNum !== null && utilNum > 50 ? 'text-amber-400' :
    'text-emerald-400';

  const roiTrend: 'up' | 'down' | 'flat' =
    roiNum === null ? 'flat'
    : roiNum > 0 ? 'up'
    : roiNum < 0 ? 'down'
    : 'flat';

  const roiValueClass =
    roiNum === null ? 'text-white'
    : roiNum > 0 ? 'text-emerald-300'
    : roiNum < 0 ? 'text-red-400'
    : 'text-[var(--text-muted)]';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)] transition-all duration-300 animate-fade-in-up',
        isHero && 'sm:rounded-3xl',
      )}
    >
      {/* Header gradient */}
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-violet-600/25 dark:via-purple-800/10 to-transparent pointer-events-none" />

      <div
        className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)}
        aria-hidden="true"
      />

      <div className="relative pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {category}
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
            {subcategory}
          </span>
        </div>

        <h3 className="text-sm font-black text-foreground mb-4">{title}</h3>

        {hasLiveData ? (
          <>
            {/* Bankroll hero — largest number */}
            <div className="rounded-2xl bg-[var(--bg-elevated)] border border-violet-500/20 p-4 text-center mb-4">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Total Bankroll</p>
              <p className="text-5xl font-black text-white tabular-nums leading-none">
                {data.totalBankroll}
              </p>
              {data.riskBudget && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                  Risk budget: <span className="font-bold text-foreground/80">{data.riskBudget}</span>
                </p>
              )}
            </div>

            {/* Dashboard 2x2 metric grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetricTile
                label="Deployed"
                value={data.deployed ?? '—'}
                valueClass="text-emerald-300"
                subtext="active positions"
              />
              <MetricTile
                label="Available"
                value={data.available ?? '—'}
                valueClass="text-sky-300"
                subtext="ready to deploy"
              />
              <MetricTile
                label="ROI"
                value={data.roi ?? '—'}
                trend={roiTrend}
                valueClass={roiValueClass}
              />
              <MetricTile
                label="Open Bets"
                value={data.openBets != null ? String(data.openBets) : '—'}
                valueClass="text-purple-300"
                subtext={data.winRate ? `${data.winRate} win rate` : undefined}
              />
            </div>

            {/* Utilization bar */}
            {utilNum !== null && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-[var(--text-faint)] uppercase tracking-wider">Capital Utilization</span>
                  <span className={cn('font-bold', utilTextColor)}>{data.utilizationRate}</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', utilColor)}
                    style={{ width: `${Math.min(utilNum, 100)}%` }}
                    role="progressbar"
                    aria-valuenow={utilNum}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                {/* Deployed vs Available visual sub-labels */}
                <div className="flex justify-between text-[8px] text-[var(--text-faint)] mt-1">
                  <span>Deployed: {utilNum.toFixed(0)}%</span>
                  <span>Free: {(100 - utilNum).toFixed(0)}%</span>
                </div>
                {utilNum > 75 && (
                  <div className={cn(
                    'flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold',
                    utilNum > 90
                      ? 'bg-red-500/8 border-red-500/20 text-red-300'
                      : 'bg-amber-500/8 border-amber-500/20 text-amber-300',
                  )}>
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {utilNum > 90 ? 'Critical utilization — reduce positions immediately' : 'High utilization — consider reducing position size'}
                  </div>
                )}
              </div>
            )}

            {/* ROI status badge */}
            {roiNum !== null && (
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-semibold',
                roiNum > 0
                  ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-300'
                  : roiNum < 0
                    ? 'bg-red-500/8 border-red-500/20 text-red-300'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)]',
              )}>
                {roiNum > 0
                  ? <><TrendingUp className="w-3 h-3 shrink-0" /> Portfolio is profitable</>
                  : roiNum < 0
                    ? <><TrendingDown className="w-3 h-3 shrink-0" /> Portfolio in drawdown</>
                    : <><Minus className="w-3 h-3 shrink-0" /> Break-even</>}
              </div>
            )}
          </>
        ) : (
          /* Setup / fallback state */
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-2 text-purple-400/60">
              <PieChart className="w-8 h-8" aria-hidden="true" />
            </div>
            {data.description && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{data.description}</p>
            )}
            {Array.isArray(data.features) && data.features.length > 0 && (
              <ul className="space-y-1">
                {data.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            {data.note && (
              <p className="text-xs text-[var(--text-faint)] italic">{data.note}</p>
            )}
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-purple-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
            aria-label="Manage portfolio"
          >
            Manage Portfolio
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
