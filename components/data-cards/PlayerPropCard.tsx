'use client';

import { cn } from '@/lib/utils';
import { ChevronRight, TrendingUp } from 'lucide-react';

interface PlayerPropCardProps {
  data: Record<string, any>;
  category: string;
  gradient: string;
  onAnalyze?: () => void;
  isHero?: boolean;
}

export function PlayerPropCard({ data, category, gradient, onAnalyze, isHero }: PlayerPropCardProps) {
  // Placeholder card — props haven't posted yet or sport was wrong
  if (!data.player) {
    return (
      <article className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all duration-300',
        isHero && 'sm:rounded-3xl',
      )}>
        <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-blue-600/20 via-indigo-800/8 to-transparent border-b border-[var(--border-subtle)]">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-2">{category} · Player Props</span>
          {data.description && (
            <p className="text-sm font-bold text-white leading-snug">{data.description}</p>
          )}
        </div>
        <div className="px-4 py-3 space-y-2">
          {data.note && (
            <p className="text-[11px] text-white/50 leading-relaxed">{data.note}</p>
          )}
          {data.tip && (
            <p className="text-[10px] text-white/30 italic">{data.tip}</p>
          )}
        </div>
      </article>
    );
  }

  const overRaw  = String(data.over  ?? '');
  const underRaw = String(data.under ?? '');
  const overNum  = parseFloat(overRaw);
  const underNum = parseFloat(underRaw);
  const overStr  = !isNaN(overNum)  ? (overNum  > 0 ? `+${overNum}`  : String(overNum))  : overRaw;
  const underStr = !isNaN(underNum) ? (underNum > 0 ? `+${underNum}` : String(underNum)) : underRaw;

  const hitRate  = parseFloat(String(data.hitRate ?? '').replace('%', ''));
  const hasHitRate = !isNaN(hitRate) && hitRate > 0;
  const hitBarColor = hasHitRate
    ? hitRate >= 60 ? '#10b981' : hitRate >= 45 ? '#f59e0b' : '#ef4444'
    : '#3b82f6';
  const hitLabel = hasHitRate
    ? hitRate >= 60 ? 'OVER LEAN' : hitRate >= 45 ? 'NEUTRAL' : 'UNDER LEAN'
    : '';
  const hitLabelStyle = hasHitRate
    ? hitRate >= 60 ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
    : hitRate >= 45 ? 'bg-amber-500/15 border-amber-500/25 text-amber-300'
    : 'bg-red-500/15 border-red-500/25 text-red-300'
    : '';

  // Odds pill styling: positive = value (green), negative = chalk (slate)
  const overStyle  = !isNaN(overNum)  && overNum  > 0 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/70';
  const underStyle = !isNaN(underNum) && underNum > 0 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/70';

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all duration-300',
      isHero && 'sm:rounded-3xl',
    )}>

      {/* ── Header ── */}
      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-blue-600/25 via-indigo-800/10 to-transparent border-b border-[var(--border-subtle)]">
        {/* Live badge top-right */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-blue-300">LIVE</span>
        </div>

        {/* Sport chip */}
        <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-2">
          {category} · Player Props
        </span>

        {/* Player name hero */}
        <h3 className="text-base font-black text-white truncate pr-20">{data.player}</h3>

        {/* Stat + line */}
        <p className="text-[10px] text-white/45 mt-0.5">
          {data.stat}
          {data.line !== undefined && (
            <> · Line: <span className="text-white font-bold">{data.line}</span></>
          )}
        </p>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">

        {/* ── Over / Under odds pill buttons ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className={cn('rounded-xl border p-3 text-center', overStyle)}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 opacity-60">
              Over {data.line}
            </p>
            <p className="text-2xl font-black tabular-nums">{overStr}</p>
          </div>
          <div className={cn('rounded-xl border p-3 text-center', underStyle)}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 opacity-60">
              Under {data.line}
            </p>
            <p className="text-2xl font-black tabular-nums">{underStr}</p>
          </div>
        </div>

        {/* ── Hit rate meter bar ── */}
        {hasHitRate && (
          <div className="rounded-xl bg-white/3 border border-white/6 px-3 py-2.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35">Historical Hit Rate</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black tabular-nums text-white">{hitRate.toFixed(0)}%</span>
                {hitLabel && (
                  <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded-md border', hitLabelStyle)}>
                    {hitLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, hitRate)}%`,
                  background: hitBarColor,
                  boxShadow: `0 0 8px ${hitBarColor}50`,
                }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-white/25">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* ── Game context footer ── */}
        <div className="rounded-xl bg-white/3 border border-white/6 px-3 py-2.5 space-y-1">
          {data.game && <p className="text-[10px] text-white/50 truncate font-medium">{data.game}</p>}
          <div className="flex items-center justify-between">
            {data.gameTime && (
              <span className="text-[9px] text-white/30">{data.gameTime}</span>
            )}
            {data.bookmaker && (
              <span className="text-[8px] text-white/25 uppercase tracking-wider font-bold">{data.bookmaker}</span>
            )}
          </div>
        </div>

        {/* ── Analyze CTA ── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/40 transition-all duration-150"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Analyze Prop
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
