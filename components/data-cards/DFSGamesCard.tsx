'use client';

import { memo } from 'react';
import { Calendar, ChevronRight, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnrichedGameRef {
  gameId: number;
  awayTeamAbbr: string;
  homeTeamAbbr: string;
  startTime: string;
  awayPitcher?: string;
  homePitcher?: string;
}

interface EnrichedSlate {
  draftGroupId: number;
  slateLabel: string;
  contestType: 'classic' | 'showdown';
  startDate: string;
  gameCount: number;
  games: EnrichedGameRef[];
}

interface DFSGamesCardProps {
  data: {
    slates: EnrichedSlate[];
    selectedDraftGroupId: number | null;
  };
  onAsk?: (query: string) => void;
}

function formatGameTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

function SlateLabelBadge({ label, contestType, selected }: { label: string; contestType: string; selected: boolean }) {
  const isMain = label.toLowerCase().includes('main');
  const isShowdown = contestType === 'showdown';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest shrink-0',
      selected
        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
        : isMain
        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
        : isShowdown
        ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]',
    )}>
      {selected && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
      {label}
    </span>
  );
}

export const DFSGamesCard = memo(function DFSGamesCard({ data, onAsk }: DFSGamesCardProps) {
  const slates: EnrichedSlate[] = Array.isArray(data.slates) ? data.slates : [];
  const selectedId: number | null = data.selectedDraftGroupId ?? null;

  function handleSlateClick(slate: EnrichedSlate) {
    if (!onAsk) return;
    if (slate.contestType === 'showdown' && slate.games.length === 1) {
      const g = slate.games[0];
      onAsk(`Build DFS showdown lineup for ${g.awayTeamAbbr} @ ${g.homeTeamAbbr} (DraftKings #${slate.draftGroupId})`);
    } else {
      onAsk(`Build DFS lineup for the ${slate.slateLabel} slate (DraftKings #${slate.draftGroupId})`);
    }
  }

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_24px_oklch(0.3_0.06_280/0.12))] transition-all duration-300">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-indigo-600/25 via-violet-800/10 to-transparent border-b border-[var(--border-subtle)]">
        {/* Decorative glow orb */}
        <div className="absolute top-0 right-0 w-32 h-16 bg-indigo-500/8 rounded-bl-full blur-2xl pointer-events-none" />

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wide">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
        </div>

        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/60">MLB</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50">DraftKings</span>
        </div>
        <h3 className="font-black text-white leading-snug text-sm pr-20">Today's DraftKings Slates</h3>
        <p className="text-[10px] text-white/50 mt-0.5">
          {slates.length} slate{slates.length !== 1 ? 's' : ''} available · tap a slate to build a lineup
        </p>
      </div>

      {/* ── No slates fallback ───────────────────────────────────────── */}
      {slates.length === 0 && (
        <div className="px-4 py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-5 h-5 text-[var(--text-faint)]" />
          </div>
          <p className="text-[11px] text-[var(--text-faint)]">No DraftKings slates available yet.</p>
          <p className="text-[10px] text-[var(--text-faint)]/60 mt-0.5">Check back closer to game time.</p>
        </div>
      )}

      {/* ── Slate list ───────────────────────────────────────────────── */}
      <div className="p-3 space-y-3">
        {slates.map(slate => {
          const isSelected = slate.draftGroupId === selectedId;
          const isShowdown = slate.contestType === 'showdown';
          const isMain = slate.slateLabel.toLowerCase().includes('main');
          const leftBorderCls = isSelected
            ? 'border-l-2 border-l-emerald-400'
            : isShowdown
            ? 'border-l-2 border-l-violet-500'
            : isMain
            ? 'border-l-2 border-l-indigo-400'
            : 'border-l-2 border-l-[var(--border-subtle)]';

          return (
            <div
              key={slate.draftGroupId}
              className={cn(
                'rounded-xl bg-[var(--bg-elevated)] p-3 transition-all duration-200',
                leftBorderCls,
                isSelected ? 'shadow-[0_0_12px_oklch(0.5_0.15_160/0.15)]' : '',
              )}
            >
              {/* Slate header row */}
              <div className="flex items-center gap-2 mb-2.5">
                <SlateLabelBadge label={slate.slateLabel} contestType={slate.contestType} selected={isSelected} />
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[9px] text-[var(--text-muted)] tabular-nums">
                  <Clock className="w-2.5 h-2.5 opacity-60" />
                  <span suppressHydrationWarning>{formatGameTime(slate.startDate)}</span>
                </span>
                <span className="ml-auto text-[9px] font-black text-[var(--text-faint)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-full">
                  {slate.gameCount}G
                </span>
              </div>

              {/* Games in this slate */}
              <div className="space-y-1.5">
                {slate.games.map(g => (
                  <div
                    key={g.gameId}
                    className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]/60"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Game matchup — large team abbrs */}
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white tracking-wide">{g.awayTeamAbbr}</span>
                        <span className="text-[9px] text-[var(--text-faint)] font-bold">@</span>
                        <span className="font-black text-sm text-white tracking-wide">{g.homeTeamAbbr}</span>
                        {g.startTime && (
                          <span suppressHydrationWarning className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[9px] text-[var(--text-faint)] tabular-nums">
                            <Clock className="w-2 h-2 opacity-50" />
                            {formatGameTime(g.startTime)}
                          </span>
                        )}
                      </div>
                      {/* Pitcher matchup */}
                      {(g.awayPitcher || g.homePitcher) && (
                        <div className="text-[9px] text-[var(--text-muted)] mt-0.5 truncate">
                          {g.awayPitcher?.split(' ').pop() ?? 'TBD'} vs. {g.homePitcher?.split(' ').pop() ?? 'TBD'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Build Lineup button */}
              {onAsk && (
                <button
                  onClick={() => handleSlateClick(slate)}
                  className={cn(
                    'mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all duration-200',
                    isSelected
                      ? 'relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_0_12px_oklch(0.6_0.18_160/0.4)] hover:shadow-[0_0_18px_oklch(0.6_0.18_160/0.6)]'
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-[0_2px_8px_oklch(0.4_0.2_280/0.3)]',
                  )}
                >
                  {isSelected && (
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-[shimmer_2s_infinite] pointer-events-none" />
                  )}
                  {isSelected ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Active Lineup
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      Build Lineup
                    </>
                  )}
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
});
