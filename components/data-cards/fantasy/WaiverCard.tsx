'use client';

import { memo } from 'react';
import { Zap, Flame, TrendingUp } from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Shell, PosBadge, type FantasyCardProps } from './shared';

/** Visual breakout score bar (0–3σ scale) */
function BreakoutBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 3) * 100);
  const isHot    = score >= 2;
  const isMedium = score >= 1.5;
  const barCls = isHot    ? 'bg-gradient-to-r from-red-500 to-rose-400'
    : isMedium             ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
    :                        'bg-gradient-to-r from-orange-500 to-amber-400';
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

export const WaiverCard = memo(function WaiverCard({ data, isHero, ...p }: FantasyCardProps) {
  const { targets = [], description, budgetNote, sport } = data;
  const avatarSport = sport?.toLowerCase() || p.category?.toLowerCase();

  return (
    <Shell {...p} isHero={isHero} status="hot" Icon={Zap}>
      {description && (
        <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{description}</p>
      )}
      <div className="space-y-2">
        {targets.slice(0, isHero ? 4 : 3).map((t: any, i: number) => {
          const photoUrl = t.photoUrl ?? getPlayerHeadshotUrl(t.name);
          const isHot = t.breakoutScore >= 2;
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
              {/* FAAB bid row — hide when bid is 0 (e.g. SP start/sit context) */}
              {t.faabBid != null && t.faabBid > 0 && (
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[9px] font-bold text-[oklch(0.42_0.01_280)]">FAAB</span>
                  <span className="text-base font-black text-teal-400 tabular-nums">${t.faabBid}</span>
                  {t.faabPct != null && (
                    <span className="text-[9px] text-[oklch(0.38_0.01_280)]">({t.faabPct}%)</span>
                  )}
                </div>
              )}
              {/* Breakout score visual bar */}
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
      {budgetNote && (
        <p className="text-[9px] text-[oklch(0.35_0.01_280)] pt-0.5">{budgetNote}</p>
      )}
    </Shell>
  );
});
