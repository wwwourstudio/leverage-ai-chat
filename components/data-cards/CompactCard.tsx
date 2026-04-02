'use client';

import { memo, useState } from 'react';
import { LucideIcon, TrendingUp, Activity, Zap, Trophy, BarChart2, CloudRain, GitMerge, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTeamLogoUrl } from '@/lib/constants';

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

/** Parse "Away @ Home" or "Away vs Home" from a string */
function parseTeams(text: string): { away: string; home: string } | null {
  const atIdx = text.indexOf(' @ ');
  if (atIdx >= 0) return { away: text.slice(0, atIdx).trim(), home: text.slice(atIdx + 3).trim() };
  const vsMatch = text.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (vsMatch) return { away: vsMatch[1].trim(), home: vsMatch[2].trim() };
  return null;
}

/** Tiny team logo with abbr fallback */
function MiniTeamLogo({ name, sport }: { name: string; sport?: string }) {
  const [failed, setFailed] = useState(false);
  const url = getTeamLogoUrl(name, sport);
  const abbr = name.trim().split(/\s+/).pop()?.slice(0, 3).toUpperCase() ?? name.slice(0, 3).toUpperCase();
  if (url && !failed) {
    return (
      <div className="w-5 h-5 rounded-md overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
        <img src={url} alt={name} className="w-full h-full object-contain" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center shrink-0 text-[7px] font-black text-[var(--text-muted)]">
      {abbr}
    </div>
  );
}

/** Mini probability bar for Kalshi subcards */
function MiniProbBar({ yesPct }: { yesPct: number }) {
  return (
    <div className="h-1 rounded-full overflow-hidden bg-[var(--bg-elevated)] mt-1">
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

  // Parse teams from title or matchup data
  const teams = parseTeams(card.title) ?? (card.data.matchup ? parseTeams(String(card.data.matchup)) : null);
  const sport = card.data.sport as string | undefined;

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
        'bg-[var(--bg-overlay)] hover:bg-[var(--bg-surface)]',
        isActive
          ? 'border-blue-500/50 shadow-[0_0_16px_oklch(0.55_0.2_240/0.25)]'
          : 'border-[var(--border-subtle)] hover:border-blue-500/40 hover:shadow-[0_2px_20px_oklch(0.55_0.2_240/0.18)]',
      )}
      aria-pressed={isActive}
      title={card.title}
    >
      {/* Active indicator — left bar */}
      {isActive && (
        <div className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full bg-blue-400" />
      )}

      {/* Top row: icon/logos + key stat */}
      <div className="flex items-start justify-between gap-1">
        {teams ? (
          /* Dual team logos */
          <div className="flex items-center gap-1 shrink-0">
            <MiniTeamLogo name={teams.away} sport={sport} />
            <span className="text-[8px] font-bold text-[var(--text-faint)]">@</span>
            <MiniTeamLogo name={teams.home} sport={sport} />
          </div>
        ) : (
          <div className={cn(
            'flex items-center justify-center w-6 h-6 rounded-md shrink-0',
            isKalshi ? 'bg-[#00c47c15] border border-[#00c47c25]' : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]',
          )}>
            <Icon
              className="w-3 h-3"
              style={{ color: isKalshi ? YES_COLOR : 'oklch(0.60 0.15 240)' }}
              aria-hidden="true"
            />
          </div>
        )}

        {keyStat && (
          <div className="flex flex-col items-end shrink-0">
            <span
              className="text-sm font-black tabular-nums leading-none"
              style={{ color: keyStat.color ?? 'white' }}
            >
              {keyStat.value}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: keyStat.color ? `${keyStat.color}80` : 'var(--text-faint)' }}>
              {keyStat.label}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-[11px] font-semibold text-foreground/80 leading-tight line-clamp-2 text-balance">
        {card.title}
      </p>

      {/* Mini prob bar for Kalshi cards */}
      {yesPct !== null && <MiniProbBar yesPct={yesPct} />}

      {/* Category label */}
      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)] truncate">
        {displayCategory}
      </span>
    </button>
  );
});
