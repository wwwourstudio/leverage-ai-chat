'use client';

// Shared sub-components used by BettingCard and its tab modules.

import { useState } from 'react';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTeamLogoUrl } from '@/lib/constants';
import type { BookEntry } from './betting-utils';
import { abbr } from './betting-utils';

// ─────────────────────────────────────────────────────────────────────────────
// TeamLogo
// ─────────────────────────────────────────────────────────────────────────────
export function TeamLogo({
  name, sport, avatarCls, isLarge,
}: {
  name: string; sport?: string; avatarCls: string; isLarge?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = getTeamLogoUrl(name, sport);
  const sz = isLarge ? 'w-14 h-14' : 'w-11 h-11';
  const txtSz = isLarge ? 'text-sm' : 'text-[11px]';

  if (logoUrl && !imgFailed) {
    return (
      <div className={cn(
        'rounded-2xl overflow-hidden flex items-center justify-center shrink-0',
        'bg-[var(--bg-elevated)] border border-[var(--border-subtle)]',
        'shadow-lg shadow-black/20',
        sz,
      )}>
        <Image
          src={logoUrl} alt={name}
          width={isLarge ? 56 : 44} height={isLarge ? 56 : 44}
          className="w-full h-full object-contain p-1.5 drop-shadow-sm"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  return (
    <div className={cn(
      'rounded-2xl border flex items-center justify-center shrink-0 font-black',
      'shadow-lg shadow-black/20',
      sz, txtSz, avatarCls,
    )}>
      {abbr(name)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SplitBar — two-sided bar for win probability or sharp money split
// ─────────────────────────────────────────────────────────────────────────────
export function SplitBar({ leftPct, leftLabel, rightLabel, leftColor, rightColor }: {
  leftPct: number; leftLabel: string; rightLabel: string; leftColor: string; rightColor: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative h-3 rounded-full overflow-hidden bg-[var(--bg-elevated)] flex shadow-inner">
        {/* Left glow layer */}
        <div
          className={cn('h-full transition-all duration-700 relative', leftColor)}
          style={{ width: `${leftPct}%` }}
        >
          <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-r from-transparent to-white/10" />
        </div>
        <div className={cn('h-full flex-1', rightColor)} />
        {/* Center divider */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[var(--bg-surface)] shadow"
          style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] font-bold text-[var(--text-faint)]">
          <span className="text-white/80">{leftPct}%</span> {leftLabel}
        </span>
        <span className="text-[10px] font-bold text-[var(--text-faint)]">
          {rightLabel} <span className="text-white/80">{100 - leftPct}%</span>
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OddsCell
// ─────────────────────────────────────────────────────────────────────────────
export function OddsCell({ label, value, sub, positive, highlight, isBest }: {
  label: string; value: string; sub?: string; positive?: boolean; highlight?: boolean; isBest?: boolean;
}) {
  const oddsNum = parseFloat(value?.replace(/[^0-9.-]/g, '') ?? '');
  const isHeavyFav = !isNaN(oddsNum) && oddsNum <= -200;
  const isUnderdog = !isNaN(oddsNum) && oddsNum >= 100;

  return (
    <div className={cn(
      'flex flex-col items-center gap-0.5 px-3 py-3 rounded-2xl border transition-all',
      isBest
        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10 shadow-sm'
        : highlight
        ? 'bg-blue-500/10 border-blue-500/25'
        : isHeavyFav
        ? 'bg-red-500/6 border-red-500/15'
        : isUnderdog
        ? 'bg-emerald-500/6 border-emerald-500/15'
        : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)]',
    )}>
      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-0.5">{label}</span>
      <span className={cn(
        'text-xl font-black tabular-nums leading-none',
        isBest ? 'text-emerald-300'
        : isHeavyFav ? 'text-red-400'
        : isUnderdog ? 'text-emerald-400'
        : 'text-white',
      )}>
        {value}
      </span>
      {sub && <span className="text-[9px] text-[var(--text-faint)] mt-0.5 text-center leading-tight">{sub}</span>}
      {isBest && (
        <span className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase tracking-wider">
          ★ BEST
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BookComparisonRow — side-by-side ML odds from top 3 bookmakers
// ─────────────────────────────────────────────────────────────────────────────
export function BookComparisonRow({
  books, homeTeam, awayTeam, bestHomeOdds, bestAwayOdds,
}: {
  books: BookEntry[];
  homeTeam?: string;
  awayTeam?: string;
  bestHomeOdds?: string;
  bestAwayOdds?: string;
}) {
  if (!books || books.length < 2) return null;

  const shortName = (name: string) =>
    name
      .replace(' Sportsbook', '').replace(' BET', '')
      .replace('DraftKings', 'DK').replace('FanDuel', 'FD')
      .replace('BetMGM', 'MGM').replace('Caesars', 'CZR')
      .replace('PointsBet', 'PB').replace('BetRivers', 'BR')
      .replace('ESPN BET', 'ESPN').replace('bet365', '365');

  const cols = books.length;

  return (
    <div className="rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
        <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Odds Comparison</span>
        <span className="ml-auto px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-[9px] font-black text-blue-400 uppercase tracking-wider">ML</span>
      </div>

      {/* Book name header row */}
      <div className="grid px-3 py-2" style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)]">Team</span>
        {books.map((b) => (
          <span key={b.name} className="text-[10px] font-black text-[var(--text-muted)] text-center truncate">{shortName(b.name)}</span>
        ))}
      </div>

      {/* Away team row */}
      {awayTeam && (
        <div
          className="grid px-3 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-overlay)]"
          style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}
        >
          <span className="text-[10px] font-bold text-[var(--text-muted)] truncate self-center">{awayTeam.split(' ').slice(-1)[0]}</span>
          {books.map((b) => {
            const isBest = b.awayOdds !== null && b.awayOdds === bestAwayOdds;
            const n = b.awayOdds ? parseFloat(b.awayOdds) : NaN;
            return (
              <div key={b.name} className="flex flex-col items-center justify-center gap-0.5">
                <span className={cn(
                  'text-sm font-black tabular-nums text-center',
                  !b.awayOdds ? 'text-[var(--text-faint)]'
                  : n > 0 ? 'text-emerald-400'
                  : 'text-white/80',
                  isBest && 'text-emerald-300',
                )}>
                  {b.awayOdds ?? '—'}
                </span>
                {isBest && (
                  <span className="text-[7px] font-black text-emerald-500 uppercase tracking-wider">BEST</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Home team row */}
      {homeTeam && (
        <div
          className="grid px-3 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30"
          style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}
        >
          <span className="text-[10px] font-bold text-[var(--text-muted)] truncate self-center">{homeTeam.split(' ').slice(-1)[0]}</span>
          {books.map((b) => {
            const isBest = b.homeOdds !== null && b.homeOdds === bestHomeOdds;
            const n = b.homeOdds ? parseFloat(b.homeOdds) : NaN;
            return (
              <div key={b.name} className="flex flex-col items-center justify-center gap-0.5">
                <span className={cn(
                  'text-sm font-black tabular-nums text-center',
                  !b.homeOdds ? 'text-[var(--text-faint)]'
                  : n > 0 ? 'text-emerald-400'
                  : 'text-white/80',
                  isBest && 'text-emerald-300',
                )}>
                  {b.homeOdds ?? '—'}
                </span>
                {isBest && (
                  <span className="text-[7px] font-black text-emerald-500 uppercase tracking-wider">BEST</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabBar
// ─────────────────────────────────────────────────────────────────────────────
export function TabBar({ activeTab, onSelect, accentCls }: {
  activeTab: number; onSelect: (i: number) => void; accentCls: string;
}) {
  const tabs = ['Odds', 'Props', 'Teams', 'History', 'Injuries', 'Watch'];
  return (
    <div className="relative">
      {/* Fade edge for overflow hint */}
      <div className="absolute right-0 inset-y-0 w-6 bg-gradient-to-l from-[var(--bg-surface,#0f172a)] to-transparent z-10 pointer-events-none rounded-r-xl" />
      <div
        className="flex overflow-x-auto gap-1 pb-1 pr-6"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => onSelect(i)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all duration-150',
              activeTab === i
                ? cn(accentCls, 'shadow-sm')
                : 'text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-white/5 border border-transparent',
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabSpinner — generic loading spinner for tab content
// ─────────────────────────────────────────────────────────────────────────────
export function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="relative w-6 h-6">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--border-subtle)]" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/60 animate-spin" />
      </div>
    </div>
  );
}
