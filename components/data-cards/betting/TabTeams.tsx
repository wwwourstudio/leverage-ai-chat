'use client';

import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';
import { abbr } from './betting-utils';
import { TabSpinner } from './betting-shared';

// Compute a simple advantage indicator between two numeric-ish stat strings
function getAdvantage(away: string | null, home: string | null): 'away' | 'home' | null {
  if (!away || !home) return null;
  // Extract leading number (handles "#12", "24-8", "6-2 L5", etc.)
  const aNum = parseFloat(away.replace(/^#/, ''));
  const hNum = parseFloat(home.replace(/^#/, ''));
  if (isNaN(aNum) || isNaN(hNum) || aNum === hNum) return null;
  // For ranks lower = better
  const isRank = away.startsWith('#') || home.startsWith('#');
  if (isRank) return aNum < hNum ? 'away' : 'home';
  return aNum > hNum ? 'away' : 'home';
}

export function TabTeams({ data, teams, theme, onAnalyze, onAsk, loading = false }: {
  data: BettingCardData;
  teams: { away: string; home: string } | null;
  theme: { accentColor: string };
  onAnalyze?: () => void;
  onAsk?: (q: string) => void;
  loading?: boolean;
}) {
  if (loading) return <TabSpinner />;

  const tc = data.teamComparison as any;
  const awayAbbr = teams ? abbr(teams.away) : 'AWY';
  const homeAbbr = teams ? abbr(teams.home) : 'HME';

  const rows = [
    { label: 'Record', away: data.awayRecord ?? null, home: data.homeRecord ?? null },
    { label: 'ATS',    away: data.atsRecord  ?? null, home: data.atsRecord  ?? null },
    { label: 'H2H',    away: data.h2hRecord  ?? null, home: data.h2hRecord  ?? null },
    ...(tc ? [
      { label: 'Off. Rank', away: tc.away?.offenseRank != null ? `#${tc.away.offenseRank}` : null, home: tc.home?.offenseRank != null ? `#${tc.home.offenseRank}` : null },
      { label: 'Def. Rank', away: tc.away?.defenseRank != null ? `#${tc.away.defenseRank}` : null, home: tc.home?.defenseRank != null ? `#${tc.home.defenseRank}` : null },
      { label: 'PPG', away: tc.away?.pointsPerGame ?? null, home: tc.home?.pointsPerGame ?? null },
      { label: 'Last 10',   away: tc.away?.last10        ?? null, home: tc.home?.last10        ?? null },
      { label: 'Streak',    away: tc.away?.streak        ?? null, home: tc.home?.streak        ?? null },
    ] : []),
  ].filter(r => r.away != null || r.home != null);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
          <Users className="w-6 h-6 text-[var(--text-faint)]" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-[var(--text-muted)]">No team stats available</p>
        </div>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all"
          >
            Ask AI to compare these teams →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden shadow-sm">
      {/* Sticky column header */}
      <div className="grid grid-cols-[1fr_1fr_24px_1fr] px-3.5 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] self-center">STAT</span>
        {teams ? (
          <button
            onClick={onAsk ? () => onAsk(`Show me detailed team stats and analysis for the ${teams.away}`) : undefined}
            className={cn('text-[10px] font-black uppercase tracking-wider text-right', theme.accentColor, onAsk && 'hover:underline cursor-pointer')}
          >
            {awayAbbr}
          </button>
        ) : (
          <span className={cn('text-[10px] font-black uppercase tracking-wider text-right', theme.accentColor)}>{awayAbbr}</span>
        )}
        {/* Advantage column header */}
        <span />
        {teams ? (
          <button
            onClick={onAsk ? () => onAsk(`Show me detailed team stats and analysis for the ${teams.home}`) : undefined}
            className={cn('text-[10px] font-black uppercase tracking-wider text-right', theme.accentColor, onAsk && 'hover:underline cursor-pointer')}
          >
            {homeAbbr}
          </button>
        ) : (
          <span className={cn('text-[10px] font-black uppercase tracking-wider text-right', theme.accentColor)}>{homeAbbr}</span>
        )}
      </div>

      {/* Data rows */}
      {rows.map(({ label, away, home }, idx) => {
        const advantage = getAdvantage(away, home);
        return (
          <div
            key={label}
            onClick={onAsk && teams ? () => onAsk(`Compare ${teams.away} vs ${teams.home} — ${label} breakdown`) : undefined}
            className={cn(
              'grid grid-cols-[1fr_1fr_24px_1fr] px-3.5 py-2.5 gap-2 border-b border-[var(--border-subtle)] last:border-0 transition-colors',
              idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]',
              onAsk && teams && 'cursor-pointer hover:bg-[var(--bg-elevated)] active:scale-[0.99]',
            )}
          >
            <span className="text-[10px] text-[var(--text-faint)] self-center font-medium">{label}</span>
            <span className={cn(
              'text-[11px] font-black text-right self-center tabular-nums',
              advantage === 'away' ? 'text-emerald-400' : 'text-white/75',
            )}>
              {away ?? '—'}
            </span>
            {/* Advantage arrow */}
            <span className="flex items-center justify-center self-center text-[10px] font-black">
              {advantage === 'away'
                ? <span className="text-emerald-400">▲</span>
                : advantage === 'home'
                ? <span className="text-red-400">▼</span>
                : <span className="text-white/15">·</span>}
            </span>
            <span className={cn(
              'text-[11px] font-black text-right self-center tabular-nums',
              advantage === 'home' ? 'text-emerald-400' : 'text-white/75',
            )}>
              {home ?? '—'}
            </span>
          </div>
        );
      })}

      {!tc && rows.length > 0 && (
        <p className="text-[10px] text-[var(--text-faint)] px-3.5 py-2.5 border-t border-[var(--border-subtle)] italic">
          Full statistical comparison not available
        </p>
      )}
    </div>
  );
}
