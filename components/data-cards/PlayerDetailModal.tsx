'use client';

import { useEffect, useRef } from 'react';
import { X, Zap, TrendingUp, DollarSign, Target, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DFSProjection } from './DFSLineupCard';

interface PlayerDetailModalProps {
  player: DFSProjection;
  site?: string;
  onClose: () => void;
  onAsk?: (query: string) => void;
}

const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SP:   { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/40' },
  RP:   { bg: 'bg-sky-500/20',     text: 'text-sky-300',     border: 'border-sky-500/40' },
  C:    { bg: 'bg-teal-500/20',    text: 'text-teal-300',    border: 'border-teal-500/40' },
  '1B': { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/40' },
  '2B': { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/40' },
  '3B': { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/40' },
  SS:   { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/40' },
  OF:   { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/40' },
  UTIL: { bg: 'bg-slate-500/20',   text: 'text-slate-300',   border: 'border-slate-500/40' },
  P:    { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/40' },
  QB:   { bg: 'bg-red-500/20',     text: 'text-red-300',     border: 'border-red-500/40' },
  RB:   { bg: 'bg-orange-500/20',  text: 'text-orange-300',  border: 'border-orange-500/40' },
  WR:   { bg: 'bg-indigo-500/20',  text: 'text-indigo-300',  border: 'border-indigo-500/40' },
  TE:   { bg: 'bg-pink-500/20',    text: 'text-pink-300',    border: 'border-pink-500/40' },
  K:    { bg: 'bg-gray-500/20',    text: 'text-gray-300',    border: 'border-gray-500/40' },
  DST:  { bg: 'bg-slate-500/20',   text: 'text-slate-300',   border: 'border-slate-500/40' },
  FLEX: { bg: 'bg-violet-500/20',  text: 'text-violet-300',  border: 'border-violet-500/40' },
};

function computeVortexScore(p: DFSProjection): number {
  const base = p.matchup_score ?? 50;
  const parkMult = p.park_factor != null ? (p.park_factor - 1) * 20 : 0;
  const weatherMult = p.weather_adj != null
    ? (typeof p.weather_adj === 'number' && p.weather_adj < 10 ? p.weather_adj * 10 : p.weather_adj)
    : 0;
  return Math.min(99, Math.max(1, Math.round(base + parkMult + weatherMult)));
}

function VortexGauge({ score }: { score: number }) {
  const pct = score / 100;
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const dash = pct * circ * 0.75; // 270° arc
  const gap = circ - dash;
  const color = score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 70 ? 'STRONG' : score >= 50 ? 'NEUTRAL' : 'WEAK';
  const labelColor = score >= 70 ? 'text-blue-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-[135deg]" viewBox="0 0 100 100">
          {/* Track */}
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} />
          {/* Fill */}
          <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${dash} ${gap + circ * 0.25}`}
            style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center translate-y-1">
          <span className="font-bebas text-[28px] text-white leading-none">{score}</span>
          <span className={cn('font-dm-mono text-[8px] font-bold uppercase tracking-widest', labelColor)}>{label}</span>
        </div>
      </div>
      <span className="font-dm-mono text-[9px] uppercase tracking-wider text-[var(--text-faint)]">Vortex Score</span>
    </div>
  );
}

function ProjectionBar({ p10, p50, p90, mean }: { p10: number; p50: number; p90: number; mean: number }) {
  const range = p90 - p10;
  if (range <= 0) return null;
  const medPct = Math.min(100, ((p50 - p10) / range) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-dm-mono">
        <span className="text-red-400">Floor {p10.toFixed(1)}</span>
        <span className="text-[var(--text-muted)]">Median {p50.toFixed(1)}</span>
        <span className="text-blue-400">Ceil {p90.toFixed(1)}</span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-visible">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/40 via-amber-400/30 to-blue-500/40" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_6px_white] border-2 border-[var(--cat-dfs,oklch(0.72_0.20_80))]"
          style={{ left: `calc(${medPct}% - 6px)` }}
        />
      </div>
      <p className="text-[9px] text-[var(--text-faint)] font-dm-mono text-center">
        Mean: <span className="text-green-400 font-bold">{mean.toFixed(1)}</span> pts
      </p>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, accent = false }: { icon: React.ComponentType<any>; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] min-w-0">
      <Icon className={cn('w-3.5 h-3.5 shrink-0', accent ? 'text-blue-400' : 'text-[var(--text-muted)]')} />
      <span className={cn('font-bebas text-[18px] leading-tight tabular-nums', accent ? 'text-blue-300' : 'text-white')}>{value}</span>
      <span className="font-dm-mono text-[8px] uppercase tracking-wide text-[var(--text-faint)] whitespace-nowrap">{label}</span>
    </div>
  );
}

export function PlayerDetailModal({ player: p, site = 'DK', onClose, onAsk }: PlayerDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const vortex = computeVortexScore(p);
  const pos = (p.player_type ?? '').toUpperCase();
  const posColors = POS_COLORS[pos] ?? { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/40' };

  const salary = p.salary != null ? (String(p.salary).startsWith('$') ? String(p.salary) : `$${p.salary}`) : null;
  const salaryNum = p.salary != null ? parseFloat(String(p.salary).replace(/[^0-9.]/g, '')) : 0;
  const valueRatio = salaryNum > 0 ? ((p.dk_pts_mean ?? 0) / (salaryNum / 1000)).toFixed(2) : null;

  const hasRange = p.p10 != null && p.p50 != null && p.p90 != null;
  const matchupLabel = p.matchup_score != null
    ? p.matchup_score >= 70 ? 'Great' : p.matchup_score >= 50 ? 'Neutral' : 'Tough'
    : '—';
  const matchupColor = p.matchup_score != null
    ? p.matchup_score >= 70 ? 'text-blue-400' : p.matchup_score >= 50 ? 'text-amber-400' : 'text-red-400'
    : 'text-[var(--text-muted)]';

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[0_0_60px_rgba(0,0,0,0.8)] animate-card-enter">

        {/* Header */}
        <div className="relative px-4 py-4 bg-gradient-to-br from-[var(--cat-dfs,oklch(0.72_0.20_80))]/20 to-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn(
              'inline-flex items-center justify-center px-2 py-0.5 rounded-md border font-black text-[9px] uppercase',
              posColors.bg, posColors.text, posColors.border,
            )}>
              {pos.length > 4 ? pos.slice(0, 4) : pos || '—'}
            </span>
            <span className="font-dm-mono text-[9px] uppercase tracking-widest text-[var(--text-faint)]">
              {site.toUpperCase()} · Player Card
            </span>
          </div>
          <h2 className="font-bebas text-[26px] text-white leading-none" style={{ letterSpacing: '0.02em' }}>
            {p.player_name}
          </h2>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">

          {/* Vortex Score + projection side by side */}
          <div className="flex items-center gap-4">
            <VortexGauge score={vortex} />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bebas text-[36px] text-white tabular-nums leading-none"
                  style={{ letterSpacing: '0.02em' }}>
                  {(p.dk_pts_mean ?? 0).toFixed(1)}
                </span>
                <span className="font-dm-mono text-[11px] text-[var(--text-muted)]">proj pts</span>
              </div>
              {hasRange && (
                <ProjectionBar
                  p10={p.p10!}
                  p50={p.p50!}
                  p90={p.p90!}
                  mean={p.dk_pts_mean ?? 0}
                />
              )}
            </div>
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-3 gap-2">
            {salary && (
              <StatChip icon={DollarSign} label="Salary" value={salary} />
            )}
            {valueRatio && (
              <StatChip icon={TrendingUp} label="Value" value={`${valueRatio}x`} accent />
            )}
            <StatChip
              icon={Target}
              label="Matchup"
              value={matchupLabel}
            />
            {p.park_factor != null && (
              <StatChip
                icon={MapPin as any}
                label="Park"
                value={p.park_factor >= 1 ? `+${((p.park_factor - 1) * 100).toFixed(0)}%` : `${((p.park_factor - 1) * 100).toFixed(0)}%`}
              />
            )}
            {p.weather_adj != null && (
              <StatChip
                icon={Wind}
                label="Weather"
                value={typeof p.weather_adj === 'number' && Math.abs(p.weather_adj) < 10
                  ? `${p.weather_adj >= 0 ? '+' : ''}${(p.weather_adj * 100).toFixed(0)}%`
                  : `${p.weather_adj >= 0 ? '+' : ''}${Number(p.weather_adj).toFixed(0)}%`}
              />
            )}
            {p.matchup_score != null && (
              <StatChip
                icon={Zap}
                label="Score"
                value={String(p.matchup_score)}
              />
            )}
          </div>

          {/* Matchup context row */}
          {(p.matchup_score != null || p.park_factor != null) && (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2.5 space-y-1.5">
              <p className="font-dm-mono text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Context Factors</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {p.matchup_score != null && (
                  <span className="font-dm-mono text-[11px]">
                    Matchup: <span className={cn('font-bold', matchupColor)}>{matchupLabel} ({p.matchup_score})</span>
                  </span>
                )}
                {p.park_factor != null && (
                  <span className="font-dm-mono text-[11px] text-[var(--text-secondary,var(--text-muted))]">
                    Park: <span className={p.park_factor >= 1 ? 'text-blue-400' : 'text-red-400'}>
                      {p.park_factor.toFixed(3)}
                    </span>
                  </span>
                )}
                {p.weather_adj != null && (
                  <span className="font-dm-mono text-[11px] text-[var(--text-secondary,var(--text-muted))]">
                    Weather adj: <span className={Number(p.weather_adj) >= 0 ? 'text-blue-400' : 'text-red-400'}>
                      {typeof p.weather_adj === 'number' && Math.abs(p.weather_adj) < 10
                        ? `${p.weather_adj >= 0 ? '+' : ''}${(p.weather_adj * 100).toFixed(0)}%`
                        : `${Number(p.weather_adj) >= 0 ? '+' : ''}${Number(p.weather_adj).toFixed(0)}%`}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Ask AI button */}
          {onAsk && (
            <button
              onClick={() => {
                onAsk(
                  `Give me a full analysis of ${p.player_name} (${pos}) for today's ${site.toUpperCase()} DFS slate: projections, splits (home/road), recent form, matchup, injury status, and whether he's worth ${salary ?? 'his salary'} at ${(p.dk_pts_mean ?? 0).toFixed(1)} projected points.`
                );
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 font-dm-mono text-[11px] text-blue-300 hover:bg-blue-500/25 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Ask AI about {p.player_name.split(' ').pop()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
