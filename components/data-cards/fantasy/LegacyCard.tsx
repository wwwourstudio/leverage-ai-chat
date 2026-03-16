'use client';

import { memo } from 'react';
import { Trophy, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_BADGE_CONFIG, type StatusBadgeKey } from '@/lib/constants';
import type { FantasyCardProps } from './shared';

export const LegacyCard = memo(function LegacyCard({ title, category, subcategory, data, status, onAnalyze, isHero }: FantasyCardProps) {
  const { focus, description, tips, projectedPoints, adpValue, rosterPct, targetPlayers, platforms } = data;
  const stats = [
    projectedPoints && { label: 'Proj Pts', val: projectedPoints },
    adpValue        && { label: 'ADP',      val: adpValue },
    rosterPct       && { label: 'Roster%',  val: rosterPct },
  ].filter(Boolean) as { label: string; val: string }[];

  const cfg = STATUS_BADGE_CONFIG[status as StatusBadgeKey] ?? STATUS_BADGE_CONFIG.value;

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero ? 'border-[oklch(0.28_0.025_260)]' : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)]',
    )}>
      {/* Gradient header */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', cfg.headerGrad)}>
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.dot }} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.text)}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Trophy className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50">{subcategory}</span>
        </div>
        <h3 className={cn('font-black text-white leading-snug pr-16', isHero ? 'text-lg' : 'text-sm')}>{title}</h3>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {(focus || description) && (
          <p className="text-xs text-[oklch(0.52_0.01_280)] leading-relaxed">{focus || description}</p>
        )}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {stats.map(s2 => (
              <div key={s2.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">{s2.label}</span>
                <span className="text-sm font-black text-white tabular-nums">{String(s2.val)}</span>
              </div>
            ))}
          </div>
        )}
        {tips && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)]">
            <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[oklch(0.55_0.01_280)] leading-relaxed">
              {Array.isArray(tips) ? tips.join(' · ') : String(tips)}
            </p>
          </div>
        )}
        {(targetPlayers || platforms) && (
          <div className="flex flex-wrap gap-1.5">
            {targetPlayers && (
              <span className="px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] text-[oklch(0.55_0.01_280)]">
                {targetPlayers}
              </span>
            )}
            {platforms && (
              <span className="px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] text-[oklch(0.55_0.01_280)]">
                {Array.isArray(platforms) ? platforms.join(', ') : String(platforms)}
              </span>
            )}
          </div>
        )}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
          >
            View Full Analysis <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
});
