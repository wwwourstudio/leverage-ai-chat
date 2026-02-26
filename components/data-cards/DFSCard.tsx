'use client';

import { Award, Users, Gamepad2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DFSCardProps {
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
  isHero?: boolean;
}

const statusMap: Record<string, { label: string; dotClass: string; textClass: string }> = {
  optimal: { label: 'OPTIMAL', dotClass: 'bg-sky-400',     textClass: 'text-sky-400' },
  value:   { label: 'VALUE',   dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
  elite:   { label: 'ELITE',   dotClass: 'bg-purple-400',  textClass: 'text-purple-400' },
  hot:     { label: 'HOT',     dotClass: 'bg-red-400',     textClass: 'text-red-400' },
};

export function DFSCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isHero = false,
}: DFSCardProps) {
  const badge = statusMap[status] || statusMap.value;
  const { focus, targetGame, targetPlayers, description, platforms, tips, salary, projection, ownership, value: dfsValue, boomCeiling, bustFloor, ...rest } = data;

  // Compute salary efficiency (value score) as proj/salary*1000 if possible
  const projNum = parseFloat(String(projection || '').replace(/[^0-9.]/g, ''));
  const salaryNum = parseFloat(String(salary || '').replace(/[^0-9.]/g, ''));
  const valueScore = projNum > 0 && salaryNum > 0
    ? (projNum / (salaryNum / 1000)).toFixed(2)
    : (dfsValue ? String(dfsValue) : null);

  const statItems = [
    salary && { label: 'Salary', value: salary },
    projection && { label: 'Proj', value: projection },
    ownership && { label: 'Own%', value: ownership },
    valueScore && { label: 'Value', value: valueScore },
    boomCeiling && { label: 'Ceiling', value: boomCeiling },
    bustFloor && { label: 'Floor', value: bustFloor },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.12_0.02_280)] border transition-all duration-200 animate-fade-in-up',
      isHero
        ? 'border-[oklch(0.26_0.025_260)] shadow-[0_0_20px_oklch(0.3_0.08_260/0.12)]'
        : 'border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)]',
    )}>
      {/* Diagonal corner accent */}
      <div className={cn('absolute right-0 top-0 w-16 h-16 bg-gradient-to-bl opacity-[0.07]', gradient)} aria-hidden="true" />
      <div className={cn('absolute left-0 bottom-0 top-0 bg-gradient-to-b', isHero ? 'w-[3px]' : 'w-0.5', gradient)} aria-hidden="true" />

      <div className={cn('px-4 py-4 relative', isHero ? 'sm:px-6 sm:py-5' : 'sm:px-5 sm:py-5')}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md bg-[oklch(0.18_0.02_280)] flex items-center justify-center shrink-0">
              <Gamepad2 className="w-3 h-3 text-[oklch(0.60_0.01_280)]" aria-hidden="true" />
            </div>
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

        {/* Stat cards */}
        {statItems.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {statItems.map(s => (
              <div key={s.label} className="flex-1 min-w-[70px] rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.18_0.015_280)] px-3 py-2.5 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-widest text-[oklch(0.45_0.01_280)] mb-0.5">{s.label}</span>
                <span className="block text-base font-black tabular-nums text-[oklch(0.92_0.005_85)]">{String(s.value)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Info sections */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-xs">
          {targetGame && <Chip icon={<Award className="w-3 h-3" />}>{targetGame}</Chip>}
          {targetPlayers && <Chip icon={<Users className="w-3 h-3" />}>{targetPlayers}</Chip>}
          {platforms && (
            <Chip>{Array.isArray(platforms) ? platforms.join(', ') : platforms}</Chip>
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
            className="flex items-center justify-center gap-1.5 w-full mt-4 py-2.5 rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] hover:bg-[oklch(0.14_0.01_280)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function Chip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.16_0.02_280)] text-[11px] font-medium text-[oklch(0.60_0.01_280)]">
      {icon}
      {children}
    </span>
  );
}
