'use client';

import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface PlayerPropCardProps {
  data: Record<string, any>;
  category: string;
  gradient: string;
  onAnalyze?: () => void;
  isHero?: boolean;
}

export function PlayerPropCard({ data, category, gradient, onAnalyze, isHero }: PlayerPropCardProps) {
  const overRaw  = String(data.over  ?? '');
  const underRaw = String(data.under ?? '');
  const overNum  = parseFloat(overRaw);
  const underNum = parseFloat(underRaw);
  const overStr  = !isNaN(overNum)  ? (overNum  > 0 ? `+${overNum}`  : String(overNum))  : overRaw;
  const underStr = !isNaN(underNum) ? (underNum > 0 ? `+${underNum}` : String(underNum)) : underRaw;

  const hitRate  = parseFloat(String(data.hitRate ?? '').replace('%', ''));
  const hasHitRate = !isNaN(hitRate) && hitRate > 0;
  const hitColor = hasHitRate
    ? hitRate >= 60 ? 'text-emerald-400' : hitRate >= 45 ? 'text-amber-400' : 'text-red-400'
    : '';
  const hitBarColor = hasHitRate
    ? hitRate >= 60 ? 'bg-emerald-500' : hitRate >= 45 ? 'bg-amber-500' : 'bg-red-500'
    : 'bg-blue-500';
  const hitLabel = hasHitRate
    ? hitRate >= 60 ? 'OVER LEAN' : hitRate >= 45 ? 'NEUTRAL' : 'UNDER LEAN'
    : '';

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] transition-all duration-300 shadow-lg',
      isHero && 'sm:rounded-3xl',
    )}>
      <div className="px-4 pt-3.5 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.42_0.01_280)]">{category} · Player Props</span>
            <h3 className="text-sm font-black text-white mt-0.5 truncate">{data.player}</h3>
            <p className="text-xs text-[oklch(0.45_0.01_280)] mt-0.5">
              {data.stat}
              {data.line !== undefined && (
                <> — Line: <span className="text-white font-semibold">{data.line}</span></>
              )}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20 uppercase tracking-wider shrink-0">LIVE</span>
        </div>

        {/* Over / Under odds */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[oklch(0.08_0.01_280)] rounded-xl border border-[oklch(0.16_0.015_280)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Over {data.line}</p>
            <p className={cn('text-lg font-black tabular-nums', !isNaN(overNum) && overNum > 0 ? 'text-emerald-400' : 'text-red-400')}>{overStr}</p>
          </div>
          <div className="bg-[oklch(0.08_0.01_280)] rounded-xl border border-[oklch(0.16_0.015_280)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Under {data.line}</p>
            <p className={cn('text-lg font-black tabular-nums', !isNaN(underNum) && underNum > 0 ? 'text-emerald-400' : 'text-red-400')}>{underStr}</p>
          </div>
        </div>

        {/* Hit rate bar */}
        {hasHitRate && (
          <div className="rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-3 py-2.5 space-y-1.5">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wide">
              <span className="text-[oklch(0.40_0.01_280)]">Historical Hit Rate</span>
              <span className="flex items-center gap-1.5">
                <span className={cn('font-black tabular-nums', hitColor)}>{hitRate.toFixed(0)}%</span>
                {hitLabel && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[8px] font-black border',
                    hitRate >= 60 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : hitRate >= 45 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400',
                  )}>{hitLabel}</span>
                )}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', hitBarColor)}
                style={{ width: `${Math.min(100, hitRate)}%` }}
              />
            </div>
          </div>
        )}

        {/* Game context footer */}
        <div className="border-t border-[oklch(0.16_0.015_280)] pt-2.5 space-y-1">
          {data.game && <p className="text-[11px] text-[oklch(0.48_0.01_280)] truncate">{data.game}</p>}
          <div className="flex items-center justify-between">
            {data.gameTime && <p className="text-[10px] text-[oklch(0.38_0.01_280)]">{data.gameTime}</p>}
            {data.bookmaker && <span className="text-[9px] text-[oklch(0.35_0.01_280)] uppercase tracking-wider">{data.bookmaker}</span>}
          </div>
        </div>

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] transition-all duration-150"
          >
            Analyze Prop
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
