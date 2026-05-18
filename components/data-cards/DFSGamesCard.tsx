'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { Calendar, ChevronRight, Clock, Zap, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── TeamLogoByAbbr ─────────────────────────────────────────────────────── */

// Legacy MLB Stats API teamCode values → correct ESPN CDN abbreviations.
// The MLB Stats API returns teamCode (e.g. "tig", "pir") which differs from
// the abbreviation field (e.g. "DET", "PIT") that ESPN CDN expects.
// This map ensures old stored card data still resolves to valid logo URLs.
const MLB_LEGACY_CODES: Record<string, string> = {
  tig: 'det', pir: 'pit', dod: 'lad', gia: 'sf',  jay: 'tor',
  nat: 'wsh', cub: 'chc', bra: 'atl', sox: 'bos', roy: 'kc',
  ori: 'bal', ath: 'oak', ang: 'laa', ast: 'hou', ran: 'tex',
  car: 'stl', bre: 'mil', mar: 'mia', twi: 'min', met: 'nym',
  yan: 'nyy', pad: 'sd',  ray: 'tb',  cha: 'chw', red: 'cin',
  gua: 'cle', roc: 'col', dia: 'ari',
};

function TeamLogoByAbbr({ abbr, sport = 'mlb', size = 32 }: { abbr: string; sport?: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const lower      = abbr.toLowerCase();
  const normalized = sport === 'mlb' ? (MLB_LEGACY_CODES[lower] ?? lower) : lower;
  const src = `https://a.espncdn.com/i/teamlogos/${sport.toLowerCase()}/500/${normalized}.png`;

  if (errored) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white font-black shrink-0"
        style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.36)) } as React.CSSProperties}
      >
        {abbr.slice(0, 3)}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-white/5 border border-white/10"
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={abbr}
        width={size}
        height={size}
        className="object-contain"
        onError={() => setErrored(true)}
        unoptimized
      />
    </span>
  );
}

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

const MAX_GAMES_SHOWN = 6;

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

/** Slate type → badge config */
function getSlateBadge(label: string, contestType: string, selected: boolean) {
  if (selected) return { cls: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', dot: true };
  const l = label.toLowerCase();
  if (contestType === 'showdown') return { cls: 'bg-violet-500/15 border-violet-500/30 text-violet-300', dot: false };
  if (l.includes('turbo'))        return { cls: 'bg-amber-500/15 border-amber-500/30 text-amber-300', dot: false };
  if (l.includes('early'))        return { cls: 'bg-sky-500/15 border-sky-500/30 text-sky-300', dot: false };
  if (l.includes('main'))         return { cls: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300', dot: false };
  if (l.includes('featured'))     return { cls: 'bg-blue-500/15 border-blue-500/30 text-blue-300', dot: false };
  return { cls: 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]', dot: false };
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
              : 'text-white/50 hover:text-white/80',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

/* ─── GameRow ────────────────────────────────────────────────────────────── */

function formatPitcherName(full: string | undefined): string | undefined {
  if (!full) return undefined;
  const parts = full.trim().split(' ');
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

function GameRow({ g, sport }: { g: EnrichedGameRef; sport: string }) {
  const awayLastName = formatPitcherName(g.awayPitcher);
  const homeLastName = formatPitcherName(g.homePitcher);
  const hasPitchers  = Boolean(g.awayPitcher || g.homePitcher);

  return (
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]/60">
      {/* Away */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <TeamLogoByAbbr abbr={g.awayTeamAbbr} sport={sport} size={30} />
        <span className="font-black text-[13px] text-white tracking-wide leading-none">{g.awayTeamAbbr.toUpperCase()}</span>
      </div>

      {/* VS */}
      <div className="flex flex-col items-center shrink-0 gap-0.5">
        <span className="text-[9px] text-[var(--text-faint)] font-bold">@</span>
        {g.startTime && (
          <span suppressHydrationWarning className="text-[8px] text-[var(--text-faint)] tabular-nums">
            {formatGameTime(g.startTime)}
          </span>
        )}
      </div>

      {/* Home */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
        <span className="font-black text-[13px] text-white tracking-wide leading-none">{g.homeTeamAbbr.toUpperCase()}</span>
        <TeamLogoByAbbr abbr={g.homeTeamAbbr} sport={sport} size={30} />
      </div>

      {/* Pitchers */}
      {hasPitchers && (
        <div className="ml-1 shrink-0 text-right">
          <span className="text-[8px] text-[var(--text-muted)] block">{awayLastName ?? 'TBD'}</span>
          <span className="text-[8px] text-[var(--text-muted)] block">{homeLastName ?? 'TBD'}</span>
        </div>
      )}
    </div>
  );
}

/** Shown when games array is empty but gameCount > 0 */
function GameCountFallback({ count, startTime }: { count: number; startTime: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]/60">
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-[var(--text-faint)]" />
        <span className="text-[11px] font-bold text-[var(--text-muted)]">
          {count} game{count !== 1 ? 's' : ''} on this slate
        </span>
      </div>
      {startTime && (
        <span suppressHydrationWarning className="inline-flex items-center gap-0.5 text-[9px] text-[var(--text-faint)] tabular-nums">
          <Clock className="w-2.5 h-2.5 opacity-60" />
          {formatGameTime(startTime)}
        </span>
      )}
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

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 dark:via-amber-900/5 to-transparent border-b border-[var(--border-subtle)]">
        <div className="absolute top-0 right-0 w-40 h-20 bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/5 rounded-bl-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-white/60">
            <span className="text-[9px] font-black uppercase tracking-widest">{sportLabel}</span>
            <span className="text-white/30">·</span>
            <span className="text-[9px]">DFS Slates</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wide">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
            <Calendar className="w-3.5 h-3.5 text-[var(--cat-dfs,oklch(0.72_0.20_80))]/70" />
          </div>
        </div>

        <h3 className="font-black text-white leading-snug text-sm">Today's DFS Slates</h3>
        <p className="text-[10px] text-white/50 mt-0.5 mb-2.5">
          {slates.length} slate{slates.length !== 1 ? 's' : ''} available · tap to build a lineup
        </p>

        <PlatformToggle value={platform} onChange={setPlatform} />
      </div>

      {/* ── No slates fallback ───────────────────────────────────────── */}
      {slates.length === 0 && (
        <div className="px-4 py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-5 h-5 text-[var(--text-faint)]" />
          </div>
          <p className="text-[11px] text-[var(--text-faint)]">No slates available yet.</p>
          <p className="text-[10px] text-[var(--text-faint)]/60 mt-0.5">Check back closer to game time.</p>
        </div>
      )}

      {/* ── Slate list ───────────────────────────────────────────────── */}
      <div className="p-3 space-y-3">
        {slates.map((slate, slateIdx) => {
          const isSelected   = slate.draftGroupId === selectedId;
          const isBestPlay   = slateIdx === bestSlateIdx;
          const badge        = getSlateBadge(slate.slateLabel, slate.contestType, isSelected);
          const games        = slate.games ?? [];
          const visibleGames = games.slice(0, MAX_GAMES_SHOWN);
          const hiddenCount  = games.length - visibleGames.length;
          const hasGames     = games.length > 0;

          const leftBorderCls =
            isSelected ? 'border-l-2 border-l-emerald-400'
            : isBestPlay ? 'border-l-2 border-l-[var(--cat-dfs,oklch(0.72_0.20_80))]'
            : slate.contestType === 'showdown' ? 'border-l-2 border-l-violet-500'
            : slate.slateLabel.toLowerCase().includes('main') ? 'border-l-2 border-l-indigo-400'
            : 'border-l-2 border-l-[var(--border-subtle)]';

          return (
            <div
              key={slate.draftGroupId}
              className={cn(
                'rounded-xl bg-[var(--bg-elevated)] p-3 transition-all duration-200',
                leftBorderCls,
                isSelected ? 'shadow-[0_0_12px_oklch(0.72_0.20_80/0.12)]' : '',
                isBestPlay && !isSelected ? 'ring-1 ring-[var(--cat-dfs,oklch(0.72_0.20_80))]/20' : '',
              )}
            >
              {/* AI Best Play alert banner */}
              {isBestPlay && (
                <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/10 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/25">
                  <Sparkles className="w-3 h-3 text-[var(--cat-dfs,oklch(0.72_0.20_80))] shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-[var(--cat-dfs,oklch(0.72_0.20_80))]">AI Best Play</span>
                  <Trophy className="w-3 h-3 text-[var(--cat-dfs,oklch(0.72_0.20_80))] ml-auto" />
                </div>
              )}

              {/* Slate header row */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest shrink-0',
                  badge.cls,
                )}>
                  {badge.dot && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
                  {slate.slateLabel}
                </span>

                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[9px] text-[var(--text-muted)] tabular-nums">
                  <Clock className="w-2.5 h-2.5 opacity-60" />
                  <span suppressHydrationWarning>{formatGameTime(slate.startDate)}</span>
                </span>

                <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-black text-[var(--text-faint)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-full">
                  {slate.gameCount}G
                </span>
              </div>

              {/* Game rows — or fallback when games array is empty */}
              <div className="space-y-1.5">
                {hasGames ? (
                  <>
                    {visibleGames.map(g => (
                      <GameRow key={g.gameId} g={g} sport={sport} />
                    ))}
                    {hiddenCount > 0 && (
                      <div className="flex items-center justify-center py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]/40">
                        <span className="text-[9px] font-bold text-[var(--text-faint)] uppercase tracking-wide">
                          +{hiddenCount} more game{hiddenCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <GameCountFallback count={slate.gameCount} startTime={slate.startDate} />
                )}
              </div>

              {/* CTA */}
              {onAsk && (
                <button
                  onClick={() => handleSlateClick(slate)}
                  className={cn(
                    'mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all duration-200 relative overflow-hidden',
                    isSelected
                      ? 'bg-gradient-to-r from-[var(--cat-dfs,oklch(0.72_0.20_80))]/80 to-amber-500/80 text-black shadow-[0_0_12px_oklch(0.72_0.20_80/0.4)] hover:shadow-[0_0_18px_oklch(0.72_0.20_80/0.6)]'
                      : isBestPlay
                      ? 'bg-gradient-to-r from-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 to-amber-600/30 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/40 text-[var(--cat-dfs,oklch(0.72_0.20_80))] hover:from-[var(--cat-dfs,oklch(0.72_0.20_80))]/50 hover:text-white'
                      : 'bg-gradient-to-r from-[var(--cat-dfs,oklch(0.72_0.20_80))]/15 to-amber-600/15 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/25 text-[var(--cat-dfs,oklch(0.72_0.20_80))]/80 hover:from-[var(--cat-dfs,oklch(0.72_0.20_80))]/25 hover:text-[var(--cat-dfs,oklch(0.72_0.20_80))]',
                  )}
                >
                  {isSelected && (
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-[shimmer_2s_infinite] pointer-events-none" />
                  )}
                  {isSelected ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--foreground)] animate-pulse" />
                      Active — Build {platform} Lineup
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      Build {platform} Lineup
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
