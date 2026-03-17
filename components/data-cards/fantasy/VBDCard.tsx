'use client';

import { memo } from 'react';
import { Trophy } from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, TierBadge, RankCircle, type FantasyCardProps } from './shared';

/** Thin relative-value bar under each player row */
function VBDBar({ vbd, maxVbd }: { vbd: number; maxVbd: number }) {
  const pct = maxVbd > 0 ? Math.min(100, (vbd / maxVbd) * 100) : 0;
  return (
    <div className="h-[2px] mx-2 mb-0.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const VBDCard = memo(function VBDCard({ data, isHero, ...p }: FantasyCardProps) {
  const { players = [], tierCliff, scoringFormat, leagueSize, sport } = data;
  const avatarSport = sport?.toLowerCase() || p.category?.toLowerCase();
  const visiblePlayers = players.slice(0, isHero ? 8 : 6);
  const maxVbd = Math.max(...visiblePlayers.map((pl: any) => pl.vbd ?? 0), 1);

  return (
    <Shell {...p} isHero={isHero} status={data.status ?? 'target'} Icon={Trophy}>
      <div className="space-y-0.5">
        {visiblePlayers.map((pl: any, idx: number) => {
          const isCliff = tierCliff && pl.name === tierCliff.cliffAfterName;
          const photoUrl = pl.photoUrl ?? getPlayerHeadshotUrl(pl.name);
          const isTop = idx === 0;
          const rowBg = isTop
            ? 'bg-teal-500/8 border-teal-500/20 shadow-[inset_0_0_0_1px_oklch(0.5_0.15_170/0.08)]'
            : 'bg-[oklch(0.08_0.01_280)] border-[oklch(0.15_0.01_280)]';
          return (
            <div key={pl.name}>
              <div
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors hover:bg-[oklch(0.12_0.01_280)] cursor-pointer',
                  rowBg,
                )}
                onClick={() => {
                  const query = `Analyze ${pl.name} (${pl.team} ${pl.pos}) — show recent game stats, season projections, and best prop bets`;
                  window.dispatchEvent(new CustomEvent('leveragePlayerClick', { detail: { query, category: 'fantasy' } }));
                }}
                title={`Analyze ${pl.name}`}
              >
                <RankCircle rank={pl.rank ?? idx + 1} tier={pl.tier ?? 4} />
                <PlayerAvatar playerName={pl.name} photoUrl={photoUrl} sport={avatarSport} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-white truncate block">
                    {pl.name}
                    <span className="text-[10px] font-normal text-[oklch(0.42_0.01_280)] ml-1">{pl.team}</span>
                  </span>
                  {pl.adp && (
                    <span className="text-[9px] text-[oklch(0.35_0.01_280)]">ADP {pl.adp}</span>
                  )}
                </div>
                <PosBadge pos={pl.pos} />
                <TierBadge tier={pl.tier} />
                <span className="text-[11px] font-black tabular-nums text-emerald-400 w-10 text-right shrink-0">
                  +{pl.vbd}
                </span>
              </div>
              {/* VBD relative-value bar */}
              <VBDBar vbd={pl.vbd ?? 0} maxVbd={maxVbd} />
              {isCliff && (
                <div className="flex items-center gap-2 py-1 px-2">
                  <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                  <span className="text-[9px] font-black text-amber-400 whitespace-nowrap">
                    ▼ TIER CLIFF — {tierCliff.dropPct?.toFixed(1)}% DROP
                  </span>
                  <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-[oklch(0.35_0.01_280)] pt-0.5">
        VBD = pts above replacement · {scoringFormat ?? 'PPR'} · {leagueSize ?? 12}-team
      </p>
    </Shell>
  );
});
