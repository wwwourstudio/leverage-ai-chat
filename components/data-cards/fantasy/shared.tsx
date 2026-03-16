'use client';

import React from 'react';
import { Trophy, Target, Zap, AlertTriangle, User, TrendingUp, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_BADGE_CONFIG, type StatusBadgeKey } from '@/lib/constants';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface FantasyCardProps {
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
  isHero?: boolean;
}

// ── Position colors — normalized to /20 opacity across all cards ──────────────

export const POS_COLORS: Record<string, string> = {
  // NFL
  QB:  'text-red-400    bg-red-400/20    border-red-400/30',
  RB:  'text-green-400  bg-green-400/20  border-green-400/30',
  WR:  'text-blue-400   bg-blue-400/20   border-blue-400/30',
  TE:  'text-orange-400 bg-orange-400/20 border-orange-400/30',
  K:   'text-purple-400 bg-purple-400/20 border-purple-400/30',
  DEF: 'text-slate-400  bg-slate-400/20  border-slate-400/30',
  // MLB
  SP:  'text-cyan-400   bg-cyan-400/20   border-cyan-400/30',
  RP:  'text-violet-400 bg-violet-400/20 border-violet-400/30',
  C:   'text-yellow-400 bg-yellow-400/20 border-yellow-400/30',
  '1B':'text-pink-400   bg-pink-400/20   border-pink-400/30',
  '2B':'text-lime-400   bg-lime-400/20   border-lime-400/30',
  '3B':'text-amber-400  bg-amber-400/20  border-amber-400/30',
  SS:  'text-teal-400   bg-teal-400/20   border-teal-400/30',
  OF:  'text-sky-400    bg-sky-400/20    border-sky-400/30',
  DH:  'text-indigo-400 bg-indigo-400/20 border-indigo-400/30',
  // NBA
  PG:  'text-blue-400   bg-blue-400/20   border-blue-400/30',
  SG:  'text-indigo-400 bg-indigo-400/20 border-indigo-400/30',
  SF:  'text-green-400  bg-green-400/20  border-green-400/30',
  PF:  'text-orange-400 bg-orange-400/20 border-orange-400/30',
  G:   'text-blue-400   bg-blue-400/20   border-blue-400/30',
  F:   'text-green-400  bg-green-400/20  border-green-400/30',
  UTIL:'text-sky-400    bg-sky-400/20    border-sky-400/30',
};

// ── PosBadge ─────────────────────────────────────────────────────────────────

export function PosBadge({ pos }: { pos: string }) {
  const c = POS_COLORS[pos] ?? 'text-gray-400 bg-gray-400/20 border-gray-400/30';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider', c)}>
      {pos}
    </span>
  );
}

// ── TierBadge ────────────────────────────────────────────────────────────────

export function TierBadge({ tier }: { tier: number }) {
  const labels = ['T1', 'T2', 'T3', 'T4'];
  const label = labels[Math.min(tier - 1, 3)] ?? 'T4';
  const c = tier === 1 ? 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30'
    : tier === 2       ? 'text-emerald-400 bg-emerald-400/20 border-emerald-400/30'
    : tier === 3       ? 'text-blue-400 bg-blue-400/20 border-blue-400/30'
    : 'text-slate-400 bg-slate-400/20 border-slate-400/30';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-black', c)}>{label}</span>
  );
}

// ── RankCircle ───────────────────────────────────────────────────────────────

export function RankCircle({ rank, tier }: { rank: number; tier: number }) {
  const c = tier === 1
    ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-300'
    : tier === 2
    ? 'bg-slate-400/15 border-slate-400/40 text-slate-300'
    : tier === 3
    ? 'bg-amber-700/20 border-amber-700/40 text-amber-500'
    : 'bg-[oklch(0.10_0.01_280)] border-[oklch(0.18_0.01_280)] text-[oklch(0.38_0.01_280)]';
  return (
    <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full border text-[9px] font-black shrink-0', c)}>
      {rank}
    </span>
  );
}

// ── Shell — shared card wrapper ───────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  target: Target,
  value: TrendingUp,
  sleeper: User,
  hot: Zap,
  alert: AlertTriangle,
  trophy: Trophy,
};

interface ShellProps {
  title: string;
  category: string;
  subcategory: string;
  status: string;
  Icon: React.ElementType;
  children: React.ReactNode;
  onAnalyze?: () => void;
  isHero?: boolean;
}

export function Shell({ title, category, subcategory, status, Icon, children, onAnalyze, isHero }: ShellProps) {
  const cfg = STATUS_BADGE_CONFIG[status as StatusBadgeKey] ?? STATUS_BADGE_CONFIG.value;

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero
        ? 'border-[oklch(0.28_0.025_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
    )}>
      {/* Gradient header */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', cfg.headerGrad)}>
        {/* Status badge — top right */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.dot }} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.text)}>{cfg.label}</span>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
        </div>
        <h3 className={cn('font-black text-white leading-snug text-balance pr-16', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {children}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
