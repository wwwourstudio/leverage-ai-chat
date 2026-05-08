'use client';

import { memo } from 'react';
import { Calendar, ChevronRight, Clock } from 'lucide-react';
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
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider shrink-0',
      selected
        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
        : isMain
        ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
        : isShowdown
        ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]',
    )}>
      {selected && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
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
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-overlay)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)] transition-all duration-300">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-3.5 pb-3 bg-gradient-to-br from-blue-700/75 via-indigo-800/55 to-blue-900/35">
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400/80">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            LIVE
          </span>
          <Calendar className="w-3.5 h-3.5 text-blue-300" />
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">MLB</span>
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
        <div className="px-4 py-6 text-center text-[11px] text-[var(--text-faint)]">
          No DraftKings slates available yet. Check back closer to game time.
        </div>
      )}

      {/* ── Slate list ───────────────────────────────────────────────── */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {slates.map(slate => {
          const isSelected = slate.draftGroupId === selectedId;
          return (
            <div key={slate.draftGroupId} className="px-3 py-2.5">
              {/* Slate header row */}
              <div className="flex items-center gap-2 mb-1.5">
                <SlateLabelBadge label={slate.slateLabel} contestType={slate.contestType} selected={isSelected} />
                <span className="text-[10px] text-[var(--text-muted)] tabular-nums flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 opacity-60" />
                  {formatGameTime(slate.startDate)}
                </span>
                <span className="text-[9px] text-[var(--text-faint)] ml-auto">{slate.gameCount}G</span>
              </div>

              {/* Games in this slate */}
              <div className="space-y-1">
                {slate.games.map(g => (
                  <div
                    key={g.gameId}
                    className="flex items-center gap-2 py-1 px-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[11px] text-white">{g.awayTeamAbbr}</span>
                        <span className="text-[9px] text-[var(--text-faint)]">@</span>
                        <span className="font-black text-[11px] text-white">{g.homeTeamAbbr}</span>
                        {g.startTime && (
                          <span className="text-[9px] text-[var(--text-faint)] tabular-nums ml-1">
                            {formatGameTime(g.startTime)}
                          </span>
                        )}
                      </div>
                      {(g.awayPitcher || g.homePitcher) && (
                        <div className="text-[9px] text-[var(--text-muted)] mt-0.5 truncate">
                          {g.awayPitcher ?? 'TBD'} vs. {g.homePitcher ?? 'TBD'}
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
                    'mt-2 w-full flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-colors',
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-blue-500/10 border-blue-500/25 text-blue-300 hover:bg-blue-500/20',
                  )}
                >
                  {isSelected ? '✓ Active Lineup' : 'Build Lineup'}
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
