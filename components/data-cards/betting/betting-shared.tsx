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
      <div className={cn('rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-[var(--bg-elevated)]', sz)}>
        <Image src={logoUrl} alt={name} width={isLarge ? 56 : 44} height={isLarge ? 56 : 44} className="w-full h-full object-contain p-1 drop-shadow" onError={() => setImgFailed(true)} />
      </div>
    );
  }
  return (
    <div className={cn('rounded-xl border flex items-center justify-center shrink-0 font-black', sz, txtSz, avatarCls)}>
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
    <div className="space-y-1">
      <div className="relative h-2.5 rounded-full overflow-hidden bg-[var(--bg-elevated)] flex">
        <div className={cn('h-full transition-all duration-700', leftColor)} style={{ width: `${leftPct}%` }} />
        <div className={cn('h-full flex-1', rightColor)} />
      </div>
      <div className="flex justify-between text-[10px] font-semibold text-[var(--text-faint)]">
        <span>{leftLabel} {leftPct}%</span>
        <span>{100 - leftPct}% {rightLabel}</span>
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
  return (
    <div className={cn(
      'flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border',
      positive === true
        ? 'bg-emerald-500/8 border-emerald-500/25'
        : positive === false
        ? 'bg-red-500/8 border-red-500/20'
        : isBest
        ? 'bg-emerald-500/8 border-emerald-500/25'
        : highlight
        ? 'bg-blue-500/10 border-blue-500/20'
        : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)]',
    )}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <span className={cn('text-lg font-black tabular-nums',
        positive === true ? 'text-emerald-400' :
        positive === false ? 'text-red-400' :
        'text-foreground'
      )}>{value}</span>
      {sub && <span className="text-[10px] text-[var(--text-muted)]">{sub}</span>}
      {isBest && <span className="text-[7px] font-black text-emerald-500 uppercase tracking-wider">BEST</span>}
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
    <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5">
        <BookOpen className="w-3 h-3 text-[var(--text-muted)]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Odds Comparison</span>
        <span className="ml-auto text-[10px] text-[var(--text-faint)]">ML</span>
      </div>

      <div className="grid px-3 pb-1" style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}>
        <span />
        {books.map((b) => (
          <span key={b.name} className="text-[10px] font-bold text-[var(--text-muted)] text-center truncate">{shortName(b.name)}</span>
        ))}
      </div>

      {awayTeam && (
        <div className="grid px-3 py-1.5 border-t border-[var(--border-subtle)]" style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] truncate self-center">{awayTeam.split(' ').slice(-1)[0]}</span>
          {books.map((b) => {
            const isBest = b.awayOdds !== null && b.awayOdds === bestAwayOdds;
            const n = b.awayOdds ? parseFloat(b.awayOdds) : NaN;
            return (
              <span key={b.name} className={cn('text-[11px] font-black tabular-nums text-center self-center', !b.awayOdds ? 'text-[var(--text-faint)]' : n > 0 ? 'text-emerald-400' : 'text-foreground', isBest && 'text-emerald-300')}>
                {b.awayOdds ?? '—'}
                {isBest && <span className="text-[10px] ml-0.5 text-emerald-500">★</span>}
              </span>
            );
          })}
        </div>
      )}

      {homeTeam && (
        <div className="grid px-3 py-1.5 border-t border-[var(--border-subtle)]" style={{ gridTemplateColumns: `1fr repeat(${cols}, minmax(0, 1fr))` }}>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] truncate self-center">{homeTeam.split(' ').slice(-1)[0]}</span>
          {books.map((b) => {
            const isBest = b.homeOdds !== null && b.homeOdds === bestHomeOdds;
            const n = b.homeOdds ? parseFloat(b.homeOdds) : NaN;
            return (
              <span key={b.name} className={cn('text-[11px] font-black tabular-nums text-center self-center', !b.homeOdds ? 'text-[var(--text-faint)]' : n > 0 ? 'text-emerald-400' : 'text-foreground', isBest && 'text-emerald-300')}>
                {b.homeOdds ?? '—'}
                {isBest && <span className="text-[10px] ml-0.5 text-emerald-500">★</span>}
              </span>
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
      <div className="absolute right-0 inset-y-0 w-8 bg-gradient-to-l from-[var(--bg-overlay)] to-transparent z-10 pointer-events-none" />
      <div className="flex overflow-x-auto gap-1 py-1 pr-8" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => onSelect(i)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border transition-all duration-150',
              activeTab === i ? accentCls : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-muted)]',
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
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-[var(--border-subtle)] border-t-white/60 animate-spin" />
    </div>
  );
}
