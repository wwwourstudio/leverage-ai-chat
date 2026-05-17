'use client';

import { memo, useState, useEffect, useId } from 'react';
import Image from 'next/image';
import { TrendingUp, TrendingDown, Minus, Activity, BarChart2, ChevronRight } from 'lucide-react';
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
  onAnalyze?: () => void;
}

// ── Hit Rate Ring Gauge ────────────────────────────────────────────────────────

function HitRateRing({ pct, isHero }: { pct: number; isHero?: boolean }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 80); return () => clearTimeout(t); }, []);

  const size = isHero ? 80 : 68;
  const r = (size / 2) - 8;
  const circumference = 2 * Math.PI * r;
  const offset = animated ? circumference * (1 - Math.min(100, pct) / 100) : circumference;
  const color =
    pct >= 80 ? '#10b981' :
    pct >= 65 ? '#3b82f6' :
    pct >= 50 ? '#f59e0b' :
    pct >= 35 ? '#f97316' : '#ef4444';

  const grade = pct >= 80 ? 'A' : pct >= 65 ? 'B' : pct >= 50 ? 'C' : pct >= 35 ? 'D' : 'F';

  return (
    <div className="relative shrink-0 flex flex-col items-center gap-1" style={{ width: size }}>
      <div style={{ width: size, height: size }} className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
             className="-rotate-90" aria-hidden="true">
          {/* Outer glow track */}
          <circle cx={size / 2} cy={size / 2} r={r}
            stroke="var(--border-subtle)" strokeWidth="6" fill="none" />
          {/* Progress ring */}
          <circle cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth="6" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 700ms cubic-bezier(0.4,0,0.2,1)',
              filter: `drop-shadow(0 0 4px ${color}80)`,
            }} />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-black tabular-nums leading-none text-[var(--foreground)]"
                style={{ fontSize: isHero ? 15 : 13 }}>
            {pct.toFixed(0)}%
          </span>
          <span className="text-[8px] font-black uppercase tracking-wider" style={{ color, marginTop: 1 }}>
            {grade}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Recent Form Squares ───────────────────────────────────────────────────────

function parseRecentForm(recentForm?: string): boolean[] {
  if (!recentForm) return [];
  return recentForm.split(/[,\s]+/).map(r => {
    const v = r.trim().toUpperCase();
    return v === 'W' || v === 'HIT' || v === '✓' || v === 'OVER';
  });
}

function rateChipClass(pct: number): string {
  return pct >= 60 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : pct >= 40 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    : 'bg-red-500/15 text-red-400 border-red-500/20';
}

function RecentFormSquares({ dots }: { dots: boolean[] }) {
  const last5 = dots.slice(-5);
  const last10 = dots.slice(-10);
  const l5Rate  = last5.length  >= 3 ? Math.round((last5.filter(Boolean).length  / last5.length)  * 100) : null;
  const l10Rate = last10.length > 0  ? Math.round((last10.filter(Boolean).length / last10.length) * 100) : null;

  if (dots.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/35">Recent Form</span>
        <div className="flex items-center gap-1">
          {l5Rate !== null && (
            <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded-md border', rateChipClass(l5Rate))}>
              L5: {l5Rate}%
            </span>
          )}
          {l10Rate !== null && (
            <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded-md border', rateChipClass(l10Rate))}>
              L10: {l10Rate}%
            </span>
          )}
        </div>
      </div>
      {/* Last 5 game squares */}
      <div className="flex gap-1">
        {last5.map((hit, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-6 rounded-md flex items-center justify-center text-[9px] font-black transition-all duration-300 animate-scale-in',
              hit
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : 'bg-red-500/15 border border-red-500/30 text-red-400',
            )}
            style={{ animationDelay: `${i * 50}ms` }}
            title={hit ? 'Hit' : 'Miss'}
          >
            {hit ? 'H' : 'M'}
          </div>
        ))}
      </div>
      {/* Bar visualization for last 10 */}
      {last10.length > 5 && (
        <div className="flex items-end gap-0.5 h-4">
          {last10.map((hit, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: hit ? '100%' : '40%',
                backgroundColor: hit ? '#10b98180' : '#ef444450',
              }}
            />
          ))}
        </div>
      )}
      <div className="flex justify-between text-[8px] text-[var(--foreground)]/35">
        <span>{last10.filter(Boolean).length}H / {last10.filter(h => !h).length}M</span>
        <span>last {last10.length}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const PropHitRateCard = memo(function PropHitRateCard({
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
  onAnalyze,
}: PropHitRateCardProps) {
  const isStrong = hitRatePercentage >= 65;
  const isWeak   = hitRatePercentage <= 35;

  const headerGrad = isStrong
    ? 'from-emerald-500/8 to-transparent dark:from-emerald-600/25 dark:via-teal-900/10'
    : isWeak
    ? 'from-red-500/8 to-transparent dark:from-red-600/25 dark:via-rose-900/10'
    : 'from-blue-500/8 to-transparent dark:from-blue-600/25 dark:via-indigo-900/10';

  const barColor = isStrong ? '#10b981' : isWeak ? '#ef4444' : '#f59e0b';

  const TrendIcon = trend === 'improving' ? TrendingUp
    : trend === 'declining' ? TrendingDown
    : trend === 'insufficient_data' ? Activity : Minus;

  const trendColor = trend === 'improving' ? 'text-emerald-400'
    : trend === 'declining' ? 'text-red-400'
    : 'text-[var(--foreground)]/40';

  const differential = avgActual - avgLine;
  const resolvedPhotoUrl = photoUrl ?? getPlayerHeadshotUrl(playerName);
  const formDots = parseRecentForm(recentForm);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
      isHero
        ? 'border-blue-500/30 shadow-[0_0_24px_rgba(59,130,246,0.10)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]',
    )}>

      {/* ── Header ── */}
      <div className={cn('relative px-4 pt-4 pb-3 bg-gradient-to-br border-b border-[var(--border-subtle)]', headerGrad)}>
        {/* Confidence badge */}
        <div className="absolute top-3 right-3">
          <span className={cn(
            'text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border animate-badge-pop',
            confidence === 'high'   ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : confidence === 'medium' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            : 'bg-red-500/15 border-red-500/30 text-red-300',
          )}>
            {confidence.toUpperCase()} CONF
          </span>
        </div>

        {/* Sport chip */}
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/40 block mb-2">
          {sport ? sport.toUpperCase() : 'MLB'} · Prop Hit Rate
        </span>

        {/* Player + stat + ring */}
        <div className="flex items-start gap-3 pr-20">
          <PlayerAvatar
            playerName={playerName}
            photoUrl={resolvedPhotoUrl}
            sport={sport}
            size={isHero ? 'lg' : 'md'}
          />
          <div className="min-w-0 flex-1">
            <h3 className={cn('font-black text-[var(--foreground)] truncate', isHero ? 'text-lg' : 'text-sm')}>
              {playerName}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] text-[var(--foreground)]/45 truncate">{statType}</p>
              {totalGames < 10 && (
                <span className="inline-flex text-[8px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">
                  Small ({totalGames}g)
                </span>
              )}
            </div>
            {/* Line display */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[9px] text-[var(--foreground)]/40">Line:</span>
              <span className="text-[11px] font-black text-[var(--foreground)] tabular-nums">{avgLine.toFixed(1)}</span>
              <span className="text-[9px] text-[var(--foreground)]/40">·</span>
              <span className="text-[9px] text-[var(--foreground)]/40">Avg:</span>
              <span className={cn('text-[11px] font-black tabular-nums', differential >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {avgActual.toFixed(1)}
              </span>
            </div>
          </div>
          {/* Hit rate ring */}
          <HitRateRing pct={hitRatePercentage} isHero={isHero} />
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">

        {/* ── Hit rate progress bar ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/40">Hit Rate</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[var(--foreground)] tabular-nums">{hitRatePercentage.toFixed(0)}%</span>
              {isStrong && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">OVER LEAN</span>}
              {isWeak   && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/25 text-red-400">UNDER LEAN</span>}
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--bg-overlay)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(0, hitRatePercentage))}%`,
                background: barColor,
                boxShadow: `0 0 8px ${barColor}60`,
              }}
            />
          </div>
          <div className="flex justify-between text-[8px] mt-1 text-[var(--foreground)]/35">
            <span>{hits} hits</span>
            <span>{totalGames} games</span>
            <span>{misses} misses</span>
          </div>
        </div>

        {/* ── Over / Under + Edge grid ── */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="flex flex-col items-center rounded-xl bg-emerald-500/8 border border-emerald-500/15 py-2.5 px-1">
            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400/50 mb-1">Over Hits</span>
            <span className="text-sm font-black text-emerald-300 tabular-nums">{hits}</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-red-500/8 border border-red-500/15 py-2.5 px-1">
            <span className="text-[8px] font-black uppercase tracking-wider text-red-400/50 mb-1">Misses</span>
            <span className="text-sm font-black text-red-300 tabular-nums">{misses}</span>
          </div>
          <div className={cn('flex flex-col items-center rounded-xl border py-2.5 px-1',
            differential >= 0 ? 'bg-emerald-500/8 border-emerald-500/15' : 'bg-red-500/8 border-red-500/15')}>
            <span className="text-[8px] font-black uppercase tracking-wider mb-1" style={{ color: differential >= 0 ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)' }}>Edge</span>
            <span className={cn('text-sm font-black tabular-nums', differential >= 0 ? 'text-emerald-300' : 'text-red-300')}>
              {differential >= 0 ? '+' : ''}{differential.toFixed(1)}
            </span>
          </div>
        </div>

        {/* ── Recent form squares ── */}
        {formDots.length > 0 && (
          <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
            <RecentFormSquares dots={formDots} />
          </div>
        )}

        {/* ── Trend + Confidence row ── */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <TrendIcon className={cn('shrink-0 w-3.5 h-3.5', trendColor)} />
            <span className={cn('text-[10px] font-semibold capitalize', trendColor)}>
              {trend.replace('_', ' ')}
            </span>
          </div>
          {(sport === 'mlb' || sport === 'baseball') && (
            <Image src="/statcast-logo.png" alt="Statcast" width={60} height={12} className="h-3 w-auto opacity-30 shrink-0" />
          )}
        </div>

        {/* ── Recommendation ── */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 animate-fade-in animate-delay-225">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--foreground)]/40 mb-1 block">
            AI Recommendation
          </span>
          <p className="text-[10px] text-[var(--foreground)]/60 leading-relaxed">{recommendation}</p>
        </div>

        {/* ── AI Analysis CTA ── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/40 transition-all duration-150"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            AI Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
});
