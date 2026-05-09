'use client';

import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BettingCardData } from './betting-utils';
import { abbr } from './betting-utils';
import { TabSpinner } from './betting-shared';

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
      { label: 'Home/Away', away: tc.away?.pointsPerGame ?? null, home: tc.home?.pointsPerGame ?? null },
      { label: 'Last 10',   away: tc.away?.last10        ?? null, home: tc.home?.last10        ?? null },
      { label: 'Streak',    away: tc.away?.streak        ?? null, home: tc.home?.streak        ?? null },
    ] : []),
  ].filter(r => r.away != null || r.home != null);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Users className="w-8 h-8 text-[var(--text-faint)]" />
        <p className="text-[11px] text-[var(--text-muted)]">No team stats available</p>
        {onAnalyze && (
          <button onClick={onAnalyze} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)] hover:text-foreground hover:border-[var(--border-hover)] transition-all">
            Ask AI to compare these teams →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="grid grid-cols-3 px-3 py-2 border-b border-[var(--border-subtle)]">
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Stat</span>
        {teams ? (
          <button onClick={onAsk ? () => onAsk(`Show me detailed team stats and analysis for the ${teams.away}`) : undefined} className={cn('text-[10px] font-black uppercase text-center', theme.accentColor, onAsk && 'hover:underline cursor-pointer')}>
            {awayAbbr}
          </button>
        ) : (
          <span className={cn('text-[10px] font-black uppercase text-center', theme.accentColor)}>{awayAbbr}</span>
        )}
        {teams ? (
          <button onClick={onAsk ? () => onAsk(`Show me detailed team stats and analysis for the ${teams.home}`) : undefined} className={cn('text-[10px] font-black uppercase text-center', theme.accentColor, onAsk && 'hover:underline cursor-pointer')}>
            {homeAbbr}
          </button>
        ) : (
          <span className={cn('text-[10px] font-black uppercase text-center', theme.accentColor)}>{homeAbbr}</span>
        )}
      </div>
      {rows.map(({ label, away, home }) => (
        <div
          key={label}
          onClick={onAsk && teams ? () => onAsk(`Compare ${teams.away} vs ${teams.home} — ${label} breakdown`) : undefined}
          className={cn('grid grid-cols-3 px-3 py-2 border-b border-[var(--border-subtle)] last:border-0 transition-colors', onAsk && teams && 'cursor-pointer hover:bg-[var(--bg-elevated)]')}
        >
          <span className="text-[10px] text-[var(--text-muted)] self-center">{label}</span>
          <span className="text-[10px] font-bold text-foreground text-center self-center">{away ?? '—'}</span>
          <span className="text-[10px] font-bold text-foreground text-center self-center">{home ?? '—'}</span>
        </div>
      ))}
      {!tc && (
        <p className="text-[10px] text-[var(--text-faint)] px-3 py-2">Full statistical comparison not available</p>
      )}
    </div>
  );
}
