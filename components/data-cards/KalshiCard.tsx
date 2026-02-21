'use client';

import {
  TrendingUp, Vote, Trophy, CloudRain, TrendingDown,
  Cpu, Film, Globe, BarChart3, Clock, Layers, ChevronRight,
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

// Category → icon mapping
function CategoryIcon({ label, className }: { label?: string; className?: string }) {
  const cls = cn('w-5 h-5', className);
  switch (label) {
    case 'election': return <Vote className={cls} />;
    case 'sports':   return <Trophy className={cls} />;
    case 'weather':  return <CloudRain className={cls} />;
    case 'finance':  return <TrendingDown className={cls} />;
    case 'tech':     return <Cpu className={cls} />;
    case 'entertainment': return <Film className={cls} />;
    default:         return <Globe className={cls} />;
  }
}

// YES/NO probability gauge bar
function ProbabilityGauge({ yesPct, noPct }: { yesPct: number; noPct: number }) {
  const yes = Math.max(0, Math.min(100, yesPct));
  const no  = Math.max(0, Math.min(100, noPct));

  const yesColor =
    yes >= 70 ? 'bg-emerald-500' :
    yes >= 55 ? 'bg-green-500'   :
    yes >= 45 ? 'bg-slate-500'   :
    yes >= 30 ? 'bg-orange-500'  : 'bg-red-500';

  return (
    <div className="space-y-2">
      {/* Label row */}
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-emerald-400">YES  {yes}¢</span>
        <span className="text-gray-500 text-[10px] font-normal">implied probability</span>
        <span className="text-red-400">NO  {no}¢</span>
      </div>

      {/* Bicolor bar */}
      <div className="relative h-3 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={cn('absolute left-0 top-0 h-full rounded-l-full transition-all duration-700', yesColor)}
          style={{ width: `${yes}%` }}
        />
        <div
          className="absolute right-0 top-0 h-full bg-red-500/60 rounded-r-full transition-all duration-700"
          style={{ width: `${no}%` }}
        />
        {/* 50% tick */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600/80" />
      </div>

      {/* Pct labels */}
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className={cn('text-lg font-black tabular-nums', yes >= 50 ? 'text-emerald-400' : 'text-gray-500')}>
            {yes}%
          </div>
          <div className="text-[9px] text-gray-600 uppercase tracking-widest">Yes</div>
        </div>
        <div className="text-[9px] text-gray-700 text-center px-2">vs</div>
        <div className="text-center">
          <div className={cn('text-lg font-black tabular-nums', no >= 50 ? 'text-red-400' : 'text-gray-500')}>
            {no}%
          </div>
          <div className="text-[9px] text-gray-600 uppercase tracking-widest">No</div>
        </div>
      </div>
    </div>
  );
}

// Compact stat pill
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-gray-900/50 border border-gray-800/60">
      <span className={cn('text-xs font-bold tabular-nums', accent ? 'text-white' : 'text-gray-300')}>
        {value}
      </span>
      <span className="text-[9px] text-gray-600 uppercase tracking-wide">{label}</span>
    </div>
  );
}

export function KalshiCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isLoading,
  error,
}: KalshiCardProps) {
  const d = data as any;

  // Numeric probability (from enhanced kalshiMarketToCard)
  const yesPct: number = typeof d.yesPct === 'number' ? d.yesPct : parseFloat(d.yesPrice) || 50;
  const noPct: number  = typeof d.noPct  === 'number' ? d.noPct  : 100 - yesPct;
  const edgeScore: number = typeof d.edgeScore === 'number' ? d.edgeScore : Math.round(Math.abs(yesPct - 50) * 2);

  const edgeBadgeColor =
    edgeScore >= 50 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/25' :
    edgeScore >= 25 ? 'bg-amber-500/20 text-amber-400 border-amber-500/25' :
    'bg-gray-700/40 text-gray-500 border-gray-700/50';

  const isActive = status === 'active' || status === 'open';

  return (
    <article
      className={cn(
        'group relative rounded-2xl overflow-hidden border shadow-xl',
        'bg-gradient-to-br from-gray-900/98 via-gray-900/98 to-gray-950/98',
        'border-gray-700/40 hover:border-gray-500/60',
        'transition-all duration-300 hover:shadow-2xl hover:shadow-gray-950/60',
      )}
    >
      {/* Gradient accent top bar */}
      <div className={cn('h-1 w-full bg-gradient-to-r', gradient)} />

      {/* Hover glow overlay */}
      <div
        className={cn('absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-700 bg-gradient-to-br pointer-events-none', gradient)}
      />

      <div className="relative p-5 space-y-4">
        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          {/* Category icon */}
          <div className={cn('p-2.5 rounded-xl bg-gradient-to-br flex-shrink-0 shadow-lg', gradient)}>
            <CategoryIcon label={d.iconLabel} className="text-white" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">KALSHI</span>
              <span className="text-gray-700">•</span>
              <span className="text-[10px] text-gray-600 truncate">{subcategory || category}</span>
            </div>
            <h3 className="text-sm font-bold text-white leading-snug line-clamp-2" title={title}>
              {title}
            </h3>
          </div>

          {/* Status pill */}
          <div className={cn(
            'flex-shrink-0 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide',
            isActive
              ? 'bg-green-500/15 text-green-400 border-green-500/25'
              : 'bg-gray-700/40 text-gray-500 border-gray-700/50'
          )}>
            {isActive ? 'LIVE' : 'CLOSED'}
          </div>
        </div>

        {/* ── Subtitle (question detail) ── */}
        {d.subtitle && d.subtitle !== title && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{d.subtitle}</p>
        )}

        {/* ── Probability gauge ── */}
        <ProbabilityGauge yesPct={yesPct} noPct={noPct} />

        {/* ── Stats row ── */}
        <div className="flex items-center gap-2">
          {d.volume     && <Stat label="Volume" value={d.volume} accent />}
          {d.openInterest && <Stat label="OI" value={d.openInterest} />}
          {d.expiresLabel && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-900/50 border border-gray-800/60 ml-auto flex-shrink-0">
              <Clock className="w-3 h-3 text-gray-600" />
              <span className="text-[10px] text-gray-500">{d.expiresLabel}</span>
            </div>
          )}
        </div>

        {/* ── Market depth indicator ── */}
        {d.volumeTier && (
          <div className="flex items-center gap-2">
            <Layers className="w-3 h-3 text-gray-700" />
            <span className="text-[10px] text-gray-600">
              Liquidity: <span className="text-gray-500 font-semibold">{d.volumeTier}</span>
            </span>
            {edgeScore > 0 && (
              <div className={cn('ml-auto px-2 py-0.5 rounded-md border text-[10px] font-bold', edgeBadgeColor)}>
                {edgeScore}% Edge
              </div>
            )}
          </div>
        )}

        {/* ── Signal / recommendation ── */}
        {d.recommendation && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border',
            yesPct >= 60 ? 'bg-emerald-500/10 border-emerald-500/20' :
            yesPct <= 40 ? 'bg-red-500/10 border-red-500/20' :
            'bg-gray-800/40 border-gray-700/40',
          )}>
            <BarChart3 className={cn(
              'w-3.5 h-3.5 flex-shrink-0',
              yesPct >= 60 ? 'text-emerald-400' :
              yesPct <= 40 ? 'text-red-400' : 'text-gray-500'
            )} />
            <span className={cn(
              'text-xs font-semibold',
              yesPct >= 60 ? 'text-emerald-400' :
              yesPct <= 40 ? 'text-red-400' : 'text-gray-500'
            )}>
              {d.recommendation}
            </span>
          </div>
        )}

        {/* Ticker & close date small print */}
        <div className="flex items-center justify-between text-[9px] text-gray-700">
          {d.ticker && <span className="font-mono">{d.ticker}</span>}
          {d.closeTime && <span>Closes {d.closeTime}</span>}
        </div>

        {/* ── Analyze button ── */}
        {onAnalyze && (
          <div className="pt-3 border-t border-gray-800/60">
            <button
              onClick={onAnalyze}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl',
                'text-xs font-bold text-gray-400 hover:text-white',
                'bg-gray-800/40 hover:bg-gray-700/50 border border-gray-700/40 hover:border-gray-600/60',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/40',
              )}
              aria-label="View analysis for this market"
            >
              <span>View Analysis</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
