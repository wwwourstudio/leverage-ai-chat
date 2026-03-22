'use client';

import { memo } from 'react';
import { Zap, Flame, TrendingUp, Activity } from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, type FantasyCardProps } from './shared';

function BreakoutBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 3) * 100);
  const isHot    = score >= 2;
  const isMedium = score >= 1.5;
  const barCls = isHot ? 'bg-gradient-to-r from-red-500 to-rose-400'
    : isMedium          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
    :                     'bg-gradient-to-r from-orange-500 to-amber-400';
  const textCls = isHot ? 'text-red-400' : isMedium ? 'text-amber-400' : 'text-orange-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-2.5 h-2.5 text-[oklch(0.42_0.01_280)]" />
          <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.42_0.01_280)]">Breakout Score</span>
        </div>
        <span className={cn('text-[10px] font-black tabular-nums', textCls)}>{score.toFixed(1)}σ</span>
      </div>
      <div className="h-1 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', barCls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = [
    'text-yellow-400 bg-yellow-500/15 border-yellow-500/25',
    'text-slate-300 bg-slate-500/15 border-slate-500/25',
    'text-amber-600 bg-amber-700/15 border-amber-700/25',
  ];
  const cls = colors[rank - 1] ?? 'text-[oklch(0.45_0.01_280)] bg-[oklch(0.12_0.01_280)] border-[oklch(0.18_0.01_280)]';
  return (
    <span className={cn('w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-black shrink-0', cls)}>
      {rank}
    </span>
  );
}

export const WaiverCard = memo(function WaiverCard({ data, isHero, ...p }: FantasyCardProps) {
  const { targets = [], description, budgetNote, sport } = data;
  const avatarSport = sport?.toLowerCase() || p.category?.toLowerCase();

  // Statcast xwOBA leaderboard — targets have xwoba/exitVelo/barrelRate but no faabBid/breakoutScore
  const isStatcastLeaderboard = targets.length > 0 && targets[0]?.xwoba != null && targets[0]?.faabBid == null;

  return (
    <Shell {...p} isHero={isHero} status="hot" Icon={isStatcastLeaderboard ? Activity : Zap}>
      {description && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed mb-2">{description}</p>
      )}

      {isStatcastLeaderboard ? (
        /* ── Statcast xwOBA leaderboard ── */
        <div className="space-y-1.5">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 pb-1.5 border-b border-[oklch(0.16_0.015_280)]">
            <div className="w-5 shrink-0" />
            <div className="w-7 shrink-0" />
            <div className="flex-1" />
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[8px] font-bold uppercase tracking-widest text-[oklch(0.38_0.01_280)] w-10 text-right">xwOBA</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-[oklch(0.38_0.01_280)] w-16 text-right">Exit Velo</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-[oklch(0.38_0.01_280)] w-12 text-right">Barrel%</span>
            </div>
          </div>

          {targets.slice(0, isHero ? 6 : 4).map((t: any, i: number) => {
            const photoUrl = t.photoUrl ?? getPlayerHeadshotUrl(t.name);
            const xwobaNum  = t.xwoba     ? Number(t.xwoba) : 0;
            const exitNum   = t.exitVelo  ? Number(t.exitVelo) : 0;
            const barrelNum = t.barrelRate ? Number(t.barrelRate) : 0;
            const isElite   = xwobaNum >= 0.420;
            const isGood    = xwobaNum >= 0.380;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors',
                  isElite
                    ? 'bg-blue-500/5 border-blue-500/20'
                    : 'bg-[oklch(0.09_0.01_280)] border-[oklch(0.15_0.012_280)]',
                )}
              >
                <RankBadge rank={i + 1} />
                <PlayerAvatar playerName={t.name} photoUrl={photoUrl} sport={avatarSport} size="sm" />
                <span className="flex-1 text-xs font-bold text-white truncate min-w-0">{t.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn(
                    'text-xs font-black tabular-nums w-10 text-right',
                    isElite ? 'text-blue-400' : isGood ? 'text-sky-400' : 'text-white',
                  )}>
                    {xwobaNum ? xwobaNum.toFixed(3) : '—'}
                  </span>
                  <span className={cn(
                    'text-xs font-semibold tabular-nums w-16 text-right',
                    exitNum >= 92 ? 'text-amber-400' : 'text-[oklch(0.60_0.01_280)]',
                  )}>
                    {exitNum ? `${exitNum.toFixed(1)} mph` : '—'}
                  </span>
                  <span className={cn(
                    'text-xs font-semibold tabular-nums w-12 text-right',
                    barrelNum >= 15 ? 'text-red-400' : barrelNum >= 10 ? 'text-amber-400' : 'text-[oklch(0.60_0.01_280)]',
                  )}>
                    {barrelNum ? `${barrelNum.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            );
          })}

          <p className="text-[9px] text-[oklch(0.35_0.01_280)] pt-0.5">
            Source: Baseball Savant · {new Date().getFullYear()} season
          </p>
        </div>
      ) : (
        /* ── Standard FAAB / waiver wire layout ── */
        <div className="space-y-2">
          {targets.slice(0, isHero ? 4 : 3).map((t: any, i: number) => {
            const photoUrl = t.photoUrl ?? getPlayerHeadshotUrl(t.name);
            const isHot    = t.breakoutScore >= 2;
            const isMedium = t.breakoutScore >= 1.5;
            const urgencyBorder = isHot
              ? 'border-red-500/30 bg-red-500/5'
              : isMedium
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-[oklch(0.16_0.015_280)] bg-[oklch(0.08_0.01_280)]';
            return (
              <div key={i} className={cn('px-3 py-2.5 rounded-xl border', urgencyBorder)}>
                <div className="flex items-center gap-2 mb-2">
                  <PlayerAvatar playerName={t.name} photoUrl={photoUrl} sport={avatarSport} size="sm" />
                  <PosBadge pos={t.pos} />
                  <span className="text-xs font-black text-white leading-tight">{t.name}</span>
                  <span className="text-[10px] text-[oklch(0.42_0.01_280)]">{t.team}</span>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {isHot && (
                      <span className="flex items-center gap-0.5 text-[8px] font-black uppercase text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                        <Flame className="w-2.5 h-2.5" /> ADD NOW
                      </span>
                    )}
                    {t.rostered != null && (
                      <span className="text-[9px] text-[oklch(0.40_0.01_280)]">{t.rostered}% owned</span>
                    )}
                  </div>
                </div>
                {t.faabBid != null && t.faabBid > 0 && (
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-[9px] font-bold text-[oklch(0.42_0.01_280)]">FAAB</span>
                    <span className="text-base font-black text-teal-400 tabular-nums">${t.faabBid}</span>
                    {t.faabPct != null && (
                      <span className="text-[9px] text-[oklch(0.38_0.01_280)]">({t.faabPct}%)</span>
                    )}
                  </div>
                )}
                {t.breakoutScore != null && (
                  <div className="mb-1.5">
                    <BreakoutBar score={t.breakoutScore} />
                  </div>
                )}
                {t.reason && (
                  <p className="text-[10px] text-[oklch(0.48_0.01_280)] leading-relaxed">{t.reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {budgetNote && (
        <p className="text-[9px] text-[oklch(0.35_0.01_280)] pt-0.5">{budgetNote}</p>
      )}
    </Shell>
  );
});
