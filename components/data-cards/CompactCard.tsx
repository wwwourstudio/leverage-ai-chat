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

const YES_COLOR = '#00c47c';
const NO_COLOR  = '#f43f5e';

/** Derive a compact stat to show on the subcard thumbnail */
function getKeyStat(card: CompactCardData): { label: string; value: string; color?: string } | null {
  const d = card.data;
  const t = card.type.toLowerCase();

  if (t.includes('kalshi') || t.includes('prediction')) {
    if (d.yesPct != null) {
      const pct = d.yesPct as number;
      const isYes = pct >= 50;
      return {
        label: isYes ? 'YES' : 'NO',
        value: isYes ? `${pct}¢` : `${100 - pct}¢`,
        color: isYes ? YES_COLOR : NO_COLOR,
      };
    }
  }
  if (t.includes('odds') || t.includes('betting') || t.includes('moneyline')) {
    if (d.homeOdds) return { label: 'ML', value: d.homeOdds };
    if (d.overUnder) {
      const m = String(d.overUnder).match(/([\d.]+)/);
      return m ? { label: 'O/U', value: m[1] } : null;
    }
  }
  if (t.includes('dfs')) {
    if (d.projection) return { label: 'Proj', value: `${d.projection}` };
    if (d.salary) return { label: '$', value: d.salary };
  }
  if (t.includes('weather')) {
    if (d.temperature) return { label: 'Temp', value: d.temperature };
  }
  if (t.includes('arbitrage')) {
    if (d.profit) return { label: 'Arb', value: `+${d.profit}%`, color: YES_COLOR };
  }
  if (d.hitRatePercentage != null) return { label: 'Hit', value: `${d.hitRatePercentage}%` };
  return null;
}

/** Pick an icon based on card type */
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

/** Mini probability bar for Kalshi subcards */
function MiniProbBar({ yesPct }: { yesPct: number }) {
  return (
    <div className="h-1 rounded-full overflow-hidden bg-[oklch(0.16_0.01_280)] mt-1">
      <div
        className="h-full rounded-full"
        style={{
          width: `${yesPct}%`,
          backgroundColor: yesPct >= 50 ? YES_COLOR : NO_COLOR,
          opacity: 0.8,
        }}
      />
    </div>
  );
}

export const CompactCard = memo(function CompactCard({ card, index, isActive, onClick }: CompactCardProps) {
  const keyStat = getKeyStat(card);
  const Icon = cardIcon(card.type);
  const isKalshi = card.type.toLowerCase().includes('kalshi') || card.type.toLowerCase().includes('prediction');
  const yesPct: number | null = isKalshi && typeof card.data.yesPct === 'number' ? card.data.yesPct : null;

  // Subcategory display: use normalised data.subcategory or card.subcategory, never raw ticker
  const displayCategory =
    (card.data.subcategory as string) ||
    (card.subcategory && !card.subcategory.match(/^[A-Z0-9\-]{5,}$/) ? card.subcategory : null) ||
    card.category ||
    'Market';

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-2 p-3 rounded-xl border text-left transition-all duration-200 w-full hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        'bg-[#0f0f11] hover:bg-[oklch(0.14_0.014_280)]',
        isActive
          ? 'border-[#00c47c40] shadow-[0_0_16px_#00c47c18]'
          : 'border-[oklch(0.18_0.014_280)] hover:border-[oklch(0.26_0.018_280)] hover:shadow-[0_2px_16px_oklch(0.3_0.08_240/0.10)]',
      )}
      aria-pressed={isActive}
      title={card.title}
    >
      {/* Active indicator — Kalshi teal left bar */}
      {isActive && (
        <div className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full bg-[#00c47c]" />
      )}

      {/* Top row: icon + key stat */}
      <div className="flex items-start justify-between gap-1">
        <div className={cn(
          'flex items-center justify-center w-6 h-6 rounded-md shrink-0',
          isKalshi ? 'bg-[#00c47c15] border border-[#00c47c25]' : 'bg-[oklch(0.14_0.018_280)] border border-[oklch(0.20_0.018_280)]',
        )}>
          <Icon
            className="w-3 h-3"
            style={{ color: isKalshi ? YES_COLOR : 'oklch(0.55 0.015 280)' }}
            aria-hidden="true"
          />
        </div>

        {keyStat && (
          <div className="flex flex-col items-end shrink-0">
            <span
              className="text-sm font-black tabular-nums leading-none"
              style={{ color: keyStat.color ?? 'white' }}
            >
              {keyStat.value}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: keyStat.color ? `${keyStat.color}80` : 'oklch(0.40 0.01 280)' }}>
              {keyStat.label}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-[11px] font-semibold text-[oklch(0.78_0.005_280)] leading-tight line-clamp-2 text-balance">
        {card.title}
      </p>

      {/* Mini prob bar for Kalshi cards */}
      {yesPct !== null && <MiniProbBar yesPct={yesPct} />}

      {/* Category label */}
      <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.35_0.01_280)] truncate">
        {displayCategory}
      </span>
    </button>
  );
});
