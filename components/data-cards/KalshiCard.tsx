'use client';

import {
  TrendingUp, Vote, Trophy, CloudRain, TrendingDown,
  Cpu, Film, Globe, BarChart3, Clock, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KalshiCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
}

function CategoryIcon({ label, className }: { label?: string; className?: string }) {
  const cls = cn('w-4 h-4', className);
  switch (label) {
    case 'election':      return <Vote className={cls} />;
    case 'sports':        return <Trophy className={cls} />;
    case 'weather':       return <CloudRain className={cls} />;
    case 'finance':       return <TrendingDown className={cls} />;
    case 'tech':          return <Cpu className={cls} />;
    case 'entertainment': return <Film className={cls} />;
    default:              return <Globe className={cls} />;
  }
}

export function KalshiCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
}: KalshiCardProps) {
  const d = data;
  const yesPct: number = typeof d.yesPct === 'number' ? d.yesPct : parseFloat(d.yesPrice) || 50;
  const noPct: number = typeof d.noPct === 'number' ? d.noPct : 100 - yesPct;
  const isActive = status === 'active' || status === 'open' || status === 'live';

  const yesBarColor =
    yesPct >= 70 ? 'bg-emerald-500' :
    yesPct >= 55 ? 'bg-green-500' :
    yesPct >= 45 ? 'bg-[oklch(0.50_0.01_280)]' :
    yesPct >= 30 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)] transition-all duration-200">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <CategoryIcon label={d.iconLabel} className="text-[oklch(0.55_0.01_280)] shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">KALSHI</span>
            <span className="text-[oklch(0.3_0.01_280)]" aria-hidden="true">/</span>
            <span className="text-[11px] font-medium text-[oklch(0.45_0.01_280)] truncate">{subcategory || category}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" role="status">
            <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-400 animate-pulse' : 'bg-[oklch(0.40_0.01_280)]')} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', isActive ? 'text-emerald-400' : 'text-[oklch(0.45_0.01_280)]')}>
              {isActive ? 'LIVE' : 'CLOSED'}
            </span>
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-[oklch(0.95_0.005_85)] leading-snug text-balance mb-1">{title}</h3>

        {d.subtitle && d.subtitle !== title && (
          <p className="text-sm text-[oklch(0.50_0.01_280)] leading-relaxed mb-3 line-clamp-2">{d.subtitle}</p>
        )}

        {/* Probability gauge */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-400">YES {yesPct}c</span>
            <span className="text-[10px] font-normal text-[oklch(0.40_0.01_280)]">implied probability</span>
            <span className="text-red-400">NO {noPct}c</span>
          </div>

          <div className="relative h-2.5 rounded-full bg-[oklch(0.10_0.01_280)] overflow-hidden">
            <div
              className={cn('absolute left-0 top-0 h-full rounded-l-full transition-all duration-700', yesBarColor)}
              style={{ width: `${yesPct}%` }}
            />
            <div
              className="absolute right-0 top-0 h-full bg-red-500/50 rounded-r-full transition-all duration-700"
              style={{ width: `${noPct}%` }}
            />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[oklch(0.25_0.01_280)]" />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className={cn('text-lg font-black tabular-nums', yesPct >= 50 ? 'text-emerald-400' : 'text-[oklch(0.45_0.01_280)]')}>
                {yesPct}%
              </div>
              <div className="text-[9px] text-[oklch(0.40_0.01_280)] uppercase tracking-widest">Yes</div>
            </div>
            <div className="text-[9px] text-[oklch(0.30_0.01_280)] px-2">vs</div>
            <div className="text-center">
              <div className={cn('text-lg font-black tabular-nums', noPct >= 50 ? 'text-red-400' : 'text-[oklch(0.45_0.01_280)]')}>
                {noPct}%
              </div>
              <div className="text-[9px] text-[oklch(0.40_0.01_280)] uppercase tracking-widest">No</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        {(d.volume || d.openInterest || d.expiresLabel) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            {d.volume && (
              <span className="px-2 py-0.5 rounded-md bg-[oklch(0.16_0.02_280)] text-[11px] font-medium text-[oklch(0.60_0.01_280)]">
                Vol: {d.volume}
              </span>
            )}
            {d.openInterest && (
              <span className="px-2 py-0.5 rounded-md bg-[oklch(0.16_0.02_280)] text-[11px] font-medium text-[oklch(0.60_0.01_280)]">
                OI: {d.openInterest}
              </span>
            )}
            {d.expiresLabel && (
              <span className="inline-flex items-center gap-1 ml-auto text-[oklch(0.45_0.01_280)]">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {d.expiresLabel}
              </span>
            )}
          </div>
        )}

        {/* Recommendation */}
        {d.recommendation && (
          <div className={cn(
            'flex items-center gap-2 mt-3 px-3 py-2 rounded-xl border',
            yesPct >= 60 ? 'bg-emerald-500/10 border-emerald-500/20' :
            yesPct <= 40 ? 'bg-red-500/10 border-red-500/20' :
            'bg-[oklch(0.14_0.015_280)] border-[oklch(0.22_0.02_280)]',
          )}>
            <BarChart3 className={cn('w-3.5 h-3.5 shrink-0',
              yesPct >= 60 ? 'text-emerald-400' : yesPct <= 40 ? 'text-red-400' : 'text-[oklch(0.50_0.01_280)]'
            )} />
            <span className={cn('text-xs font-semibold',
              yesPct >= 60 ? 'text-emerald-400' : yesPct <= 40 ? 'text-red-400' : 'text-[oklch(0.60_0.01_280)]'
            )}>
              {d.recommendation}
            </span>
          </div>
        )}

        {/* Footer */}
        {(d.ticker || d.closeTime) && (
          <div className="flex items-center justify-between mt-2 text-[9px] text-[oklch(0.35_0.01_280)]">
            {d.ticker && <span className="font-mono">{d.ticker}</span>}
            {d.closeTime && <span>Closes {d.closeTime}</span>}
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
            aria-label={`Analyze ${title}`}
          >
            View Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
