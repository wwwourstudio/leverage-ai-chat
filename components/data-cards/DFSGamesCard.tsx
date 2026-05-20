'use client';

import { memo, useState } from 'react';
import { ChevronRight, Zap, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────────── */

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
    sport?: string;
  };
  onAsk?: (query: string) => void;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatGameTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
}

/** Pick the "best" slate index to highlight with AI badge.
 *  Prefer: classic type > most games > first occurrence. */
function getBestSlateIndex(slates: EnrichedSlate[]): number {
  let best = 0;
  let bestScore = -1;
  slates.forEach((s, i) => {
    const isClassic = s.contestType !== 'showdown' ? 1 : 0;
    const score = isClassic * 1000 + s.gameCount;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** Truncate pitcher name to first initial + last name */
function formatPitcherName(full: string | undefined): string | undefined {
  if (!full) return undefined;
  const parts = full.trim().split(' ');
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

/* ─── PlatformToggle ─────────────────────────────────────────────────────── */

function PlatformToggle({ value, onChange }: { value: 'DK' | 'FD'; onChange: (v: 'DK' | 'FD') => void }) {
  return (
    <div className="inline-flex items-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-0.5 gap-0.5">
      {(['DK', 'FD'] as const).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-150',
            value === p
              ? 'bg-[var(--cat-dfs,oklch(0.72_0.20_80))] text-black shadow-sm'
              : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]/80',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

/* ─── DFSGamesCard ───────────────────────────────────────────────────────── */

export const DFSGamesCard = memo(function DFSGamesCard({ data, onAsk }: DFSGamesCardProps) {
  const [platform, setPlatform] = useState<'DK' | 'FD'>('DK');

  const slates: EnrichedSlate[] = Array.isArray(data.slates) ? data.slates : [];
  const selectedId: number | null = data.selectedDraftGroupId ?? null;
  const sport: string = data.sport ?? 'mlb';
  const sportLabel = sport.replace(/_/g, ' ').toUpperCase();

  const bestSlateIdx = slates.length > 0 ? getBestSlateIndex(slates) : -1;

  function handleSlateClick(slate: EnrichedSlate) {
    if (!onAsk) return;
    const platformName = platform === 'DK' ? 'DraftKings' : 'FanDuel';
    if (slate.contestType === 'showdown' && (slate.games ?? []).length === 1) {
      const g = slate.games[0];
      onAsk(`Build ${platform} DFS showdown lineup for ${g.awayTeamAbbr.toUpperCase()} @ ${g.homeTeamAbbr.toUpperCase()} (${platformName} #${slate.draftGroupId})`);
    } else {
      onAsk(`Build ${platform} DFS lineup for the ${slate.slateLabel} slate (${platformName} #${slate.draftGroupId})`);
    }
  }

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_24px_oklch(0.72_0.20_80/0.12)] transition-all duration-300">

      {/* Header breadcrumb */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 to-transparent border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/60">{sportLabel}</span>
          <span className="text-[var(--foreground)]/30">·</span>
          <span className="text-[9px] text-[var(--foreground)]/50">DFS Slates</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[9px] font-dm-mono font-bold uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            LIVE
          </span>
          <PlatformToggle value={platform} onChange={setPlatform} />
        </div>
      </div>

      {/* Title block */}
      <div className="px-4 pt-3 pb-2.5 border-b border-[var(--border-subtle)]">
        <h3 className="font-bebas text-[22px] text-[var(--foreground)] leading-none" style={{ letterSpacing: '0.02em' }}>
          Today's DFS Slates
        </h3>
        <p className="font-dm-mono text-[11px] text-[var(--text-secondary,var(--text-muted))] mt-0.5">
          {slates.length} slate{slates.length !== 1 ? 's' : ''} available · tap to build a lineup
        </p>
      </div>

      {/* No slates fallback */}
      {slates.length === 0 && (
        <div className="px-4 py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-5 h-5 text-[var(--text-faint)]" />
          </div>
          <p className="text-[11px] text-[var(--text-faint)]">No slates available yet.</p>
          <p className="text-[10px] text-[var(--text-faint)]/60 mt-0.5">Check back closer to game time.</p>
        </div>
      )}

      {/* Slate list */}
      <div className="divide-y divide-[var(--border-subtle)]/40">
        {slates.map((slate, slateIdx) => {
          const isSelected = slate.draftGroupId === selectedId;
          const isBestPlay = slateIdx === bestSlateIdx;
          const isShowdown = slate.contestType === 'showdown';
          const slateNameLower = slate.slateLabel.toLowerCase();

          // Tag pill color
          const tagCls = isShowdown
            ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
            : slateNameLower.includes('turbo') || slateNameLower.includes('early')
            ? 'bg-green-500/15 border-green-500/30 text-green-300'
            : 'bg-amber-500/15 border-amber-500/30 text-amber-300';
          const tagLabel = isShowdown ? 'SHOWDOWN' : slateNameLower.includes('turbo') ? 'TURBO' : 'MAIN';

          return (
            <button
              key={slate.draftGroupId}
              onClick={() => handleSlateClick(slate)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)]/50',
                isBestPlay && !isSelected ? 'border border-[rgba(92,157,255,0.3)] rounded-none' : '',
                isSelected ? 'bg-[var(--bg-elevated)]/60' : '',
              )}
            >
              {/* Games count */}
              <span className="font-bebas text-[28px] text-[var(--text-muted)] tabular-nums leading-none min-w-[2ch] text-center shrink-0" style={{ letterSpacing: '0.02em' }}>
                {slate.gameCount}
              </span>

              {/* 1px vertical divider */}
              <div className="w-px h-8 bg-[var(--border-subtle)] shrink-0" />

              {/* Slate info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[var(--foreground)] truncate">{slate.slateLabel}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span suppressHydrationWarning className="font-dm-mono text-[10px] text-[var(--text-muted)]">{formatGameTime(slate.startDate)}</span>
                  <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full border font-dm-mono text-[9px] font-medium uppercase', tagCls)}>
                    {tagLabel}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-[var(--text-faint)] shrink-0" />
            </button>
          );
        })}

        {/* Build a Lineup CTA */}
        {onAsk && slates.length > 0 && (
          <div className="px-4 py-3">
            <button
              onClick={() => handleSlateClick(slates[bestSlateIdx >= 0 ? bestSlateIdx : 0])}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-dm-mono text-[11px] font-medium uppercase tracking-wide hover:bg-blue-500/25 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Build a Lineup
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
