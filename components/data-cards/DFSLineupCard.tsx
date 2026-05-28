'use client';

import { useState } from 'react';
import { Zap, TrendingUp, DollarSign, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerDetailModal } from './PlayerDetailModal';

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
  team?: string;
  opponent?: string;
}

interface DFSLineupCardProps {
  lineup: DFSProjection[];
  totalProjected?: number;
  site?: string;
  onAsk?: (query: string) => void;
}

// Position color map — pitcher = blue family, hitters = position-specific
const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SP:   { bg: 'bg-blue-500/15',   text: 'text-blue-300',   border: 'border-blue-500/30' },
  RP:   { bg: 'bg-sky-500/15',    text: 'text-sky-300',    border: 'border-sky-500/30' },
  P:    { bg: 'bg-blue-500/15',   text: 'text-blue-300',   border: 'border-blue-500/30' },
  C:    { bg: 'bg-teal-500/15',   text: 'text-teal-300',   border: 'border-teal-500/30' },
  '1B': { bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30' },
  '2B': { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  '3B': { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  SS:   { bg: 'bg-cyan-500/15',   text: 'text-cyan-300',   border: 'border-cyan-500/30' },
  OF:   { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-500/30' },
  UTIL: { bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/30' },
  FLEX: { bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30' },
  QB:   { bg: 'bg-red-500/15',    text: 'text-red-300',    border: 'border-red-500/30' },
  RB:   { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' },
  WR:   { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  TE:   { bg: 'bg-pink-500/15',   text: 'text-pink-300',   border: 'border-pink-500/30' },
  K:    { bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/30' },
  DST:  { bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/30' },
};
const DEFAULT_POS_COLOR = { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30' };

function PositionBadge({ position }: { position: string }) {
  const pos = (position ?? '').toUpperCase();
  const c   = POS_COLORS[pos] ?? DEFAULT_POS_COLOR;
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-9 h-9 rounded-xl border font-black text-[9px] uppercase shrink-0',
      c.bg, c.text, c.border,
    )}>
      {pos.length > 4 ? pos.slice(0, 4) : pos}
    </span>
  );
}

/** Thin projection bar, width relative to the slate top scorer */
function ProjBar({ pts, maxPts }: { pts: number; maxPts: number }) {
  const pct = maxPts > 0 ? Math.min(100, (pts / maxPts) * 100) : 0;
  const color =
    pct >= 80 ? '#22d3ee'   // top scorer — cyan
    : pct >= 55 ? '#60a5fa' // above avg — blue
    : pct >= 35 ? '#fbbf24' // mid — amber
    : '#f87171';             // low — red

  return (
    <div className="flex-1 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden min-w-[40px] max-w-[80px]">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}55` }}
      />
    </div>
  );
}

/** Floor–median–ceiling range display */
function RangeBar({ p10, p50, p90 }: { p10: number; p50: number; p90: number }) {
  const range  = p90 - p10;
  if (range <= 0) return null;
  const medPct = Math.min(98, Math.max(2, ((p50 - p10) / range) * 100));

  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full overflow-visible bg-gradient-to-r from-red-500/20 via-amber-400/15 to-cyan-500/20">
        {/* Median marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-amber-400 shadow-[0_0_6px_#fbbf2488]"
          style={{ left: `calc(${medPct}% - 5px)` }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] font-bold tabular-nums">
        <span className="text-red-400">{p10.toFixed(0)} floor</span>
        <span className="text-amber-400">{p50.toFixed(0)} med</span>
        <span className="text-cyan-400">{p90.toFixed(0)} ceil</span>
      </div>
    </div>
  );
}

/** Matchup quality chip */
function MatchupChip({ score }: { score: number }) {
  const { label, cls } =
    score >= 70 ? { label: 'GREAT', cls: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25' }
    : score >= 50 ? { label: 'OK',   cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' }
    : { label: 'TOUGH', cls: 'text-red-400 bg-red-500/10 border-red-500/25' };
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md border text-[7px] font-black uppercase tracking-wide shrink-0', cls)}>
      {label}
    </span>
  );
}

export function DFSLineupCard({ lineup, totalProjected, site = 'DK', onAsk }: DFSLineupCardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<DFSProjection | null>(null);

  const total    = totalProjected ?? lineup.reduce((s, p) => s + (p.dk_pts_mean ?? 0), 0);
  const maxPts   = Math.max(...lineup.map(p => p.dk_pts_mean ?? 0), 1);
  const platform = site.toUpperCase();

  // Salary totals
  const hasSalary     = lineup.some(p => p.salary != null);
  const parseSal      = (s: string | number | undefined) => parseFloat(String(s ?? '0').replace(/[^0-9.]/g, ''));
  const totalSal      = hasSalary ? lineup.reduce((s, p) => s + parseSal(p.salary), 0) : 0;
  const CAP           = platform === 'FD' ? 60000 : 50000;
  const salRemaining  = CAP - totalSal;

  // Floor / ceiling from percentile data
  const hasRange  = lineup.some(p => p.p10 != null && p.p90 != null);
  const totalP10  = hasRange ? lineup.reduce((s, p) => s + (p.p10  ?? p.dk_pts_mean ?? 0), 0) : null;
  const totalP90  = hasRange ? lineup.reduce((s, p) => s + (p.p90  ?? p.dk_pts_mean ?? 0), 0) : null;
  const totalP50  = hasRange ? lineup.reduce((s, p) => s + (p.p50  ?? p.dk_pts_mean ?? 0), 0) : null;

  // Value efficiency: pts per $1K
  const efficiency = hasSalary && totalSal > 0 ? (total / (totalSal / 1000)).toFixed(2) : null;

  return (
    <article className="w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 transition-all duration-300">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-amber-500/8 via-transparent to-transparent flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Target className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">DFS · Projected Lineup</p>
            <p className="text-[11px] font-black text-foreground leading-tight truncate">{platform} Optimizer</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[8px] font-black uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-black tracking-wider">
            {platform}
          </span>
        </div>
      </div>

      {/* ── Projection hero ──────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-end gap-4 mb-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-0.5">Projected Points</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-foreground tabular-nums leading-none">{total.toFixed(1)}</span>
              <span className="text-[11px] text-[var(--text-faint)] font-medium">pts</span>
            </div>
          </div>
          {efficiency && (
            <div className="pb-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-0.5">Value</p>
              <span className="text-[13px] font-black text-cyan-400 tabular-nums">{efficiency}x</span>
              <span className="text-[9px] text-[var(--text-faint)] ml-0.5">pts/$K</span>
            </div>
          )}
        </div>
        {/* Floor–median–ceiling range bar */}
        {hasRange && totalP10 !== null && totalP50 !== null && totalP90 !== null && (
          <RangeBar p10={totalP10} p50={totalP50} p90={totalP90} />
        )}
      </div>

      {/* ── Salary cap summary bar ───────────────────────────────────── */}
      {hasSalary && (
        <div className="px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-1.5">
            <span>Salary used</span>
            <span className={salRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {salRemaining >= 0 ? `$${(salRemaining / 1000).toFixed(1)}K left` : `$${(Math.abs(salRemaining) / 1000).toFixed(1)}K over cap`}
            </span>
          </div>
          <div className="h-1 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                totalSal / CAP > 1.02 ? 'bg-red-500' : totalSal / CAP > 0.96 ? 'bg-emerald-500' : 'bg-amber-500',
              )}
              style={{ width: `${Math.min(100, (totalSal / CAP) * 100).toFixed(1)}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-[var(--text-faint)] tabular-nums mt-1">
            <span>${(totalSal / 1000).toFixed(1)}K used</span>
            <span>cap ${(CAP / 1000).toFixed(0)}K</span>
          </div>
        </div>
      )}

      {/* ── Roster rows ──────────────────────────────────────────────── */}
      <div className="divide-y divide-[var(--border-subtle)]/50">
        {lineup.map((p, i) => {
          const sal    = hasSalary && p.salary != null ? `$${(parseSal(p.salary) / 1000).toFixed(1)}K` : null;
          const hasMS  = p.matchup_score != null;

          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 transition-colors duration-150 cursor-pointer group/row',
                i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-elevated)]/20',
                'hover:bg-amber-500/5',
              )}
              onClick={() => setSelectedPlayer(p)}
            >
              {/* Position badge */}
              <PositionBadge position={p.player_type} />

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-foreground group-hover/row:text-amber-300 transition-colors truncate leading-tight">
                  {p.player_name}
                </p>
                {p.team && (
                  <p className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide leading-tight">{p.team}</p>
                )}
              </div>

              {/* Matchup chip */}
              {hasMS && <MatchupChip score={p.matchup_score!} />}

              {/* Projection bar */}
              <ProjBar pts={p.dk_pts_mean ?? 0} maxPts={maxPts} />

              {/* Salary */}
              {sal && (
                <span className="text-[10px] font-bold text-[var(--text-muted)] tabular-nums shrink-0 min-w-[36px] text-right">
                  {sal}
                </span>
              )}

              {/* Projected points */}
              <span className={cn(
                'text-[12px] font-black tabular-nums shrink-0 min-w-[28px] text-right',
                (p.dk_pts_mean ?? 0) >= maxPts * 0.8 ? 'text-cyan-400'
                : (p.dk_pts_mean ?? 0) >= maxPts * 0.55 ? 'text-blue-400'
                : (p.dk_pts_mean ?? 0) >= maxPts * 0.35 ? 'text-amber-400'
                : 'text-red-400',
              )}>
                {(p.dk_pts_mean ?? 0).toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--border-subtle)] px-4 py-3 bg-[var(--bg-elevated)]/40">
        <div className="flex items-center justify-between gap-3">
          {/* Stat pills */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-[15px] font-black text-foreground tabular-nums leading-none">{total.toFixed(1)}</span>
              <span className="text-[7px] font-black uppercase tracking-wider text-[var(--text-faint)] mt-0.5">Proj Pts</span>
            </div>
            {hasSalary && totalSal > 0 && (
              <>
                <div className="w-px h-8 bg-[var(--border-subtle)]" />
                <div className="flex flex-col items-center">
                  <span className="text-[15px] font-black text-amber-400 tabular-nums leading-none">${(totalSal / 1000).toFixed(1)}K</span>
                  <span className="text-[7px] font-black uppercase tracking-wider text-[var(--text-faint)] mt-0.5">Salary</span>
                </div>
                <div className="w-px h-8 bg-[var(--border-subtle)]" />
                <div className="flex flex-col items-center">
                  <span className={cn(
                    'text-[15px] font-black tabular-nums leading-none',
                    salRemaining >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {salRemaining >= 0 ? '+' : ''}{(salRemaining / 1000).toFixed(1)}K
                  </span>
                  <span className="text-[7px] font-black uppercase tracking-wider text-[var(--text-faint)] mt-0.5">Cap Left</span>
                </div>
              </>
            )}
          </div>

          {/* CTA */}
          {onAsk && (
            <button
              onClick={() => onAsk(
                `Evaluate and optimize this ${platform} DFS lineup: ${lineup.map(p => `${p.player_type} ${p.player_name}`).join(', ')}. Any high-ceiling swaps to improve upside while staying under the ${platform === 'FD' ? '$60K' : '$50K'} cap?`
              )}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-black hover:bg-amber-500/20 hover:border-amber-400/40 transition-all duration-150"
            >
              <Zap className="w-3 h-3" />
              Optimize
            </button>
          )}
        </div>

        {/* Data source */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-[var(--text-faint)]" />
          <span className="text-[8px] text-[var(--text-faint)]">
            Projections via Baseball Savant Statcast · MLB Stats API · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Player detail modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          site={site}
          onClose={() => setSelectedPlayer(null)}
          onAsk={onAsk}
        />
      )}
    </article>
  );
}
