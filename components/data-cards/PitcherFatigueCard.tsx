'use client';

import { Wind, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PitcherFatigueData {
  pitcherName?: string;
  fatigueMultiplier?: string | number;
  fatigueLabel?: 'fresh' | 'normal' | 'tired' | 'at-risk';
  pitchCountLastStart?: string | number;
  inningsLastStart?: string | number;
  daysRest?: string | number;
  pitchCountLast7Days?: string | number;
  bettingImpact?: string;
  description?: string;
  note?: string;
}

interface PitcherFatigueCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: PitcherFatigueData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

const LABEL_STYLES = {
  fresh:    {
    bar: '#10b981',
    badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    badgeGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    header: 'from-emerald-600/25 dark:via-teal-900/10 to-transparent',
    heroText: 'text-emerald-300',
    heroGlow: 'drop-shadow(0 0 8px rgba(16,185,129,0.5))',
    label: 'FRESH',
  },
  normal:   {
    bar: '#3b82f6',
    badge: 'bg-blue-500/15 border-blue-500/40 text-blue-300',
    badgeGlow: 'shadow-[0_0_12px_rgba(59,130,246,0.25)]',
    header: 'from-blue-600/25 dark:via-indigo-900/10 to-transparent',
    heroText: 'text-blue-300',
    heroGlow: 'drop-shadow(0 0 8px rgba(59,130,246,0.5))',
    label: 'NORMAL',
  },
  tired:    {
    bar: '#f59e0b',
    badge: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    badgeGlow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    header: 'from-amber-600/25 dark:via-orange-900/10 to-transparent',
    heroText: 'text-amber-300',
    heroGlow: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))',
    label: 'TIRED',
  },
  'at-risk': {
    bar: '#ef4444',
    badge: 'bg-red-500/15 border-red-500/40 text-red-300',
    badgeGlow: 'shadow-[0_0_12px_rgba(239,68,68,0.25)]',
    header: 'from-red-600/30 dark:via-rose-900/15 to-transparent',
    heroText: 'text-red-300',
    heroGlow: 'drop-shadow(0 0 8px rgba(239,68,68,0.5))',
    label: 'AT-RISK',
  },
};

export function PitcherFatigueCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: PitcherFatigueCardProps) {
  const label = data.fatigueLabel ?? 'normal';
  const styles = LABEL_STYLES[label] ?? LABEL_STYLES.normal;
  const multiplier = Number(data.fatigueMultiplier ?? 1);
  // Map 0.80–1.50 multiplier range to 0–100% bar
  const barPct = Math.min(100, Math.max(0, ((multiplier - 0.80) / 0.70) * 100));

  const pitchCount = Number(data.pitchCountLastStart ?? 0);
  const daysRest   = Number(data.daysRest ?? 4);
  const isHighCount  = pitchCount > 105;
  const isShortRest  = daysRest > 0 && daysRest <= 3;

  const recText =
    label === 'at-risk' ? 'Avoid in DFS — high fatigue, decline likely'
    : label === 'tired'  ? 'Fade K/IP overs — reduced velocity expected'
    : label === 'normal' ? 'Standard projection applies'
    : 'Favorable start — target in DFS & parlays';

  const recStyle =
    label === 'at-risk' ? 'bg-red-500/10 border-red-500/20 text-red-300'
    : label === 'tired'  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';

  // Pitch count bar vs typical 100-pitch start
  const pitchCountPct = pitchCount > 0 ? Math.min(100, (pitchCount / 120) * 100) : 0;

  // Days rest chip
  const restChipStyle = daysRest >= 5 ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
    : daysRest >= 4 ? 'bg-blue-500/15 border-blue-500/25 text-blue-300'
    : 'bg-red-500/15 border-red-500/25 text-red-300';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
        'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_24px_rgba(59,130,246,0.08)]',
        isHero && 'sm:rounded-3xl',
      )}
    >
      {/* ── Header ── */}
      <div className={cn('relative px-4 pt-4 pb-3 bg-gradient-to-br border-b border-[var(--border-subtle)]', styles.header)}>
        {/* Fatigue level badge — prominent top-right */}
        <div className={cn('absolute top-3 right-3 text-[9px] font-black px-2.5 py-1.5 rounded-xl border uppercase tracking-widest', styles.badge, styles.badgeGlow)}>
          {styles.label}
        </div>

        {/* Sport chip */}
        <div className="flex items-center gap-1.5 mb-2">
          <Wind className="w-3 h-3 text-white/30" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{category} · {subcategory}</span>
        </div>

        {/* Pitcher name hero */}
        {data.pitcherName && (
          <h3 className="text-base font-black text-white truncate pr-20 mb-0.5">{data.pitcherName}</h3>
        )}
        <p className="text-[10px] text-white/40 truncate pr-20">{title}</p>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">

        {/* ── Fatigue multiplier meter ── */}
        <div className="rounded-xl bg-white/3 border border-white/6 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/35">Fatigue Multiplier</span>
            <span className={cn('text-xl font-black tabular-nums', styles.heroText)}>
              {multiplier.toFixed(2)}×
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${barPct}%`,
                background: styles.bar,
                boxShadow: `0 0 8px ${styles.bar}60`,
              }}
              role="meter"
              aria-valuenow={barPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="flex justify-between text-[8px] text-white/25">
            <span>Fresh (0.80)</span>
            <span>At Risk (1.50)</span>
          </div>
        </div>

        {/* ── Stat grid ── */}
        <div className="grid grid-cols-3 gap-2">
          {data.pitchCountLastStart !== undefined && (
            <div className="flex flex-col items-center rounded-xl bg-white/3 border border-white/6 p-2.5 gap-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Last Start</span>
              <span className={cn('text-lg font-black tabular-nums', isHighCount ? 'text-amber-300' : 'text-white')}>
                {data.pitchCountLastStart}
              </span>
              <span className="text-[8px] text-white/25">pitches</span>
            </div>
          )}
          {data.daysRest !== undefined && (
            <div className="flex flex-col items-center rounded-xl bg-white/3 border border-white/6 p-2.5 gap-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Days Rest</span>
              <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-lg border', restChipStyle)}>
                <Calendar className="w-2.5 h-2.5" />
                <span className="text-sm font-black tabular-nums">{data.daysRest}d</span>
              </div>
            </div>
          )}
          {data.inningsLastStart !== undefined && (
            <div className="flex flex-col items-center rounded-xl bg-white/3 border border-white/6 p-2.5 gap-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Innings</span>
              <span className="text-lg font-black tabular-nums text-white">{data.inningsLastStart}</span>
              <span className="text-[8px] text-white/25">IP</span>
            </div>
          )}
        </div>

        {/* ── Pitch count bar vs typical 100-pitch start ── */}
        {pitchCount > 0 && (
          <div className="rounded-xl bg-white/3 border border-white/6 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35">Pitch Count vs Typical Start</span>
              <span className="text-[9px] text-white/40 tabular-nums">{pitchCount} / 100</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pitchCountPct}%`,
                  background: isHighCount ? '#ef4444' : '#60a5fa',
                  boxShadow: isHighCount ? '0 0 8px rgba(239,68,68,0.5)' : '0 0 8px rgba(96,165,250,0.4)',
                }}
              />
            </div>
            {/* 100-pitch marker */}
            <div className="relative h-1">
              <div
                className="absolute top-0 bottom-0 w-px bg-white/20"
                style={{ left: `${(100 / 120) * 100}%` }}
              />
              <span
                className="absolute text-[7px] text-white/25"
                style={{ left: `${(100 / 120) * 100}%`, transform: 'translateX(-50%)' }}
              >
                100
              </span>
            </div>
          </div>
        )}

        {/* ── 7-day pitches ── */}
        {data.pitchCountLast7Days !== undefined && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/6">
            <span className="text-[9px] text-white/40 uppercase tracking-wide">7-Day Pitches</span>
            <span className="text-sm font-black text-white tabular-nums">{data.pitchCountLast7Days}</span>
          </div>
        )}

        {/* ── Warning flags ── */}
        {(isHighCount || isShortRest) && (
          <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5 space-y-1">
            {isHighCount && (
              <p className="text-[10px] text-amber-300 font-semibold flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5 font-black">!</span>
                High pitch count ({pitchCount}) — velocity/command risk
              </p>
            )}
            {isShortRest && (
              <p className="text-[10px] text-amber-300 font-semibold flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5 font-black">!</span>
                Short rest ({daysRest}d) — monitor lineup/scratch
              </p>
            )}
          </div>
        )}

        {/* ── Action recommendation ── */}
        <div className={cn('rounded-xl px-3 py-2.5 text-[10px] font-semibold border', recStyle)}>
          {recText}
        </div>

        {/* ── Betting impact ── */}
        {data.bettingImpact && (
          <p className="text-[10px] text-white/50 leading-relaxed">{data.bettingImpact}</p>
        )}

        {data.description && (
          <p className="text-[10px] text-white/35 italic leading-relaxed">{data.description}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/40 transition-all duration-150"
          >
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
