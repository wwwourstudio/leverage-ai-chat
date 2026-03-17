'use client';

import { memo } from 'react';
import { Target, ArrowUpRight, Zap } from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, TierBadge, type FantasyCardProps } from './shared';

export const DraftCard = memo(function DraftCard({ data, ...p }: FantasyCardProps) {
  const { bestPick, leveragePicks = [], tierCliffAlerts = [], sport } = data;
  const avatarSport = sport?.toLowerCase() || p.category?.toLowerCase();

  return (
    <Shell {...p} status="target" Icon={Target}>
      {/* Best Pick — hero highlight */}
      {bestPick && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/6 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-teal-400">Best Pick Now</span>
            <ArrowUpRight className="w-3 h-3 text-teal-400" />
          </div>
          <div className="flex items-center gap-2.5">
            <PlayerAvatar
              playerName={bestPick.name}
              photoUrl={bestPick.photoUrl ?? getPlayerHeadshotUrl(bestPick.name)}
              sport={avatarSport}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <PosBadge pos={bestPick.pos} />
                <TierBadge tier={bestPick.tier} />
                <span className="text-sm font-black text-white">{bestPick.name}</span>
                <span className="text-xs text-[oklch(0.48_0.01_280)]">{bestPick.team}</span>
              </div>
              {bestPick.reason && (
                <p className="text-[11px] text-[oklch(0.48_0.01_280)] mt-1 leading-relaxed">{bestPick.reason}</p>
              )}
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-base font-black text-teal-400 tabular-nums">+{bestPick.vbd}</span>
              <span className="text-[8px] text-[oklch(0.35_0.01_280)]">VBD</span>
            </div>
          </div>
        </div>
      )}

      {/* Leverage Plays */}
      {leveragePicks.length > 0 && (
        <>
          <div className="flex items-center gap-1.5">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <p className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.42_0.01_280)]">Leverage Plays</p>
          </div>
          <div className="space-y-1.5">
            {leveragePicks.slice(0, 3).map((lp: any, i: number) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors',
                  i === 0
                    ? 'bg-amber-500/6 border-amber-500/20'
                    : 'bg-[oklch(0.08_0.01_280)] border-[oklch(0.15_0.01_280)]',
                )}
              >
                <span className="text-[10px] font-black text-[oklch(0.38_0.01_280)] w-3 shrink-0">{i + 1}</span>
                <PlayerAvatar
                  playerName={lp.name}
                  photoUrl={lp.photoUrl ?? getPlayerHeadshotUrl(lp.name)}
                  sport={avatarSport}
                  size="xs"
                />
                <PosBadge pos={lp.pos} />
                <span className="text-xs font-bold text-white flex-1 truncate">{lp.name}</span>
                <span className="text-[10px] text-[oklch(0.42_0.01_280)] truncate max-w-[110px] hidden sm:block">{lp.reason}</span>
                <span className={cn('text-xs font-black tabular-nums shrink-0', i === 0 ? 'text-amber-400' : 'text-white')}>
                  +{lp.vbd}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tier cliff alerts */}
      {tierCliffAlerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tierCliffAlerts.map((a: string, i: number) => (
            <span key={i} className="text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/6">
              ⚠ {a}
            </span>
          ))}
        </div>
      )}
    </Shell>
  );
});
