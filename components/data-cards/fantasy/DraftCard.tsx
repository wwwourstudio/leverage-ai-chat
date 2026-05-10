'use client';

import { memo } from 'react';
import { Target, ArrowUpRight, Zap, Lightbulb } from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, TierBadge, type FantasyCardProps } from './shared';

function dispatchPlayerClick(name: string, pos: string, team: string, adp?: number) {
  const meta = [team, pos].filter(Boolean).join(' ');
  const adpLabel = adp ? ` · ADP ${adp}` : '';
  const query = `Analyze ${name}${meta ? ` (${meta}${adpLabel})` : ''} — recent stats, season projections, and draft value`;
  window.dispatchEvent(new CustomEvent('leveragePlayerClick', { detail: { query, category: 'fantasy' } }));
}

export const DraftCard = memo(function DraftCard({ data, ...p }: FantasyCardProps) {
  const { bestPick, leveragePicks = [], tierCliffAlerts = [], sport } = data;
  const avatarSport = sport?.toLowerCase() || p.category?.toLowerCase();

  return (
    <Shell {...p} status="target" Icon={Target}>
      {/* Best Pick — hero highlight */}
      {bestPick && (
        <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-purple-500/5 px-3 py-3">
          {/* Header row */}
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30">
              <ArrowUpRight className="w-2.5 h-2.5 text-violet-400" />
              <span className="text-[9px] font-black uppercase tracking-wider text-violet-300">Best Pick Now</span>
            </div>
          </div>

          {/* Player row */}
          <div className="flex items-center gap-3">
            <PlayerAvatar
              playerName={bestPick.name}
              photoUrl={bestPick.photoUrl ?? getPlayerHeadshotUrl(bestPick.name)}
              sport={avatarSport}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <PosBadge pos={bestPick.pos} />
                <TierBadge tier={bestPick.tier} />
                <button
                  className="text-sm font-black text-white hover:text-violet-300 transition-colors text-left"
                  onClick={() => dispatchPlayerClick(bestPick.name, bestPick.pos, bestPick.team, bestPick.adp)}
                  title={`Analyze ${bestPick.name}`}
                >
                  {bestPick.name}
                </button>
                <span className="text-xs text-[var(--text-muted)]">{bestPick.team}</span>
              </div>
              {bestPick.reason && (
                <div className="flex items-start gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg bg-[var(--bg-overlay)]/60 border border-violet-500/15">
                  <Lightbulb className="w-3 h-3 text-violet-400/70 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{bestPick.reason}</p>
                </div>
              )}
            </div>

            {/* VBD hero number */}
            <div className="flex flex-col items-center shrink-0 gap-0.5 px-2.5 py-2 rounded-xl bg-[var(--bg-overlay)]/60 border border-violet-500/20">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)]">VBD</span>
              <span className="text-xl font-black text-violet-300 tabular-nums leading-none">+{bestPick.vbd}</span>
              {bestPick.adp != null && (
                <span className="text-[9px] font-bold text-[var(--text-faint)] tabular-nums">ADP {bestPick.adp}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leverage Plays */}
      {leveragePicks.length > 0 && (
        <>
          <div className="flex items-center gap-1.5">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Leverage Plays</p>
          </div>
          <div className="space-y-1.5">
            {leveragePicks.slice(0, 3).map((lp: any, i: number) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors',
                  i === 0
                    ? 'bg-amber-500/8 border-amber-500/25'
                    : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)]',
                )}
              >
                <span className="text-[10px] font-black text-[var(--text-faint)] w-3 shrink-0">{i + 1}</span>
                <PlayerAvatar
                  playerName={lp.name}
                  photoUrl={lp.photoUrl ?? getPlayerHeadshotUrl(lp.name)}
                  sport={avatarSport}
                  size="xs"
                />
                <PosBadge pos={lp.pos} />
                <button
                  className="text-xs font-bold text-white flex-1 truncate text-left hover:text-amber-300 transition-colors"
                  onClick={() => dispatchPlayerClick(lp.name, lp.pos, lp.team, lp.adp)}
                  title={`Analyze ${lp.name}`}
                >
                  {lp.name}
                </button>
                <span className="text-[10px] text-[var(--text-faint)] truncate max-w-[110px] hidden sm:block">{lp.reason}</span>
                <div className="flex flex-col items-end shrink-0">
                  <span className={cn('text-xs font-black tabular-nums', i === 0 ? 'text-amber-400' : 'text-white')}>
                    +{lp.vbd}
                  </span>
                  {lp.adp != null && (
                    <span className="text-[8px] text-[var(--text-faint)] tabular-nums">{lp.adp}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tier cliff alerts — pill chips */}
      {tierCliffAlerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tierCliffAlerts.map((a: string, i: number) => (
            <span key={i} className="text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/8 flex items-center gap-1">
              <span>⚠</span> {a}
            </span>
          ))}
        </div>
      )}
    </Shell>
  );
});
