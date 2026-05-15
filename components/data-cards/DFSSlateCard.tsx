'use client';

import { memo } from 'react';
import { ChevronRight, TrendingUp, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardsEmptyState, CardsErrorState } from './CardStates';

interface SlatePlayer {
  position: string;
  player: string;
  team: string;
  salary: string;
  projection: string;
  ownership: string;
  dkValue: string;
  stackTeam?: string;
  isPlaying?: boolean;
  matchupScore?: number | string;
  hrProb?: string;
  confirmedStarter?: boolean;
  availabilityReason?: string;
  cardCategory?: string;
  boomCeiling?: number | string;
  bustFloor?: number | string;
}

interface DFSSlateCardProps {
  title: string;
  data: Record<string, any>;
  onAnalyze?: () => void;
  isHero?: boolean;
}

const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SP:   { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/35' },
  RP:   { bg: 'bg-sky-500/20',    text: 'text-sky-300',    border: 'border-sky-500/35' },
  C:    { bg: 'bg-teal-500/20',   text: 'text-teal-300',   border: 'border-teal-500/35' },
  '1B': { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  '2B': { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  '3B': { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  SS:   { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  OF:   { bg: 'bg-amber-500/20',  text: 'text-amber-300',  border: 'border-amber-500/35' },
  UTIL: { bg: 'bg-slate-500/20',  text: 'text-slate-300',  border: 'border-slate-500/35' },
  P:    { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/35' },
  QB:   { bg: 'bg-red-500/20',    text: 'text-red-300',    border: 'border-red-500/35' },
  RB:   { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/35' },
  WR:   { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/35' },
  TE:   { bg: 'bg-pink-500/20',   text: 'text-pink-300',   border: 'border-pink-500/35' },
  K:    { bg: 'bg-gray-500/20',   text: 'text-gray-300',   border: 'border-gray-500/35' },
  DST:  { bg: 'bg-slate-500/20',  text: 'text-slate-300',  border: 'border-slate-500/35' },
  FLEX: { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/35' },
};

function PositionBadge({ position }: { position: string }) {
  const colors = POS_COLORS[position] ?? { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/35' };
  return (
    <span className={cn('inline-flex items-center justify-center rounded-lg border font-black text-[9px] uppercase px-1.5 py-0.5 min-w-[30px] shrink-0', colors.bg, colors.text, colors.border)}>
      {position}
    </span>
  );
}

/** pts/$1K grade — 5.5=A, 4.5=B, 3.5=C, <3.5=D */
function ValueGrade({ score }: { score: number }) {
  const grade = score >= 5.5 ? 'A' : score >= 4.5 ? 'B' : score >= 3.5 ? 'C' : 'D';
  const cls   = grade === 'A' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35'
              : grade === 'B' ? 'text-blue-300 bg-blue-500/15 border-blue-500/35'
              : grade === 'C' ? 'text-amber-300 bg-amber-500/15 border-amber-500/35'
              :                 'text-red-300 bg-red-500/15 border-red-500/35';
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-lg border font-black text-[10px] shrink-0', cls)}>
      {grade}
    </span>
  );
}

/** Salary cap progress bar */
function CapBar({ used, cap = 50000 }: { used: number; cap?: number }) {
  const pct = Math.min(100, (used / cap) * 100);
  const barCls = pct < 90 ? 'from-emerald-500 to-teal-400'
               : pct < 98 ? 'from-amber-500 to-yellow-400'
               :             'from-red-500 to-rose-400';
  const lblCls = pct < 90 ? 'text-emerald-400' : pct < 98 ? 'text-amber-400' : 'text-red-400';
  const capStr = cap === 50000 ? '$50K' : `$${(cap / 1000).toFixed(0)}K`;
  const usedStr = used >= 1000 ? `$${(used / 1000).toFixed(1)}K` : `$${used}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Salary Cap</span>
        <span className={cn('text-[11px] font-black tabular-nums', lblCls)}>{usedStr} / {capStr}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
        <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', barCls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const DFSSlateCard = memo(function DFSSlateCard({ title, data, onAnalyze, isHero = false }: DFSSlateCardProps) {
  const rawSlate: SlatePlayer[] = Array.isArray(data.slate) ? data.slate : [];
  const slate = rawSlate.filter(p => p.isPlaying !== false);

  if (data.error) return <CardsErrorState message={String(data.error)} />;
  if (!Array.isArray(data.slate)) return <CardsEmptyState message="DFS slate is still loading. Try again in a moment." />;

  const totalSalary   = data.totalSalary ?? '—';
  const totalProjPts  = data.totalProjPts ?? '—';
  const topStack      = data.topStack as string | undefined;
  const capValid      = data.capValid !== false;
  const site          = (data.site as string | undefined)?.toUpperCase() ?? 'DK';
  const slateLabel    = data.slateLabel as string | undefined;

  // Parse numeric salary for cap bar
  const salaryNum = typeof totalSalary === 'string'
    ? parseFloat(totalSalary.replace(/[^0-9.]/g, ''))
    : typeof totalSalary === 'number' ? totalSalary : 0;

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
      isHero
        ? 'border-[var(--border-hover)] shadow-[0_0_32px_oklch(0.72_0.20_80/0.15)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_24px_oklch(0.72_0.20_80/0.12)]',
    )}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 via-amber-900/5 to-transparent border-b border-[var(--border-subtle)]">
        <div className="absolute top-0 right-0 w-40 h-20 bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/5 rounded-bl-full blur-3xl pointer-events-none" />

        {/* Breadcrumb + platform badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-white/60">
            <Users className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">DFS</span>
            <span className="text-white/30">·</span>
            <span className="text-[9px]">Optimal Lineup</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/15 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 text-[var(--cat-dfs,oklch(0.72_0.20_80))] text-[9px] font-black uppercase tracking-wider">
            {site}
          </span>
        </div>

        <h3 className={cn('font-black text-white leading-snug', isHero ? 'text-lg' : 'text-sm')}>{title}</h3>

        {/* Hero stats row */}
        <div className="mt-2.5 flex flex-wrap gap-2 items-center">
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-wider text-[var(--cat-dfs,oklch(0.72_0.20_80))]/70">Salary Used</span>
            <span className="text-lg font-black text-[var(--cat-dfs,oklch(0.72_0.20_80))] tabular-nums leading-tight">{totalSalary}</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400/70">Proj Pts</span>
            <span className="text-lg font-black text-emerald-400 tabular-nums leading-tight">{totalProjPts}</span>
          </div>
          {topStack && (
            <>
              <div className="w-px h-8 bg-white/10" />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-black">
                Stack: {topStack}
              </span>
            </>
          )}
          {slateLabel && (
            <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
              {slateLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── Cap bar ─────────────────────────────────────────────────────── */}
      {salaryNum > 0 && (
        <div className="px-4 pt-3 pb-0">
          <CapBar used={salaryNum} />
        </div>
      )}

      {/* ── Column headers ──────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1 grid grid-cols-[32px,1fr,64px,48px,36px] gap-2 text-[8px] font-black uppercase tracking-wider text-[var(--text-faint)]">
        <span />
        <span>Player</span>
        <span className="text-right">Salary</span>
        <span className="text-right">Proj</span>
        <span className="text-right">Val</span>
      </div>

      {/* ── Roster rows ─────────────────────────────────────────────────── */}
      {slate.length === 0 ? (
        <div className="px-4 pb-4"><CardsEmptyState message="No playable DFS lineup available for this slate yet." /></div>
      ) : (
        <div className="pb-1 divide-y divide-[var(--border-subtle)]/40">
          {slate.map((p, i) => {
            const ownNum     = parseFloat(p.ownership)   || 0;
            const dkValNum   = parseFloat(p.dkValue)     || 0;
            const matchupNum = p.matchupScore != null ? parseFloat(String(p.matchupScore)) : null;
            const isStacked  = Boolean(p.stackTeam);

            return (
              <div
                key={`${p.player}-${i}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 transition-colors',
                  isStacked
                    ? 'border-l-2 border-l-indigo-400 bg-indigo-500/5'
                    : i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-elevated)]/30',
                )}
              >
                <PositionBadge position={p.position} />

                {/* Name + team + ownership bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-white text-[12px] truncate">{p.player}</span>
                    <span className="text-[10px] font-bold text-white/40 shrink-0">{p.team}</span>
                    {p.confirmedStarter && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400" title="Confirmed starter" />
                    )}
                    {isStacked && (
                      <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-[8px] font-black text-indigo-300 uppercase tracking-wide">
                        STK
                      </span>
                    )}
                  </div>
                  {/* Ownership mini-bar */}
                  <div className="mt-1 h-[3px] rounded-full bg-[var(--bg-elevated)] max-w-[80px] overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        ownNum >= 35 ? 'bg-red-400' : ownNum >= 20 ? 'bg-amber-400' : ownNum >= 10 ? 'bg-blue-400' : 'bg-emerald-400'
                      )}
                      style={{ width: `${Math.min(100, ownNum)}%` }}
                    />
                  </div>
                  {ownNum > 0 && (
                    <span className="text-[8px] text-[var(--text-faint)] tabular-nums">{ownNum.toFixed(0)}% own</span>
                  )}
                </div>

                {/* Salary */}
                <span className="text-[11px] font-black text-[var(--cat-dfs,oklch(0.72_0.20_80))] tabular-nums w-16 text-right">{p.salary}</span>

                {/* Projection */}
                <span className="text-[11px] font-black text-emerald-400 tabular-nums w-12 text-right">{p.projection}</span>

                {/* Matchup dot */}
                {matchupNum !== null && !isNaN(matchupNum) && (
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      matchupNum >= 70 ? 'bg-emerald-400' : matchupNum >= 50 ? 'bg-amber-400' : 'bg-red-400',
                    )}
                    title={`Matchup: ${Math.round(matchupNum)}/100`}
                  />
                )}

                {/* Value grade */}
                <div className="w-9 flex justify-end">
                  <ValueGrade score={dkValNum} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mx-3 mb-3 mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 flex items-center justify-between text-[10px]">
        <span className="text-[var(--text-muted)]">Cap Status</span>
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full', capValid ? 'bg-emerald-400' : 'bg-red-400')} />
          <span className={cn('font-black', capValid ? 'text-emerald-400' : 'text-red-400')}>{capValid ? 'Valid' : 'Over Cap'}</span>
        </div>
      </div>

      {onAnalyze && (
        <div className="px-4 pb-4">
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 to-amber-600/20 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 text-xs font-bold text-[var(--cat-dfs,oklch(0.72_0.20_80))] hover:from-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 hover:text-white hover:border-[var(--cat-dfs,oklch(0.72_0.20_80))]/50 transition-all duration-150"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            View Full DFS Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </article>
  );
});
