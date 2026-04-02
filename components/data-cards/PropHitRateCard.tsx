'use client';

import { memo, useState, useEffect, useId } from 'react';
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

  const size = isHero ? 72 : 60;
  const r = (size / 2) - 7;
  const circumference = 2 * Math.PI * r;
  const offset = animated ? circumference * (1 - Math.min(100, pct) / 100) : circumference;
  const color =
    pct >= 80 ? '#10b981' :
    pct >= 65 ? '#3b82f6' :
    pct >= 50 ? '#f59e0b' :
    pct >= 35 ? '#f97316' : '#ef4444';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
           className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" strokeWidth="5" fill="none"
          className="text-[var(--bg-surface)]" />
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth="5" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black tabular-nums leading-none"
              style={{ fontSize: isHero ? 14 : 12, color }}>
          {pct.toFixed(0)}%
        </span>
        <span className="text-[7px] font-black uppercase tracking-wide text-[var(--text-faint)]">
          hit
        </span>
      </div>
    </div>
  );
}

// ── Hit Rate Grade Badge ───────────────────────────────────────────────────────

function HitRateGrade({ pct }: { pct: number }) {
  const grade = pct >= 80 ? 'A' : pct >= 65 ? 'B' : pct >= 50 ? 'C' : pct >= 35 ? 'D' : 'F';
  const cls = pct >= 80 ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30'
    : pct >= 65 ? 'bg-blue-500/15 text-blue-400 ring-blue-500/30'
    : pct >= 50 ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
    : pct >= 35 ? 'bg-orange-500/15 text-orange-400 ring-orange-500/30'
    : 'bg-red-500/15 text-red-400 ring-red-500/30';
  return (
    <div className={cn('w-6 h-6 rounded-full ring-1 flex items-center justify-center shrink-0', cls)}>
      <span className="text-[10px] font-black">{grade}</span>
    </div>
  );
}

// ── Recent Form Bar Sparkline ──────────────────────────────────────────────────

function parseRecentForm(recentForm?: string): boolean[] {
  if (!recentForm) return [];
  return recentForm.split(/[,\s]+/).map(r => {
    const v = r.trim().toUpperCase();
    return v === 'W' || v === 'HIT' || v === '✓' || v === 'OVER';
  });
}

function FormBars({ dots }: { dots: boolean[] }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t); }, []);

  if (dots.length === 0) return null;
  const last10 = dots.slice(-10);

  return (
    <div className="space-y-1">
      <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-faint)]">
        Recent form
      </span>
      <div className="flex items-end gap-0.5 h-6">
        {last10.map((hit, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm min-w-[5px] transition-all duration-500"
            style={{
              height: animated ? (hit ? '100%' : '40%') : '0%',
              transitionDelay: `${i * 40}ms`,
              backgroundColor: hit ? '#10b981cc' : '#ef444466',
            }}
            title={hit ? 'Hit' : 'Miss'}
          />
        ))}
      </div>
      <div className="flex justify-between text-[7px] text-[var(--text-faint)]">
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
  const accentGradient = isStrong ? 'from-emerald-600 to-green-700'
    : isWeak ? 'from-red-600 to-rose-700'
    : 'from-slate-600 to-gray-700';

  const TrendIcon = trend === 'improving' ? TrendingUp
    : trend === 'declining' ? TrendingDown
    : trend === 'insufficient_data' ? Activity : Minus;

  const differential = avgActual - avgLine;
  const resolvedPhotoUrl = photoUrl ?? getPlayerHeadshotUrl(playerName);
  const formDots = parseRecentForm(recentForm);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-overlay)] border transition-all duration-200 animate-fade-in-up',
      isHero
        ? 'border-[var(--border-hover)] shadow-[0_0_20px_oklch(0.3_0.08_260/0.12)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
    )}>
      {/* Left accent bar */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 bg-gradient-to-b',
        isHero ? 'w-[3px]' : 'w-[2px]',
        accentGradient,
      )} />

      <div className={cn('pl-5 pr-4 py-4', isHero && 'pl-6 pr-5 py-5')}>

        {/* Header: avatar + name/stat + ring gauge */}
        <div className="flex items-center gap-3 mb-3">
          <PlayerAvatar
            playerName={playerName}
            photoUrl={resolvedPhotoUrl}
            sport={sport}
            size={isHero ? 'lg' : 'md'}
          />
          <div className="min-w-0 flex-1">
            <p className={cn('font-black text-foreground truncate', isHero ? 'text-base' : 'text-sm')}>
              {playerName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[11px] text-[var(--text-faint)] truncate">{statType}</p>
              <HitRateGrade pct={hitRatePercentage} />
              {(sport === 'mlb' || sport === 'baseball') && (
                <img src="/statcast-logo.png" alt="Statcast"
                     className="h-3 w-auto opacity-50 flex-shrink-0" />
              )}
            </div>
            {/* Sample-size warning */}
            {totalGames < 10 && (
              <span className="inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                Small sample ({totalGames} games)
              </span>
            )}
          </div>

          {/* Ring gauge */}
          <HitRateRing pct={hitRatePercentage} isHero={isHero} />
        </div>

        {/* Hit rate progress bar */}
        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface)] overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', accentGradient)}
              style={{ width: `${Math.min(100, Math.max(0, hitRatePercentage))}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] mt-0.5 text-[var(--text-faint)]">
            <span>{hits} hits</span>
            <span>{totalGames} games</span>
            <span>{misses} misses</span>
          </div>
        </div>

        {/* Avg Line vs Actual + Edge */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[
            { label: 'Avg Line',   val: avgLine.toFixed(1),   color: 'text-foreground' },
            { label: 'Avg Actual', val: avgActual.toFixed(1), color: 'text-foreground' },
            {
              label: 'Edge',
              val: `${differential >= 0 ? '+' : ''}${differential.toFixed(1)}`,
              color: differential >= 0 ? 'text-emerald-400' : 'text-red-400',
            },
          ].map(s => (
            <div key={s.label}
                 className="flex flex-col items-center rounded-lg bg-[var(--bg-overlay)] border border-[var(--border-subtle)] py-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                {s.label}
              </span>
              <span className={cn('text-sm font-black tabular-nums', s.color)}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Recent form bars */}
        {formDots.length > 0 && (
          <div className="mb-3">
            <FormBars dots={formDots} />
          </div>
        )}

        {/* Trend + Confidence */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <TrendIcon className={cn(
              'shrink-0',
              isHero ? 'w-4 h-4' : 'w-3.5 h-3.5',
              trend === 'improving' ? 'text-emerald-400'
              : trend === 'declining' ? 'text-red-400'
              : 'text-[var(--text-faint)]',
            )} />
            <span className="text-[11px] text-[var(--text-muted)] capitalize">
              {trend.replace('_', ' ')}
            </span>
          </div>
          <span className={cn(
            'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ml-auto',
            confidence === 'high'   ? 'bg-emerald-500/15 text-emerald-400'
            : confidence === 'medium' ? 'bg-amber-500/15 text-amber-400'
            : 'bg-red-500/15 text-red-400',
          )}>
            {confidence} conf
          </span>
        </div>

        {/* Recommendation */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-2.5 mb-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-1 block">
            Recommendation
          </span>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{recommendation}</p>
        </div>

        {/* AI Analysis CTA */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-1 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] transition-all duration-150"
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
