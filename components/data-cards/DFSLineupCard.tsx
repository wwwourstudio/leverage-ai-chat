'use client';

import { ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DFSProjection {
  player_name: string;
  player_type: string;
  dk_pts_mean: number;
  salary?: string | number;
  matchup_score?: number;
  p10?: number;
  p50?: number;
  p90?: number;
  park_factor?: number;
  weather_adj?: number;
}

interface DFSLineupCardProps {
  lineup: DFSProjection[];
  totalProjected?: number;
  site?: string;
  onAsk?: (query: string) => void;
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
  FLEX: { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/35' },
  QB:   { bg: 'bg-red-500/20',    text: 'text-red-300',    border: 'border-red-500/35' },
  RB:   { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/35' },
  WR:   { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/35' },
  TE:   { bg: 'bg-pink-500/20',   text: 'text-pink-300',   border: 'border-pink-500/35' },
  K:    { bg: 'bg-gray-500/20',   text: 'text-gray-300',   border: 'border-gray-500/35' },
  DST:  { bg: 'bg-slate-500/20',  text: 'text-slate-300',  border: 'border-slate-500/35' },
};

function PositionBubble({ position }: { position: string }) {
  const pos    = position.toUpperCase();
  const colors = POS_COLORS[pos] ?? { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/35' };
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-8 h-8 rounded-lg border font-black text-[9px] uppercase shrink-0',
      colors.bg, colors.text, colors.border,
    )}>
      {pos.length > 4 ? pos.slice(0, 4) : pos}
    </span>
  );
}

/** Matchup score dot chip */
function MatchupDot({ score }: { score: number }) {
  const cls  = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const tip  = score >= 70 ? 'GREAT' : score >= 50 ? 'OK' : 'TOUGH';
  const txt  = score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/20 border border-white/10 text-[8px] font-black uppercase tracking-wide shrink-0', txt)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cls)} />
      {tip}
    </span>
  );
}

/**
 * p10/p50/p90 range track.
 * Shows a gradient bar from floor to ceil with a marker at the median.
 */
function RangeTrack({ p10, p50, p90, mean }: { p10: number; p50: number; p90: number; mean: number }) {
  const range   = p90 - p10;
  if (range <= 0) return null;
  const medPct  = Math.min(100, ((p50 - p10) / range) * 100);
  const meanPct = Math.min(100, ((mean - p10) / range) * 100);

  return (
    <div className="space-y-0.5 min-w-0 flex-1">
      <div className="relative h-1.5 rounded-full overflow-visible" style={{ maxWidth: '110px' }}>
        {/* Track gradient */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 via-amber-400/20 to-emerald-500/30" />
        {/* Median marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-[var(--cat-dfs,oklch(0.72_0.20_80))] shadow-[0_0_4px_oklch(0.72_0.20_80/0.6)]"
          style={{ left: `calc(${medPct}% - 4px)` }}
        />
      </div>
      <div className="flex items-center justify-between" style={{ maxWidth: '110px' }}>
        <span className="text-[7px] text-red-400 tabular-nums">{p10.toFixed(0)}</span>
        <span className="text-[7px] text-[var(--text-faint)] tabular-nums">{p50.toFixed(0)}</span>
        <span className="text-[7px] text-emerald-400 tabular-nums">{p90.toFixed(0)}</span>
      </div>
    </div>
  );
}

export function DFSLineupCard({ lineup, totalProjected, site = 'DK', onAsk }: DFSLineupCardProps) {
  const total   = totalProjected ?? lineup.reduce((s, p) => s + (p.dk_pts_mean ?? 0), 0);
  const maxPts  = Math.max(...lineup.map(p => p.dk_pts_mean ?? 0), 1);

  // Floor/ceiling sums for footer
  const totalP10 = lineup.some(p => p.p10 != null) ? lineup.reduce((s, p) => s + (p.p10 ?? p.dk_pts_mean ?? 0), 0) : null;
  const totalP90 = lineup.some(p => p.p90 != null) ? lineup.reduce((s, p) => s + (p.p90 ?? p.dk_pts_mean ?? 0), 0) : null;

  // Total salary
  const hasSalary = lineup.some(p => p.salary != null);
  const totalSalaryNum = hasSalary
    ? lineup.reduce((s, p) => s + parseFloat(String(p.salary ?? '0').replace(/[^0-9.]/g, '')), 0)
    : 0;

  const platformLabel = site.toUpperCase();

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_24px_oklch(0.72_0.20_80/0.12)] transition-all duration-300">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 via-amber-900/5 to-transparent border-b border-[var(--border-subtle)]">
        <div className="absolute top-0 right-0 w-40 h-20 bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/5 rounded-bl-full blur-3xl pointer-events-none" />

        {/* Breadcrumb + platform */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-white/60">
            <span className="text-[9px] font-black uppercase tracking-widest">DFS</span>
            <span className="text-white/30">·</span>
            <span className="text-[9px]">Projected Lineup</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/15 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 text-[var(--cat-dfs,oklch(0.72_0.20_80))] text-[9px] font-black uppercase tracking-wider">
            {platformLabel}
          </span>
        </div>

        <h3 className="font-black text-white leading-snug text-sm pr-4">{platformLabel} Projected Lineup</h3>

        {/* Total hero */}
        <div className="flex items-center gap-3 mt-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-white tabular-nums leading-none">{total.toFixed(1)}</span>
            <span className="text-[10px] text-white/50 font-bold">proj pts</span>
          </div>
          {totalP10 !== null && totalP90 !== null && (
            <div className="flex items-center gap-1.5 text-[10px] tabular-nums">
              <span className="text-red-400 font-bold">{totalP10.toFixed(0)}</span>
              <span className="text-[var(--text-faint)]">–</span>
              <span className="text-emerald-400 font-bold">{totalP90.toFixed(0)}</span>
              <span className="text-[var(--text-faint)]">range</span>
            </div>
          )}
          {lineup.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wide">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              {lineup.length} players
            </span>
          )}
        </div>
      </div>

      {/* ── Roster rows ──────────────────────────────────────────────── */}
      <div className="divide-y divide-[var(--border-subtle)]/40">
        {lineup.map((p, i) => {
          const barPct    = Math.min(100, ((p.dk_pts_mean ?? 0) / maxPts) * 100);
          const hasRange  = p.p10 != null && p.p90 != null;
          const hasMatchup = p.matchup_score != null;

          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--bg-elevated)]/50 transition-colors',
                i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-elevated)]/30',
              )}
            >
              {/* Position */}
              <PositionBubble position={p.player_type} />

              {/* Name + range or bar */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <span className="font-black text-white text-[12px] truncate block">{p.player_name}</span>
                {hasRange ? (
                  <RangeTrack p10={p.p10!} p50={p.p50 ?? p.dk_pts_mean} p90={p.p90!} mean={p.dk_pts_mean} />
                ) : (
                  <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden max-w-[100px] mt-1">
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--cat-dfs,oklch(0.72_0.20_80))] to-amber-400 transition-all duration-500" style={{ width: `${barPct}%` }} />
                  </div>
                )}
              </div>

              {/* Matchup chip */}
              {hasMatchup && <MatchupDot score={p.matchup_score!} />}

              {/* Salary */}
              {p.salary != null && (
                <span className="text-[10px] font-bold text-[var(--cat-dfs,oklch(0.72_0.20_80))]/80 tabular-nums shrink-0">
                  {String(p.salary).startsWith('$') ? String(p.salary) : `$${p.salary}`}
                </span>
              )}

              {/* Projected pts */}
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[14px] font-black text-[var(--cat-dfs,oklch(0.72_0.20_80))] tabular-nums leading-none">
                  {(p.dk_pts_mean ?? 0).toFixed(1)}
                </span>
                <span className="text-[8px] text-[var(--text-faint)]">pts</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {lineup.length > 0 && (
        <div className="px-3 pt-3 pb-3 space-y-2.5 border-t border-[var(--border-subtle)]">
          {/* Total row */}
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Total Projected</span>
              {hasSalary && totalSalaryNum > 0 && (
                <span className="text-[9px] font-bold text-[var(--cat-dfs,oklch(0.72_0.20_80))]/80 tabular-nums">
                  ${(totalSalaryNum / 1000).toFixed(1)}K salary
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              {totalP10 !== null && (
                <span className="text-[10px] text-red-400 tabular-nums font-bold">Floor {totalP10.toFixed(1)}</span>
              )}
              <span className="text-xl font-black text-white tabular-nums">{total.toFixed(1)}</span>
              {totalP90 !== null && (
                <span className="text-[10px] text-emerald-400 tabular-nums font-bold">Ceil {totalP90.toFixed(1)}</span>
              )}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/15 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 text-[var(--cat-dfs,oklch(0.72_0.20_80))] text-[9px] font-black uppercase">
                PTS
              </span>
            </div>
          </div>

          {/* CTA */}
          {onAsk && (
            <button
              onClick={() =>
                onAsk(`Evaluate this ${platformLabel} DFS lineup: ${lineup.map(p => p.player_name).join(', ')} — any swaps to improve ceiling or floor?`)
              }
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--cat-dfs,oklch(0.72_0.20_80))]/80 to-amber-500/80 text-black text-[11px] font-black uppercase tracking-wide hover:from-[var(--cat-dfs,oklch(0.72_0.20_80))] hover:to-amber-400 shadow-[0_2px_10px_oklch(0.72_0.20_80/0.35)] hover:shadow-[0_4px_16px_oklch(0.72_0.20_80/0.5)] transition-all duration-200"
            >
              <Zap className="w-3.5 h-3.5" />
              Optimize Lineup
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
