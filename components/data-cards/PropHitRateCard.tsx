'use client';

import { TrendingUp, TrendingDown, Minus, Activity, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from './PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';

interface PropHitRateCardProps {
  playerName: string;
  statType: string;
  hitRatePercentage: number;
  totalGames: number;
  hits: number;
  misses: number;
  avgLine: number;
  avgActual: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  recentForm?: string;
  sport?: string;
  photoUrl?: string;
  isHero?: boolean;
}

/** Convert recentForm string like "W,W,L,W,L" into hit/miss booleans */
function parseRecentForm(recentForm?: string): boolean[] {
  if (!recentForm) return [];
  return recentForm.split(/[,\s]+/).map(r => {
    const v = r.trim().toUpperCase();
    return v === 'W' || v === 'HIT' || v === '✓' || v === 'OVER';
  });
}

export function PropHitRateCard({
  playerName,
  statType,
  hitRatePercentage,
  totalGames,
  hits,
  misses,
  avgLine,
  avgActual,
  trend,
  confidence,
  recommendation,
  recentForm,
  sport,
  photoUrl,
  isHero = false,
}: PropHitRateCardProps) {
  const isStrong = hitRatePercentage >= 65;
  const isWeak = hitRatePercentage <= 35;
  const gradient = isStrong ? 'from-emerald-600 to-green-700'
    : isWeak ? 'from-red-600 to-rose-700'
    : 'from-slate-600 to-gray-700';

  const hitColor = isStrong ? 'text-emerald-400' : isWeak ? 'text-red-400' : 'text-gray-300';

  const TrendIcon = trend === 'improving' ? TrendingUp
    : trend === 'declining' ? TrendingDown
    : trend === 'insufficient_data' ? Activity : Minus;

  const differential = avgActual - avgLine;
  const resolvedPhotoUrl = photoUrl ?? getPlayerHeadshotUrl(playerName);
  const formDots = parseRecentForm(recentForm);
  const barWidth = Math.min(100, Math.max(0, hitRatePercentage));

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border transition-all duration-200 animate-fade-in-up',
      isHero
        ? 'border-[oklch(0.26_0.025_260)] shadow-[0_0_20px_oklch(0.3_0.08_260/0.12)]'
        : 'border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)]',
    )}>
      {/* Left gradient accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 bg-gradient-to-b', isHero ? 'w-[3px]' : 'w-[2px]', gradient)} />

      <div className={cn('pl-5 pr-4 py-4', isHero && 'pl-6 pr-5 py-5')}>
        {/* Header: player photo + name + stat type */}
        <div className="flex items-center gap-3 mb-3">
          <PlayerAvatar
            playerName={playerName}
            photoUrl={resolvedPhotoUrl}
            sport={sport}
            size={isHero ? 'lg' : 'md'}
          />
          <div className="min-w-0 flex-1">
            <p className={cn('font-black text-white truncate', isHero ? 'text-base' : 'text-sm')}>{playerName}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] text-gray-500 truncate">{statType}</p>
              {(sport === 'mlb' || sport === 'baseball') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/statcast-logo.png" alt="Statcast" className="h-3 w-auto opacity-50 flex-shrink-0" />
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={cn('font-black tabular-nums', hitColor, isHero ? 'text-2xl' : 'text-xl')}>
              {hitRatePercentage.toFixed(1)}%
            </p>
            <p className="text-[10px] text-gray-600">{hits}/{totalGames} games</p>
          </div>
        </div>

        {/* Hit rate progress bar */}
        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-[oklch(0.18_0.01_280)] overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', gradient)}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Avg Line vs Actual + Edge comparison */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[
            { label: 'Avg Line',   val: avgLine.toFixed(1),   color: 'text-gray-200' },
            { label: 'Avg Actual', val: avgActual.toFixed(1), color: 'text-gray-200' },
            { label: 'Edge',       val: `${differential >= 0 ? '+' : ''}${differential.toFixed(1)}`, color: differential >= 0 ? 'text-emerald-400' : 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center rounded-lg bg-[oklch(0.10_0.01_280)] py-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">{s.label}</span>
              <span className={cn('text-sm font-black tabular-nums', s.color)}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Recent form sparkline dots */}
        {formDots.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 shrink-0">Recent</span>
            <div className="flex items-center gap-1">
              {formDots.slice(-7).map((hit, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-full',
                    isHero ? 'w-3 h-3' : 'w-2.5 h-2.5',
                    hit
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/40'
                      : 'bg-red-400/60',
                  )}
                  title={hit ? 'Hit' : 'Miss'}
                />
              ))}
            </div>
          </div>
        )}

        {/* Trend + Confidence */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <TrendIcon className={cn(
              'shrink-0',
              isHero ? 'w-4 h-4' : 'w-3.5 h-3.5',
              trend === 'improving' ? 'text-emerald-400' : trend === 'declining' ? 'text-red-400' : 'text-gray-500',
            )} />
            <span className="text-[11px] text-gray-500 capitalize">{trend.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className={cn('rounded-full w-2 h-2',
              confidence === 'high' ? 'bg-emerald-400' : confidence === 'medium' ? 'bg-amber-400' : 'bg-red-400',
            )} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{confidence}</span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-xl border border-[oklch(0.22_0.02_280)] bg-[oklch(0.10_0.01_280)] px-3 py-2.5">
          <p className="text-[11px] text-gray-400 leading-relaxed">{recommendation}</p>
        </div>
      </div>
    </article>
  );
}
