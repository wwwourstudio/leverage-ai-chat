'use client';

import { Wallet, ChevronRight, PieChart } from 'lucide-react';
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

  const utilColor =
    utilNum !== null && utilNum > 80 ? 'bg-red-500' :
    utilNum !== null && utilNum > 50 ? 'bg-amber-500' :
    'bg-emerald-500';

  const utilTextColor =
    utilNum !== null && utilNum > 80 ? 'text-red-400' :
    utilNum !== null && utilNum > 50 ? 'text-amber-400' :
    'text-emerald-400';

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
            <Wallet className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">
              {category}
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
            {subcategory}
          </span>
        </div>

        <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mb-4">{title}</h3>

        {hasLiveData ? (
          <>
            {/* Bankroll hero */}
            <div className="mb-4">
              <p className="text-[9px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-0.5">
                Total Bankroll
              </p>
              <p className="text-3xl font-black text-[oklch(0.92_0.005_85)] tabular-nums leading-none">
                {data.totalBankroll}
              </p>
            </div>

            {/* Deployed / Available split */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
                <p className="text-[9px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1">Deployed</p>
                <p className="text-sm font-black text-emerald-400 tabular-nums">{data.deployed}</p>
              </div>
              <div className="bg-[oklch(0.09_0.01_280)] rounded-xl border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
                <p className="text-[9px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-1">Available</p>
                <p className="text-sm font-black text-sky-400 tabular-nums">{data.available}</p>
              </div>
            </div>

            {/* Utilization bar */}
            {utilNum !== null && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[oklch(0.45_0.01_280)] uppercase tracking-wider">Capital Utilization</span>
                  <span className={cn('font-bold', utilTextColor)}>{data.utilizationRate}</span>
                </div>
                <div className="w-full h-2 bg-[oklch(0.09_0.01_280)] rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', utilColor)}
                    style={{ width: `${Math.min(utilNum, 100)}%` }}
                    role="progressbar"
                    aria-valuenow={utilNum}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            )}

            {/* Extra metrics */}
            <div className="space-y-1 text-xs">
              {data.riskBudget && (
                <div className="flex items-center justify-between">
                  <span className="text-[oklch(0.45_0.01_280)]">Risk Budget</span>
                  <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.riskBudget}</span>
                </div>
              )}
              {data.openBets != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[oklch(0.45_0.01_280)]">Open Bets</span>
                  <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.openBets}</span>
                </div>
              )}
              {data.roi && (
                <div className="flex items-center justify-between">
                  <span className="text-[oklch(0.45_0.01_280)]">ROI</span>
                  <span className="font-semibold text-emerald-400">{data.roi}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Setup / fallback state */
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-2 text-purple-400/60">
              <PieChart className="w-8 h-8" aria-hidden="true" />
            </div>
            {data.description && (
              <p className="text-sm text-[oklch(0.65_0.01_280)] leading-relaxed">{data.description}</p>
            )}
            {Array.isArray(data.features) && data.features.length > 0 && (
              <ul className="space-y-1">
                {data.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[oklch(0.55_0.01_280)]">
                    <span className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            {data.note && (
              <p className="text-xs text-[oklch(0.42_0.01_280)] italic">{data.note}</p>
            )}
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
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
