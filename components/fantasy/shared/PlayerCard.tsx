'use client';

import { cn } from '@/lib/utils';
import { PositionBadge } from './PositionBadge';
import { PlayerAvatar } from '@/components/data-cards/PlayerAvatar';
import type { PlayerWithVBD } from '@/lib/fantasy/types';

// ---------------------------------------------------------------------------
// Position-group accent colours + sport inference
// ---------------------------------------------------------------------------

function getPositionAccent(position: string): { gradient: string; textCls: string } {
  // MLB — pitchers
  if (['SP', 'RP', 'P'].includes(position))
    return { gradient: 'from-teal-500 to-teal-700',   textCls: 'text-teal-400' };
  // MLB — infield
  if (['1B', '2B', '3B', 'SS'].includes(position))
    return { gradient: 'from-indigo-500 to-indigo-700', textCls: 'text-indigo-400' };
  // MLB — outfield / DH / catcher
  if (['OF', 'DH', 'C'].includes(position))
    return { gradient: 'from-violet-500 to-violet-700', textCls: 'text-violet-400' };
  // NFL — QB
  if (position === 'QB')
    return { gradient: 'from-red-500 to-red-700',      textCls: 'text-red-400' };
  // NFL — RB
  if (position === 'RB')
    return { gradient: 'from-green-500 to-green-700',  textCls: 'text-green-400' };
  // NFL — WR / FLEX
  if (['WR', 'FLEX', 'SUPERFLEX'].includes(position))
    return { gradient: 'from-blue-500 to-blue-700',    textCls: 'text-blue-400' };
  // NFL — TE
  if (position === 'TE')
    return { gradient: 'from-orange-500 to-orange-700', textCls: 'text-orange-400' };
  // NBA — guards
  if (['PG', 'SG', 'G'].includes(position))
    return { gradient: 'from-orange-500 to-orange-700', textCls: 'text-orange-400' };
  // NBA — forwards
  if (['SF', 'PF', 'F'].includes(position))
    return { gradient: 'from-amber-500 to-amber-700',  textCls: 'text-amber-400' };
  // NBA — center
  if (position === 'C')
    return { gradient: 'from-rose-500 to-rose-700',    textCls: 'text-rose-400' };
  // Default
  return { gradient: 'from-gray-500 to-gray-700',      textCls: 'text-gray-400' };
}

/** Infer sport string for PlayerAvatar colour scheme */
function getSportFromPosition(position: string): string {
  if (['SP', 'RP', 'P', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'C'].includes(position))
    return 'baseball';
  if (['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'].includes(position))
    return 'basketball';
  return 'football';
}

// ---------------------------------------------------------------------------

interface PlayerCardProps {
  player: PlayerWithVBD;
  survivalProbability?: number;
  isRecommended?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PlayerCard({
  player,
  survivalProbability,
  isRecommended,
  onClick,
  className,
}: PlayerCardProps) {
  const accent = getPositionAccent(player.position);
  const sport  = getSportFromPosition(player.position);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      className={cn(
        'group relative flex items-center gap-3 pl-4 pr-3 py-3',
        'rounded-xl bg-[oklch(0.13_0.015_280)] border border-white/10',
        'cursor-pointer select-none transition-all duration-200',
        'hover:border-white/20 hover:bg-[oklch(0.16_0.015_280)]',
        isRecommended && 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60',
        className,
      )}
    >
      {/* Left accent bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[2.5px] rounded-l-xl bg-gradient-to-b',
          accent.gradient,
          isRecommended && 'from-emerald-400 to-emerald-600',
        )}
      />

      {/* Player avatar */}
      <PlayerAvatar playerName={player.playerName} sport={sport} size="sm" />

      {/* Position badge */}
      <PositionBadge position={player.position} size="sm" />

      {/* Name + rank info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white leading-tight">{player.playerName}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5 flex-wrap">
          <span>#{player.positionRank} {player.position}</span>
          <span className="text-gray-700">·</span>
          <span>#{player.overallRank} OVR</span>
          {player.adp > 0 && (
            <>
              <span className="text-gray-700">·</span>
              <span>ADP {player.adp.toFixed(1)}</span>
            </>
          )}
        </div>
      </div>

      {/* Survival probability */}
      {typeof survivalProbability === 'number' && (
        <div
          className={cn(
            'flex flex-col items-center rounded-lg px-2 py-1 text-center shrink-0',
            survivalProbability > 0.7
              ? 'bg-emerald-500/10 text-emerald-400'
              : survivalProbability > 0.3
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-red-500/10 text-red-400',
          )}
        >
          <span className="text-sm font-black">{Math.round(survivalProbability * 100)}%</span>
          <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">survive</span>
        </div>
      )}

      {/* VBD chip */}
      <div className="flex flex-col items-end shrink-0">
        <span className={cn('text-sm font-black tabular-nums', accent.textCls)}>
          {player.vbd.toFixed(1)}
        </span>
        <span className="text-[9px] font-bold uppercase text-gray-600 tracking-wide">VBD</span>
      </div>

      {/* Tier badge */}
      {player.tier != null && (
        <div className="rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[10px] font-bold text-gray-400 shrink-0">
          T{player.tier}
        </div>
      )}
    </div>
  );
}
