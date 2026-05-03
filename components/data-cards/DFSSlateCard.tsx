'use client';

import { memo } from 'react';
import { Trophy, ChevronRight, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlatePlayer {
  position:     string;
  player:       string;
  team:         string;
  salary:       string;
  projection:   string;
  ownership:    string;
  dkValue:      string;
  matchupScore: string;
  cardCategory: string;
  stackTeam?:   string;
}

interface DFSSlateCardProps {
  title:       string;
  data:        Record<string, any>;
  onAnalyze?:  () => void;
  isHero?:     boolean;
}

/** Letter-grade value badge */
function ValueGrade({ score }: { score: number }) {
  const grade = score >= 5.5 ? 'A' : score >= 4.5 ? 'B' : score >= 3.5 ? 'C' : 'D';
  const color = grade === 'A'
    ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35'
    : grade === 'B'
    ? 'text-blue-300 bg-blue-500/15 border-blue-500/35'
    : grade === 'C'
    ? 'text-amber-300 bg-amber-500/15 border-amber-500/35'
    : 'text-red-300 bg-red-500/15 border-red-500/35';
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-md border font-black text-[10px] shrink-0', color)}>
      {grade}
    </span>
  );
}

export const DFSSlateCard = memo(function DFSSlateCard({
  title,
  data,
  onAnalyze,
  isHero = false,
}: DFSSlateCardProps) {
  const slate: SlatePlayer[] = Array.isArray(data.slate) ? data.slate : [];
  const topStack: string | undefined = data.topStack;
  const totalProjPts: string = data.totalProjPts ?? '—';
  const totalSalary:  string = data.totalSalary  ?? '—';
  const gamesCount:   string = data.gamesCount   ?? '—';
  const capValid:     boolean = data.capValid !== false; // default true if not provided
  const playingTodayCount: number = typeof data.playingTodayCount === 'number' ? data.playingTodayCount : slate.length;

  // Parse total salary as a number for the cap bar
  const totalSalaryNum = parseInt(String(totalSalary).replace(/[^0-9]/g, ''), 10) || 0;
  const totalSalaryFull = totalSalaryNum < 1000 ? totalSalaryNum * 1000 : totalSalaryNum; // handle "$49k" → 49000
  const capPct = Math.min(100, (totalSalaryFull / 50000) * 100);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-overlay)] border transition-all duration-300',
      isHero
        ? 'border-[var(--border-hover)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
    )}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-3.5 pb-3 bg-gradient-to-br from-orange-600/75 via-red-700/55 to-orange-900/35">
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400/80">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            REAL
          </span>
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Users className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">MLB</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50">DraftKings Optimal</span>
        </div>
        <h3 className={cn('font-black text-white leading-snug pr-20', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>
        {/* Summary row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {totalSalary !== '—' && (
            <span className="text-[10px] font-bold text-amber-400 tabular-nums">{totalSalary} used</span>
          )}
          {totalProjPts !== '—' && (
            <span className="text-[10px] font-bold text-emerald-400 tabular-nums">{totalProjPts} proj pts</span>
          )}
          {gamesCount !== '—' && (
            <span className="text-[9px] text-white/50">{gamesCount} games</span>
          )}
        </div>
        {/* Stack callout */}
        {topStack && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-black text-indigo-300 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            {topStack}
          </div>
        )}
      </div>

      {/* ── Lineup rows ────────────────────────────────────────────────── */}
      <div className="pb-4">
        {slate.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-[var(--text-faint)]">
            Lineup data unavailable
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {slate.map((p, i) => {
              const isPitcher = p.position === 'SP' || p.position === 'RP';
              const dkValNum  = parseFloat(p.dkValue) || 0;
              const isStack   = Boolean(p.stackTeam);

              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2',
                    i % 2 === 0 ? 'bg-[var(--bg-overlay)]' : 'bg-transparent',
                  )}
                >
                  {/* Position pill */}
                  <span className={cn(
                    'shrink-0 inline-flex items-center justify-center rounded-md font-black text-[9px] uppercase px-1.5 py-0.5 min-w-[28px]',
                    isPitcher
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                      : 'bg-blue-500/15 border border-blue-500/30 text-blue-300',
                  )}>
                    {p.position}
                  </span>

                  {/* Player name + team */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-white text-[12px] truncate">{p.player}</span>
                      <span className="text-[10px] font-bold text-white/40 shrink-0">{p.team}</span>
                      {isStack && (
                        <span className="text-[8px] font-black px-1 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 uppercase tracking-wide shrink-0">
                          STK
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-black text-amber-400 tabular-nums">{p.salary}</span>
                    <span className="text-[12px] font-black text-emerald-400 tabular-nums w-10 text-right">{p.projection}</span>
                    <span className="text-[10px] text-white/40 tabular-nums w-8 text-right">{p.ownership}</span>
                    <ValueGrade score={dkValNum} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Column header (shown only when slate has data) */}
        {slate.length > 0 && (
          <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-t border-[var(--border-subtle)]">
            <span className="flex-1 text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Player</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)] text-right">Sal · Proj · Own · Val</span>
          </div>
        )}

        {/* ── Cap status bar ──────────────────────────────────────────── */}
        {slate.length > 0 && totalSalary !== '—' && (
          <div className="mx-3 mb-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Salary Cap
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tabular-nums text-amber-400">
                  {totalSalary} / $50k
                </span>
                <span className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider',
                  capValid
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/25 text-red-400',
                )}>
                  {capValid ? '✓ CAP VALID' : '✗ OVER CAP'}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  capValid ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-red-500 to-rose-400'
                )}
                style={{ width: `${capPct}%` }}
              />
            </div>
            {playingTodayCount > 0 && playingTodayCount < slate.length && (
              <div className="text-[9px] text-amber-400 font-bold">
                {playingTodayCount}/{slate.length} players confirmed playing today
              </div>
            )}
            {playingTodayCount === slate.length && slate.length > 0 && (
              <div className="text-[9px] text-emerald-400 font-bold">
                All {slate.length} players playing today ✓
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {onAnalyze && (
          <div className="px-4 pt-2">
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] transition-all duration-150"
              aria-label="View full DFS analysis"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              View Full Analysis
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
