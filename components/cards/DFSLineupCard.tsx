'use client';

import { ChevronRight, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DFSProjection {
  player_name: string;
  player_type: string;
  dk_pts_mean: number;
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

// Position bubble color map
const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SP:    { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/35' },
  RP:    { bg: 'bg-sky-500/20',    text: 'text-sky-300',    border: 'border-sky-500/35' },
  C:     { bg: 'bg-teal-500/20',   text: 'text-teal-300',   border: 'border-teal-500/35' },
  '1B':  { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  '2B':  { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  '3B':  { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  SS:    { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/35' },
  OF:    { bg: 'bg-amber-500/20',  text: 'text-amber-300',  border: 'border-amber-500/35' },
  UTIL:  { bg: 'bg-slate-500/20',  text: 'text-slate-300',  border: 'border-slate-500/35' },
  P:     { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/35' },
  FLEX:  { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/35' },
  QB:    { bg: 'bg-red-500/20',    text: 'text-red-300',    border: 'border-red-500/35' },
  RB:    { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/35' },
  WR:    { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/35' },
  TE:    { bg: 'bg-pink-500/20',   text: 'text-pink-300',   border: 'border-pink-500/35' },
  K:     { bg: 'bg-gray-500/20',   text: 'text-gray-300',   border: 'border-gray-500/35' },
  DST:   { bg: 'bg-slate-500/20',  text: 'text-slate-300',  border: 'border-slate-500/35' },
};

function PositionBubble({ position }: { position: string }) {
  const pos = position.toUpperCase();
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

export function DFSLineupCard({ lineup, totalProjected, site = 'DK', onAsk }: DFSLineupCardProps) {
  const total =
    totalProjected ?? lineup.reduce((sum, p) => sum + (p.dk_pts_mean ?? 0), 0);

  const maxPts = Math.max(...lineup.map(p => p.dk_pts_mean ?? 0), 1);

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow,0_0_24px_oklch(0.3_0.06_280/0.12))] transition-all duration-300">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-indigo-600/25 via-violet-800/10 to-transparent border-b border-[var(--border-subtle)]">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-32 h-16 bg-indigo-500/8 rounded-bl-full blur-2xl pointer-events-none" />

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wide">
            {site}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/60">DFS</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50">Projected Lineup</span>
        </div>
        <h3 className="font-black text-white leading-snug text-sm pr-20">{site} Projections</h3>

        {/* Total projected points — prominent */}
        <div className="flex items-center gap-2 mt-2">
          <div className="inline-flex items-baseline gap-1">
            <span className="text-2xl font-black text-white tabular-nums leading-none">{total.toFixed(1)}</span>
            <span className="text-[10px] text-white/50 font-bold">proj pts</span>
          </div>
          {lineup.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wide">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              {lineup.length} players
            </span>
          )}
        </div>
      </div>

      {/* ── Roster rows ──────────────────────────────────────────────── */}
      <div className="divide-y divide-[var(--border-subtle)]/50">
        {lineup.map((p, i) => {
          const barPct = Math.min(100, ((p.dk_pts_mean ?? 0) / maxPts) * 100);
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--bg-elevated)]/50 transition-colors',
                i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-elevated)]/30',
              )}
            >
              {/* Position bubble */}
              <PositionBubble position={p.player_type} />

              {/* Player name + mini bar */}
              <div className="flex-1 min-w-0">
                <span className="font-black text-white text-[12px] truncate block">{p.player_name}</span>
                {/* Relative projection bar */}
                <div className="h-0.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden mt-1 max-w-[100px]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-500"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              {/* P90 ceiling */}
              {p.p90 != null && (
                <div className="text-right shrink-0">
                  <span className="text-[8px] text-[var(--text-faint)] block">ceil</span>
                  <span className="text-[10px] text-white/50 tabular-nums">{p.p90.toFixed(1)}</span>
                </div>
              )}

              {/* Projected points — prominent */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Target className="w-2.5 h-2.5 text-indigo-400/70" />
                <span className="text-[13px] font-black text-indigo-300 tabular-nums">
                  {(p.dk_pts_mean ?? 0).toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer: total + submit indicator + CTA ───────────────────── */}
      {lineup.length > 0 && (
        <div className="px-3 pt-3 pb-3 space-y-2.5 border-t border-[var(--border-subtle)]">
          {/* Total row */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Total Projected</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white tabular-nums">{total.toFixed(1)}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wide">
                PTS
              </span>
            </div>
          </div>

          {/* CTA */}
          {onAsk && (
            <button
              onClick={() =>
                onAsk(
                  `Evaluate this DFS lineup: ${lineup.map(p => p.player_name).join(', ')} — any swaps to improve ceiling or floor?`,
                )
              }
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-black uppercase tracking-wide hover:from-indigo-500 hover:to-violet-500 shadow-[0_2px_10px_oklch(0.4_0.2_280/0.35)] hover:shadow-[0_4px_16px_oklch(0.4_0.2_280/0.5)] transition-all duration-200"
            >
              <Zap className="w-3.5 h-3.5" />
              Optimize this lineup
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
