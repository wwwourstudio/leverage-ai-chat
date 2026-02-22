'use client';

import { Trophy, Target, Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FantasyCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
}

const statusMap: Record<string, { label: string; dotClass: string; textClass: string }> = {
  target:  { label: 'TARGET',  dotClass: 'bg-teal-400',    textClass: 'text-teal-400' },
  value:   { label: 'VALUE',   dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
  sleeper: { label: 'SLEEPER', dotClass: 'bg-indigo-400',  textClass: 'text-indigo-400' },
  hot:     { label: 'HOT',     dotClass: 'bg-red-400',     textClass: 'text-red-400' },
};

export function FantasyCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
}: FantasyCardProps) {
  const badge = statusMap[status] || statusMap.value;
  const { focus, targetPlayers, targetPosition, description, tips, platforms, projectedPoints, adpValue, rosterPct, ...rest } = data;

  const statItems = [
    projectedPoints && { label: 'Proj Pts', value: projectedPoints },
    adpValue && { label: 'ADP', value: adpValue },
    rosterPct && { label: 'Roster%', value: rosterPct },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)] transition-all duration-200">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-[oklch(0.55_0.01_280)] shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
            <span className="text-[oklch(0.3_0.01_280)]" aria-hidden="true">/</span>
            <span className="text-[11px] font-medium text-[oklch(0.45_0.01_280)] truncate">{subcategory}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" role="status">
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', badge.dotClass)} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', badge.textClass)}>{badge.label}</span>
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-[oklch(0.95_0.005_85)] leading-snug text-balance mb-1">{title}</h3>

        {(focus || description) && (
          <p className="text-sm text-[oklch(0.55_0.01_280)] leading-relaxed mb-3">{focus || description}</p>
        )}

        {/* Stats */}
        {statItems.length > 0 && (
          <div className="mt-3 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] overflow-hidden">
            <div className={cn('grid divide-x divide-[oklch(0.20_0.015_280)]', statItems.length <= 2 ? 'grid-cols-2' : 'grid-cols-3')}>
              {statItems.map(s => (
                <div key={s.label} className="flex flex-col items-center justify-center gap-0.5 px-2 py-3 text-center min-w-0">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[oklch(0.45_0.01_280)]">{s.label}</span>
                  <span className="text-base font-bold tabular-nums text-[oklch(0.92_0.005_85)]">{String(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-xs">
          {targetPlayers && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.16_0.02_280)] text-[11px] font-medium text-[oklch(0.60_0.01_280)]">
              <Users className="w-3 h-3" />
              {targetPlayers}
            </span>
          )}
          {targetPosition && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.16_0.02_280)] text-[11px] font-medium text-[oklch(0.60_0.01_280)]">
              <Target className="w-3 h-3" />
              {targetPosition}
            </span>
          )}
          {platforms && (
            <span className="px-2 py-0.5 rounded-md bg-[oklch(0.16_0.02_280)] text-[11px] font-medium text-[oklch(0.60_0.01_280)]">
              {Array.isArray(platforms) ? platforms.join(', ') : platforms}
            </span>
          )}
        </div>

        {tips && (
          <p className="mt-3 text-xs text-[oklch(0.50_0.01_280)] leading-relaxed">
            {Array.isArray(tips) ? tips.join(' -- ') : tips}
          </p>
        )}

        {/* Remaining data */}
        {Object.keys(rest).filter(k => !['realData', 'status'].includes(k)).length > 0 && (
          <div className="mt-3 space-y-1.5">
            {Object.entries(rest)
              .filter(([k]) => !['realData', 'status'].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[oklch(0.10_0.01_280)]">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[oklch(0.45_0.01_280)]">
                    {k.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-sm font-bold text-[oklch(0.85_0.005_85)] tabular-nums">{String(v || 'N/A')}</span>
                </div>
              ))}
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
            aria-label={`Analyze ${title}`}
          >
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
