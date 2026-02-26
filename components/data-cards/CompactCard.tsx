'use client';

import { memo } from 'react';
import { LucideIcon, TrendingUp, Activity, Zap, Trophy, BarChart2, CloudRain, GitMerge, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactCardData {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
}

interface CompactCardProps {
  card: CompactCardData;
  index: number;
  isActive?: boolean;
  onClick: () => void;
}

/** Pick a single key stat to surface in the compact view */
function getKeyStat(card: CompactCardData): string | null {
  const d = card.data;
  const t = card.type.toLowerCase();

  if (t.includes('odds') || t.includes('betting') || t.includes('moneyline')) {
    if (d.homeOdds) return d.homeOdds;
    if (d.overUnder) {
      const m = String(d.overUnder).match(/([\d.]+)/);
      return m ? `O/U ${m[1]}` : null;
    }
  }
  if (t.includes('dfs')) {
    if (d.projection) return `${d.projection} proj`;
    if (d.salary) return d.salary;
  }
  if (t.includes('fantasy') || t.includes('draft')) {
    const players = d.players;
    if (Array.isArray(players) && players[0]) return players[0].name?.split(' ').pop() ?? null;
    if (d.pts) return `${d.pts} pts`;
  }
  if (t.includes('kalshi') || t.includes('prediction')) {
    if (d.yesPct != null) return `YES ${d.yesPct}%`;
  }
  if (t.includes('weather')) {
    if (d.temperature) return d.temperature;
  }
  if (t.includes('arbitrage')) {
    if (d.profit) return `+${d.profit}%`;
  }
  if (d.hitRatePercentage != null) return `${d.hitRatePercentage}% hit`;
  return null;
}

/** Status dot color */
const STATUS_DOT: Record<string, string> = {
  hot: 'bg-red-400',
  value: 'bg-emerald-400',
  optimal: 'bg-sky-400',
  target: 'bg-teal-400',
  elite: 'bg-purple-400',
  sleeper: 'bg-indigo-400',
  opportunity: 'bg-amber-400',
  edge: 'bg-blue-400',
  alert: 'bg-red-400',
  favorable: 'bg-green-400',
  neutral: 'bg-slate-400',
};

/** Pick a representative Lucide icon based on card type */
function cardIcon(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes('odds') || t.includes('betting') || t.includes('moneyline') || t.includes('spread')) return TrendingUp;
  if (t.includes('dfs') || t.includes('lineup')) return Zap;
  if (t.includes('fantasy') || t.includes('draft')) return Trophy;
  if (t.includes('kalshi') || t.includes('prediction')) return Activity;
  if (t.includes('weather')) return CloudRain;
  if (t.includes('arbitrage')) return GitMerge;
  if (t.includes('prop') || t.includes('player')) return BarChart2;
  return Star;
}

export const CompactCard = memo(function CompactCard({ card, index, isActive, onClick }: CompactCardProps) {
  const keyStat = getKeyStat(card);
  const dotColor = STATUS_DOT[card.status] ?? 'bg-slate-400';
  const Icon = cardIcon(card.type);

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-1.5 p-2.5 rounded-xl border text-left transition-all duration-200 w-full',
        'bg-[oklch(0.11_0.012_280)] hover:bg-[oklch(0.15_0.015_280)]',
        isActive
          ? 'border-[oklch(0.40_0.08_260)] shadow-[0_0_16px_oklch(0.4_0.12_260/0.25)]'
          : 'border-[oklch(0.20_0.015_280)] hover:border-[oklch(0.28_0.02_280)]',
      )}
      aria-pressed={isActive}
      title={card.title}
    >
      {/* Gradient left micro-bar */}
      <div className={cn('absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b opacity-80', card.gradient)} />

      {/* Icon + status dot */}
      <div className="flex items-center justify-between pl-2">
        <div className={cn('p-1.5 rounded-md bg-gradient-to-br opacity-90', card.gradient)}>
          <Icon className="w-3 h-3 text-white" aria-hidden="true" />
        </div>
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      </div>

      {/* Title */}
      <p className="pl-2 text-[11px] font-semibold text-[oklch(0.82_0.005_85)] leading-tight line-clamp-2">
        {card.title}
      </p>

      {/* Key stat + category */}
      <div className="pl-2 flex items-center justify-between gap-1">
        {keyStat && (
          <span className="text-[10px] font-black tabular-nums text-[oklch(0.92_0.005_85)]">
            {keyStat}
          </span>
        )}
        <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.40_0.01_280)] truncate">
          {card.category}
        </span>
      </div>
    </button>
  );
});
