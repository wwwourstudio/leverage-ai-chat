'use client';

import { memo } from 'react';
import { Trophy } from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, TierBadge, RankCircle, type FantasyCardProps } from './shared';

/** Relative-value bar under each player row */
function VBDBar({ vbd, maxVbd }: { vbd: number; maxVbd: number }) {
  const pct = maxVbd > 0 ? Math.min(100, (vbd / maxVbd) * 100) : 0;
  return (
    <div className="h-1.5 mx-2 mb-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-emerald-400 transition-all duration-700"
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
            ? 'bg-violet-500/10 border-violet-500/25 shadow-[inset_0_0_0_1px_oklch(0.5_0.15_280/0.08)]'
            : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)]';
          return (
            <div key={pl.name}>
              <div
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors hover:bg-[var(--bg-elevated)] cursor-pointer',
                  rowBg,
                )}
                onClick={() => {
                  const meta = [pl.team, pl.pos].filter(Boolean).join(' ');
                  const query = `Analyze ${pl.name}${meta ? ` (${meta})` : ''} — show recent game stats, season projections, and best prop bets`;
                  window.dispatchEvent(new CustomEvent('leveragePlayerClick', { detail: { query, category: 'fantasy' } }));
                }}
                title={`Analyze ${pl.name}`}
              >
                <RankCircle rank={pl.rank ?? idx + 1} tier={pl.tier ?? 4} />
                <PlayerAvatar playerName={pl.name} photoUrl={photoUrl} sport={avatarSport} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-white truncate block">
                    {pl.name}
                    <span className="text-[10px] font-normal text-[var(--text-faint)] ml-1">{pl.team}</span>
                  </span>
                  {pl.adp && (
                    <span className="text-[9px] text-[var(--text-faint)]">ADP {pl.adp}</span>
                  )}
                </div>
                <PosBadge pos={pl.pos} />
                <TierBadge tier={pl.tier} />
                {/* VBD value as colored +/- chip */}
                <span className={cn(
                  'text-[11px] font-black tabular-nums w-10 text-right shrink-0 rounded-full px-1.5 py-0.5',
                  (pl.vbd ?? 0) >= 20
                    ? 'text-emerald-300 bg-emerald-500/15'
                    : (pl.vbd ?? 0) >= 10
                    ? 'text-teal-300 bg-teal-500/12'
                    : 'text-emerald-400',
                )}>
                  +{pl.vbd}
                </span>
              </div>
              {/* VBD relative-value bar */}
              <VBDBar vbd={pl.vbd ?? 0} maxVbd={maxVbd} />
              {isCliff && (
                <div className="flex items-center gap-2 py-1.5 px-2">
                  <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                  <span className="text-[9px] font-black text-amber-400 whitespace-nowrap tracking-wide">
                    ▼ TIER CLIFF — {tierCliff.dropPct?.toFixed(1)}% DROP
                  </span>
                  <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-[var(--text-faint)] pt-0.5 border-t border-[var(--border-subtle)]">
        VBD = pts above replacement · {scoringFormat ?? 'PPR'} · {leagueSize ?? 12}-team
      </p>
    </Shell>
  );
});
