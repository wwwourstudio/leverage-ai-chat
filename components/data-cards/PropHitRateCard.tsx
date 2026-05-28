'use client';

import { memo, useState, useEffect } from 'react';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function hitRateClasses(pct: number): { bar: string; ring: string; text: string; label: string } {
  if (pct >= 80) return { bar: 'bg-emerald-500', ring: '#10b981', text: 'text-emerald-400', label: 'A' };
  if (pct >= 65) return { bar: 'bg-blue-500',    ring: '#3b82f6', text: 'text-blue-400',    label: 'B' };
  if (pct >= 50) return { bar: 'bg-amber-500',   ring: '#f59e0b', text: 'text-amber-400',   label: 'C' };
  if (pct >= 35) return { bar: 'bg-orange-500',  ring: '#f97316', text: 'text-orange-400',  label: 'D' };
  return           { bar: 'bg-red-500',     ring: '#ef4444', text: 'text-red-400',     label: 'F' };
}

function rateChipClass(pct: number): string {
  return pct >= 60 ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
    : pct >= 40 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    : 'bg-red-500/15 text-red-400 border-red-500/20';
}

function parseRecentForm(recentForm?: string): boolean[] {
  if (!recentForm) return [];
  return recentForm.split(/[,\s]+/).map(r => {
    const v = r.trim().toUpperCase();
    return v === 'W' || v === 'HIT' || v === '✓' || v === 'OVER';
  });
}

// ── Hit Rate Ring Gauge ───────────────────────────────────────────────────────

function HitRateRing({ pct, isHero }: { pct: number; isHero?: boolean }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 80); return () => clearTimeout(t); }, []);

  const size = isHero ? 80 : 68;
  const r = (size / 2) - 8;
  const circumference = 2 * Math.PI * r;
  const offset = animated ? circumference * (1 - Math.min(100, pct) / 100) : circumference;
  const { ring, text, label } = hitRateClasses(pct);

  return (
    <div className="relative shrink-0 flex flex-col items-center gap-1" style={{ width: size }}>
      <div style={{ width: size, height: size }} className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={ring} strokeWidth="6" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 700ms cubic-bezier(0.4,0,0.2,1)',
              filter: `drop-shadow(0 0 4px ${ring}80)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-black tabular-nums leading-none text-foreground', isHero ? 'text-[15px]' : 'text-[13px]')}>
            {pct.toFixed(0)}%
          </span>
          <span className={cn('text-[8px] font-black uppercase tracking-wider mt-px', text)}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Recent Form Squares ───────────────────────────────────────────────────────

function RecentFormSquares({ dots }: { dots: boolean[] }) {
  const last5  = dots.slice(-5);
  const last10 = dots.slice(-10);
  const l5Rate  = last5.length  >= 3 ? Math.round((last5.filter(Boolean).length  / last5.length)  * 100) : null;
  const l10Rate = last10.length > 0  ? Math.round((last10.filter(Boolean).length / last10.length) * 100) : null;

  if (dots.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Recent Form</span>
        <div className="flex items-center gap-1">
          {l5Rate !== null && (
            <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded-lg border', rateChipClass(l5Rate))}>
              L5: {l5Rate}%
            </span>
          )}
          {l10Rate !== null && (
            <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded-lg border', rateChipClass(l10Rate))}>
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
              'flex-1 h-6 rounded-xl flex items-center justify-center text-[9px] font-black transition-all duration-300',
              hit
                ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
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
              className={cn('flex-1 rounded-sm', hit ? 'bg-emerald-500/50' : 'bg-red-500/30')}
              style={{ height: hit ? '100%' : '40%' }}
            />
          ))}
        </div>
      )}
      <div className="flex justify-between text-[8px] text-[var(--text-faint)]">
        <span>{last10.filter(Boolean).length}H / {last10.filter(h => !h).length}M</span>
        <span>last {last10.length}</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

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

  const { bar: barCls, text: rateTextCls } = hitRateClasses(hitRatePercentage);

  const gradient = isStrong
    ? 'from-blue-500/5 dark:from-blue-600/20 dark:via-teal-900/10 to-transparent'
    : isWeak
    ? 'from-red-500/5 dark:from-red-600/20 dark:via-rose-900/10 to-transparent'
    : 'from-blue-500/3 dark:from-indigo-800/15 to-transparent';

  const accentBorder = isStrong ? 'border-blue-500/30' : isWeak ? 'border-red-500/30' : 'border-[var(--border-subtle)]';
  const accentText   = isStrong ? 'text-blue-400'       : isWeak ? 'text-red-400'       : 'text-[var(--text-muted)]';

  const TrendIcon = trend === 'improving' ? TrendingUp
    : trend === 'declining' ? TrendingDown
    : trend === 'insufficient_data' ? Activity : Minus;

  const trendColor = trend === 'improving' ? 'text-blue-400'
    : trend === 'declining' ? 'text-red-400'
    : 'text-[var(--text-faint)]';

  const differential = avgActual - avgLine;
  const resolvedPhotoUrl = photoUrl ?? getPlayerHeadshotUrl(playerName);
  const formDots = parseRecentForm(recentForm);

  const confCls = confidence === 'high'
    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
    : confidence === 'medium'
    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
    : 'bg-red-500/15 border-red-500/30 text-red-300';

  return (
    <article className={cn(
      'group relative rounded-2xl border transition-all duration-300',
      'bg-gradient-to-br', gradient,
      'backdrop-blur-sm',
      accentBorder,
      'shadow-xl shadow-black/20',
      'hover:shadow-2xl hover:shadow-black/30 hover:scale-[1.01]',
      isHero ? 'p-6' : 'p-4',
    )}>
      {/* Inner glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-4 relative">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className={cn(
            'flex-shrink-0 rounded-2xl overflow-hidden border shadow-lg',
            accentBorder,
            isHero ? 'w-12 h-12' : 'w-10 h-10',
          )}>
            <PlayerAvatar
              playerName={playerName}
              photoUrl={resolvedPhotoUrl}
              sport={sport}
              size={isHero ? 'lg' : 'md'}
            />
          </div>

          {/* Title block */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={cn('text-[9px] font-black uppercase tracking-widest', accentText)}>
                {sport ? sport.toUpperCase() : 'MLB'}
              </span>
              <span className="text-[9px] text-[var(--border-subtle)]">·</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Prop Hit Rate</span>
            </div>
            <h3 className={cn('font-black text-foreground truncate', isHero ? 'text-base' : 'text-sm')}>
              {playerName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-[var(--text-faint)] truncate">{statType}</p>
              {totalGames < 10 && (
                <span className="inline-flex text-[8px] px-1.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">
                  Small ({totalGames}g)
                </span>
              )}
            </div>
            {/* Line vs actual */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] text-[var(--text-faint)]">Line:</span>
              <span className="text-[11px] font-black text-foreground tabular-nums">{avgLine.toFixed(1)}</span>
              <span className="text-[9px] text-[var(--text-faint)]">·</span>
              <span className="text-[9px] text-[var(--text-faint)]">Avg:</span>
              <span className={cn('text-[11px] font-black tabular-nums', differential >= 0 ? 'text-blue-400' : 'text-red-400')}>
                {avgActual.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: ring + confidence badge */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={cn('text-[9px] font-black px-2 py-1 rounded-xl uppercase tracking-widest border', confCls)}>
            {confidence.toUpperCase()} CONF
          </span>
          <HitRateRing pct={hitRatePercentage} isHero={isHero} />
        </div>
      </div>

      <div className="space-y-3">
        {/* ── Hit rate bar ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Hit Rate</span>
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] font-black tabular-nums', rateTextCls)}>{hitRatePercentage.toFixed(0)}%</span>
              {isStrong && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400">OVER LEAN</span>}
              {isWeak   && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400">UNDER LEAN</span>}
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--bg-overlay)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', barCls)}
              style={{ width: `${Math.min(100, Math.max(0, hitRatePercentage))}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] mt-1 text-[var(--text-faint)]">
            <span>{hits} hits</span>
            <span>{totalGames} games</span>
            <span>{misses} misses</span>
          </div>
        </div>

        {/* ── Over / Under / Edge grid ──────────────────────────── */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="flex flex-col items-center rounded-2xl bg-blue-500/8 border border-blue-500/15 py-2.5 px-1">
            <span className="text-[8px] font-black uppercase tracking-wider text-blue-400/60 mb-1">Over Hits</span>
            <span className="text-sm font-black text-blue-300 tabular-nums">{hits}</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-red-500/8 border border-red-500/15 py-2.5 px-1">
            <span className="text-[8px] font-black uppercase tracking-wider text-red-400/60 mb-1">Misses</span>
            <span className="text-sm font-black text-red-300 tabular-nums">{misses}</span>
          </div>
          <div className={cn(
            'flex flex-col items-center rounded-2xl border py-2.5 px-1',
            differential >= 0 ? 'bg-blue-500/8 border-blue-500/15' : 'bg-red-500/8 border-red-500/15',
          )}>
            <span className={cn(
              'text-[8px] font-black uppercase tracking-wider mb-1',
              differential >= 0 ? 'text-emerald-400/60' : 'text-red-400/60',
            )}>Edge</span>
            <span className={cn('text-sm font-black tabular-nums', differential >= 0 ? 'text-blue-300' : 'text-red-300')}>
              {differential >= 0 ? '+' : ''}{differential.toFixed(1)}
            </span>
          </div>
        </div>

        {/* ── Recent form ───────────────────────────────────────── */}
        {formDots.length > 0 && (
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
            <RecentFormSquares dots={formDots} />
          </div>
        )}

        {/* ── Trend row ─────────────────────────────────────────── */}
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

        {/* ── Recommendation ────────────────────────────────────── */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-1 block">
            AI Recommendation
          </span>
          <p className="text-[10px] text-[var(--text-faint)] leading-relaxed">{recommendation}</p>
        </div>

        {/* ── CTA ───────────────────────────────────────────────── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className={cn(
              'flex items-center justify-center gap-1.5 w-full py-2.5 rounded-2xl border text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95',
              isStrong
                ? 'bg-blue-500/10 border-blue-500/25 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/40'
                : isWeak
                ? 'bg-red-500/10 border-red-500/25 text-red-300 hover:bg-red-500/20 hover:border-red-400/40'
                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-foreground',
            )}
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
