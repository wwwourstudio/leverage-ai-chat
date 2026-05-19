'use client';

import { memo } from 'react';
import { Trophy, Zap, ChevronRight, Sparkles } from 'lucide-react';
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
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
      isHero
        ? 'border-[var(--border-hover)] shadow-[var(--shadow-glow)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)]',
    )}>
      {/* Fantasy accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500/60 via-purple-400/80 to-violet-500/60" />

      {/* Gradient header — violet/purple fantasy theme */}
      <div className="relative px-4 pt-4 pb-3.5 bg-gradient-to-br dark:from-violet-900/30 dark:via-purple-900/15 to-transparent">
        {/* Status pill */}
        <div
          className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-[var(--bg-overlay)]/60"
          style={{ borderColor: `${cfg.dot}40` }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: cfg.dot }} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.text)}>{cfg.label}</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy className="w-3.5 h-3.5 text-violet-400/80" />
          <span className="text-[9px] font-black uppercase tracking-widest text-violet-300/80">{category}</span>
          <span className="text-violet-400/30 text-[10px]">/</span>
          <span className="text-[9px] text-purple-300/50 truncate">{subcategory}</span>
        </div>

        <h3 className={cn('font-black text-white leading-snug pr-20', isHero ? 'text-lg' : 'text-sm')}>{title}</h3>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {(focus || description) && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{focus || description}</p>
        )}

        {/* Stats grid — data tiles */}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {stats.map((s2, i) => {
              const accentCls = i === 0 ? 'text-violet-300' : i === 1 ? 'text-purple-300' : 'text-blue-300';
              return (
                <div key={s2.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5 text-center">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{s2.label}</span>
                  <span className={cn('text-sm font-black tabular-nums', accentCls)}>{String(s2.val)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Tips callout */}
        {tips && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-violet-500/8 border border-violet-500/20">
            <Zap className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {Array.isArray(tips) ? tips.join(' · ') : String(tips)}
            </p>
          </div>
        )}

        {/* Meta chips */}
        {(targetPlayers || platforms) && (
          <div className="flex flex-wrap gap-1.5">
            {targetPlayers && (
              <span className="px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-violet-500/20 text-[10px] text-violet-300/80">
                {targetPlayers}
              </span>
            )}
            {platforms && (
              <span className="px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-purple-500/20 text-[10px] text-purple-300/80">
                {Array.isArray(platforms) ? platforms.join(', ') : String(platforms)}
              </span>
            )}
          </div>
        )}

        {/* Analyze CTA */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="group/btn flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-violet-500/8 border border-violet-500/20 text-xs font-semibold text-violet-300/70 hover:text-violet-200 hover:bg-violet-500/15 hover:border-violet-400/40 transition-all duration-200"
          >
            <Sparkles className="w-3.5 h-3.5" />
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform duration-150" />
          </button>
        )}
      </div>
    </article>
  );
});
