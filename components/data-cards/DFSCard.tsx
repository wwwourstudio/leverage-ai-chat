'use client';

import { Award, Users, Gamepad2, ChevronRight, TrendingUp, Star, Zap } from 'lucide-react';
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

const statusConfig: Record<string, {
  label: string; dotCls: string; textCls: string; bgCls: string; headerGrad: string;
}> = {
  optimal: {
    label: 'OPTIMAL',
    dotCls: 'bg-sky-400',
    textCls: 'text-sky-400',
    bgCls: 'bg-sky-500/15 border-sky-500/30',
    headerGrad: 'from-sky-600/75 via-blue-700/55 to-sky-900/35',
  },
  value: {
    label: 'VALUE',
    dotCls: 'bg-emerald-400',
    textCls: 'text-emerald-400',
    bgCls: 'bg-emerald-500/15 border-emerald-500/30',
    headerGrad: 'from-emerald-600/75 via-teal-700/55 to-emerald-900/35',
  },
  elite: {
    label: 'ELITE',
    dotCls: 'bg-purple-400',
    textCls: 'text-purple-400',
    bgCls: 'bg-purple-500/15 border-purple-500/30',
    headerGrad: 'from-purple-600/75 via-violet-700/55 to-purple-900/35',
  },
  hot: {
    label: 'HOT',
    dotCls: 'bg-red-400',
    textCls: 'text-red-400',
    bgCls: 'bg-red-500/15 border-red-500/30',
    headerGrad: 'from-red-600/75 via-rose-700/55 to-red-900/35',
  },
};

/** Salary efficiency visual bar */
function ValueMeter({ score, maxScore = 5 }: { score: number; maxScore?: number }) {
  const pct = Math.min(100, (score / maxScore) * 100);
  const color = pct >= 80 ? 'from-emerald-500 to-green-400'
    : pct >= 60 ? 'from-blue-500 to-cyan-400'
    : pct >= 40 ? 'from-amber-500 to-yellow-400'
    : 'from-red-500 to-orange-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-semibold text-[oklch(0.40_0.01_280)]">
        <span>Salary Efficiency</span>
        <span className="font-black text-white tabular-nums">{score.toFixed(2)}×</span>
      </div>
      <div className="h-2.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden relative">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Ownership tier badge */
function OwnershipBadge({ pct }: { pct: number }) {
  const tier = pct >= 35 ? { label: 'CHALKY', cls: 'text-red-400 bg-red-500/10 border-red-500/25' }
    : pct >= 20 ? { label: 'POPULAR', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' }
    : pct >= 10 ? { label: 'MODERATE', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/25' }
    : { label: 'LEVERAGE', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider', tier.cls)}>
      <Star className="w-2.5 h-2.5" />
      {tier.label}
    </span>
  );
}

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
  const cfg = statusConfig[status] || statusConfig.value;

  const {
    focus, targetGame, targetPlayers, description,
    platforms, tips, salary, projection, ownership,
    value: dfsValue, boomCeiling, bustFloor, ...rest
  } = data;

  const projNum = parseFloat(String(projection || '').replace(/[^0-9.]/g, ''));
  const salaryNum = parseFloat(String(salary || '').replace(/[^0-9.]/g, ''));
  const ownershipNum = parseFloat(String(ownership || '').replace(/[^0-9.]/g, ''));
  const valueScore = projNum > 0 && salaryNum > 0
    ? projNum / (salaryNum / 1000)
    : null;

  const extraKeys = Object.keys(rest).filter(k =>
    !['realData', 'status', 'sport', 'insight', 'source'].includes(k) && rest[k] != null
  );

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero
        ? 'border-[oklch(0.28_0.025_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
    )}>

      {/* ── Gradient header ──────────────────────────────────────────── */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', cfg.headerGrad)}>
        {/* Status badge top-right */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', cfg.dotCls)} />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.textCls)}>{cfg.label}</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Gamepad2 className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{category}</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50 truncate">{subcategory}</span>
        </div>

        <h3 className={cn('font-black text-white leading-snug text-balance pr-16', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>

        {(focus || description) && (
          <p className="text-[11px] text-white/60 mt-1 line-clamp-1">{focus || description}</p>
        )}
      </div>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Core stats row ────────────────────────────────────────── */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {salary && (
            <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2 py-2.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Salary</span>
              <span className="text-sm font-black text-white tabular-nums">{String(salary)}</span>
            </div>
          )}
          {projection && (
            <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2 py-2.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Projection</span>
              <span className="text-sm font-black text-emerald-400 tabular-nums">{String(projection)}</span>
            </div>
          )}
          {ownership && (
            <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2 py-2.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.38_0.01_280)]">Ownership</span>
              <span className="text-sm font-black text-white tabular-nums">{String(ownership)}</span>
            </div>
          )}
        </div>

        {/* ── Value meter ───────────────────────────────────────────── */}
        {valueScore !== null && (
          <div className="rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-3 py-2.5">
            <ValueMeter score={valueScore} />
          </div>
        )}

        {/* ── Ownership risk ────────────────────────────────────────── */}
        {!isNaN(ownershipNum) && ownershipNum > 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)]">
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-[oklch(0.45_0.01_280)]" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.42_0.01_280)]">Ownership Risk</span>
            </div>
            <OwnershipBadge pct={ownershipNum} />
          </div>
        )}

        {/* ── Ceiling / floor ───────────────────────────────────────── */}
        {(boomCeiling || bustFloor) && (
          <div className="grid grid-cols-2 gap-1.5">
            {boomCeiling && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-2 py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400/70">Ceiling</span>
                <span className="text-sm font-black text-emerald-400 tabular-nums">{String(boomCeiling)}</span>
              </div>
            )}
            {bustFloor && (
              <div className="flex flex-col items-center gap-0.5 rounded-xl bg-red-500/8 border border-red-500/20 px-2 py-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-red-400/70">Floor</span>
                <span className="text-sm font-black text-red-400 tabular-nums">{String(bustFloor)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Game / player context chips ───────────────────────────── */}
        {(targetGame || targetPlayers || platforms) && (
          <div className="flex flex-wrap gap-1.5">
            {targetGame && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] font-medium text-[oklch(0.58_0.01_280)]">
                <Award className="w-2.5 h-2.5" />{targetGame}
              </span>
            )}
            {targetPlayers && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] font-medium text-[oklch(0.58_0.01_280)]">
                <Users className="w-2.5 h-2.5" />{targetPlayers}
              </span>
            )}
            {platforms && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] font-medium text-[oklch(0.58_0.01_280)]">
                {Array.isArray(platforms) ? platforms.join(', ') : String(platforms)}
              </span>
            )}
          </div>
        )}

        {/* ── Tips ─────────────────────────────────────────────────── */}
        {tips && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)]">
            <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[oklch(0.58_0.01_280)] leading-relaxed">
              {Array.isArray(tips) ? tips.join(' · ') : String(tips)}
            </p>
          </div>
        )}

        {/* ── Overflow key-value data ───────────────────────────────── */}
        {extraKeys.length > 0 && (
          <div className="space-y-1">
            {extraKeys.map(k => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[oklch(0.08_0.01_280)]">
                <span className="text-[10px] font-semibold text-[oklch(0.42_0.01_280)] uppercase tracking-wide">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-xs font-bold text-white tabular-nums">{String(rest[k])}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
            aria-label={`Analyze ${title}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
