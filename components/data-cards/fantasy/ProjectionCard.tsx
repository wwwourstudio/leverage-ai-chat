'use client';

import { memo } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from '../PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { Shell, PosBadge, TierBadge, type FantasyCardProps } from './shared';

export const ProjectionCard = memo(function ProjectionCard({ data, ...p }: FantasyCardProps) {
  const { name, pos, team, pts, vbd, adp, tier, analysis, sport } = data;
  const avatarSport = sport?.toLowerCase() || p.category?.toLowerCase();
  const vbdNum = typeof vbd === 'number' ? vbd : parseFloat(String(vbd ?? 0));

  const stats = [
    pts  != null && { label: 'Proj Pts', val: pts,  color: 'text-white' },
    vbd  != null && { label: 'VBD',      val: `${vbdNum >= 0 ? '+' : ''}${vbdNum}`, color: vbdNum >= 0 ? 'text-emerald-400' : 'text-red-400' },
    adp  != null && { label: 'ADP',      val: adp,  color: 'text-white' },
  ].filter(Boolean) as { label: string; val: string | number; color: string }[];

  return (
    <Shell {...p} status={data.status ?? 'value'} Icon={TrendingUp}>
      {/* Player identity row */}
      {(name || pos || team) && (
        <div className="flex items-center gap-2.5">
          {name && (
            <PlayerAvatar
              playerName={name}
              photoUrl={data.photoUrl ?? getPlayerHeadshotUrl(name)}
              sport={avatarSport}
              size="md"
            />
          )}
          <div className="flex-1 min-w-0">
            {name && <p className="text-sm font-black text-white truncate">{name}</p>}
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              {pos  && <PosBadge pos={pos} />}
              {tier && <TierBadge tier={tier} />}
              {team && <span className="text-[10px] text-[oklch(0.48_0.01_280)] font-medium">{team}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Stat grid */}
      {stats.length > 0 && (
        <div className={cn('grid gap-1.5', stats.length === 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
          {stats.map(s => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] py-2.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">{s.label}</span>
              <span className={cn('text-lg font-black tabular-nums', s.color)}>{String(s.val)}</span>
            </div>
          ))}
        </div>
      )}

      {analysis && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{analysis}</p>
      )}
    </Shell>
  );
});
