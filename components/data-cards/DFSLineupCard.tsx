'use client';

import { useState } from 'react';
import { ChevronRight, Zap } from 'lucide-react';
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
  '1B': { bg: 'bg-blue-500/20',  text: 'text-blue-300',  border: 'border-blue-500/35' },
  '2B': { bg: 'bg-blue-500/20',  text: 'text-blue-300',  border: 'border-blue-500/35' },
  '3B': { bg: 'bg-blue-500/20',  text: 'text-blue-300',  border: 'border-blue-500/35' },
  SS:   { bg: 'bg-blue-500/20',  text: 'text-blue-300',  border: 'border-blue-500/35' },
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
  const cls  = score >= 70 ? 'bg-blue-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const tip  = score >= 70 ? 'GREAT' : score >= 50 ? 'OK' : 'TOUGH';
  const txt  = score >= 70 ? 'text-blue-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[8px] font-black uppercase tracking-wide shrink-0', txt)}>
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
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 via-amber-400/20 to-blue-500/30" />
        {/* Median marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-[var(--cat-dfs,oklch(0.72_0.20_80))] shadow-[0_0_4px_oklch(0.72_0.20_80/0.6)]"
          style={{ left: `calc(${medPct}% - 4px)` }}
        />
      </div>
      <div className="flex items-center justify-between" style={{ maxWidth: '110px' }}>
        <span className="text-[7px] text-red-400 tabular-nums">{p10.toFixed(0)}</span>
        <span className="text-[7px] text-[var(--text-faint)] tabular-nums">{p50.toFixed(0)}</span>
        <span className="text-[7px] text-blue-400 tabular-nums">{p90.toFixed(0)}</span>
      </div>
    </div>
  );
}

export function DFSLineupCard({ lineup, totalProjected, site = 'DK', onAsk }: DFSLineupCardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<DFSProjection | null>(null);
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
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 to-transparent border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5 text-white/60">
          <span className="text-[9px] font-black uppercase tracking-widest">DFS</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px]">Projected Lineup</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--cat-dfs,oklch(0.72_0.20_80))]/15 border border-[var(--cat-dfs,oklch(0.72_0.20_80))]/30 text-[var(--cat-dfs,oklch(0.72_0.20_80))] text-[9px] font-black uppercase tracking-wider">
          {platformLabel}
        </span>
      </div>

      {/* ── Title block ──────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2.5 border-b border-[var(--border-subtle)]">
        <h3 className="font-bebas text-[22px] text-white leading-none" style={{ letterSpacing: '0.02em' }}>{platformLabel} Projected Lineup</h3>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-baseline gap-1">
            <span className="font-bebas text-[28px] text-white tabular-nums leading-none" style={{ letterSpacing: '0.02em' }}>{total.toFixed(1)}</span>
            <span className="font-dm-mono text-[10px] text-white/50">proj pts</span>
          </div>
          {totalP10 !== null && totalP90 !== null && (
            <div className="flex items-center gap-1 font-dm-mono text-[10px] tabular-nums">
              <span className="text-red-400">{totalP10.toFixed(0)}</span>
              <span className="text-[var(--text-faint)]">–</span>
              <span className="text-blue-400">{totalP90.toFixed(0)}</span>
              <span className="text-[var(--text-faint)]">range</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Roster rows ──────────────────────────────────────────────── */}
      <div className="divide-y divide-[var(--border-subtle)]/40">
        {lineup.map((p, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 px-3 py-2 transition-colors',
              i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-elevated)]/30',
            )}
          >
            {/* POS */}
            <span className="font-dm-mono text-[10px] text-[var(--text-muted)] min-w-[24px] shrink-0 uppercase">{p.player_type}</span>
            {/* Name — clickable to open player detail modal */}
            <button
              onClick={() => setSelectedPlayer(p)}
              className="flex-1 min-w-0 text-left text-[13px] font-medium text-[var(--foreground)] hover:text-blue-300 truncate transition-colors cursor-pointer"
            >
              {p.player_name}
            </button>
            {/* Team */}
            <span className="font-dm-mono text-[10px] text-[var(--text-secondary,var(--text-muted))] shrink-0">—</span>
            {/* Salary */}
            {p.salary != null && (
              <span className="font-dm-mono text-[11px] text-[var(--text-secondary,var(--text-muted))] tabular-nums shrink-0">
                {String(p.salary).startsWith('$') ? String(p.salary) : `$${p.salary}`}
              </span>
            )}
            {/* Proj pts */}
            <span className="font-dm-mono text-[11px] font-medium text-green-400 tabular-nums shrink-0 min-w-[3ch] text-right">
              {(p.dk_pts_mean ?? 0).toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {lineup.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="font-bebas text-[18px] text-white tabular-nums leading-tight" style={{ letterSpacing: '0.02em' }}>{total.toFixed(1)}</span>
              <span className="font-dm-mono text-[9px] uppercase text-[var(--text-muted)]">Proj Pts</span>
            </div>
            {hasSalary && totalSalaryNum > 0 && (
              <>
                <div className="w-px h-8 bg-[var(--border-subtle)]" />
                <div className="flex flex-col">
                  <span className="font-bebas text-[18px] text-[var(--cat-dfs,oklch(0.72_0.20_80))] tabular-nums leading-tight" style={{ letterSpacing: '0.02em' }}>${(totalSalaryNum / 1000).toFixed(1)}K</span>
                  <span className="font-dm-mono text-[9px] uppercase text-[var(--text-muted)]">Salary</span>
                </div>
                <div className="w-px h-8 bg-[var(--border-subtle)]" />
                <div className="flex flex-col">
                  <span className="font-bebas text-[18px] text-green-400 tabular-nums leading-tight" style={{ letterSpacing: '0.02em' }}>${((50000 - totalSalaryNum) / 1000).toFixed(1)}K</span>
                  <span className="font-dm-mono text-[9px] uppercase text-[var(--text-muted)]">Left</span>
                </div>
              </>
            )}
          </div>
          {onAsk && (
            <button
              onClick={() => onAsk(`Evaluate this ${platformLabel} DFS lineup: ${lineup.map(p => p.player_name).join(', ')} — any swaps to improve ceiling or floor?`)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 font-dm-mono text-[10px] text-blue-300 hover:bg-blue-500/25 transition-colors"
            >
              Export
            </button>
          )}
        </div>
      )}
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
