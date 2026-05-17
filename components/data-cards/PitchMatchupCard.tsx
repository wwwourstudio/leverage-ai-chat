'use client';

import { Target, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PitchMatchupData {
  batterName?: string;
  pitcherName?: string;
  compositeEdge?: string | number;
  dominantPitchType?: string;
  advantageSide?: 'batter' | 'pitcher' | 'neutral';
  pitcherAvgVelocity?: string | number;
  pitcherSpinRate?: string | number;
  /** JSON string or object of pitch mix: { "FF": "55%", "SL": "30%", ... } */
  pitchMix?: string | Record<string, string | number>;
  signal?: string;
  description?: string;
  note?: string;
}

interface PitchMatchupCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: PitchMatchupData;
  status: string;
  onAnalyze?: () => void;
  error?: string;
  isHero?: boolean;
}

const ADV_CONFIG = {
  batter:  { badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', header: 'dark:from-emerald-900/30 dark:via-green-900/10',   label: 'Batter Edge',  icon: 'text-emerald-400' },
  pitcher: { badge: 'bg-red-500/15 border-red-500/40 text-red-400',             header: 'dark:from-red-900/30 dark:via-rose-900/10',        label: 'Pitcher Edge', icon: 'text-red-400'     },
  neutral: { badge: 'bg-slate-500/10 border-slate-500/30 text-slate-400',       header: 'dark:from-purple-900/25 dark:via-violet-900/10',   label: 'Neutral',      icon: 'text-purple-400'  },
};

const PITCH_COLORS: Record<string, string> = {
  FF: 'bg-red-500/70', FT: 'bg-orange-500/70', SI: 'bg-orange-400/70',
  FC: 'bg-amber-500/70', SL: 'bg-blue-500/70', ST: 'bg-sky-400/70',
  CH: 'bg-emerald-500/70', FS: 'bg-teal-500/70', CB: 'bg-yellow-500/70',
  CU: 'bg-yellow-500/70', KC: 'bg-yellow-400/70',
};

export function PitchMatchupCard({
  title,
  category,
  subcategory,
  data,
  onAnalyze,
  isHero,
}: PitchMatchupCardProps) {
  const advantage = data.advantageSide ?? 'neutral';
  const cfg = ADV_CONFIG[advantage];
  const edge = Number(data.compositeEdge ?? 0);
  const edgeStr = edge >= 0 ? `+${edge.toFixed(1)}` : edge.toFixed(1);
  const edgeColor = edge >= 1.5 ? 'text-emerald-400' : edge <= -1.5 ? 'text-red-400' : 'text-white/80';

  const spinNum = Number(data.pitcherSpinRate ?? 0);
  const spinLabel = spinNum > 2500 ? 'elite' : spinNum > 2200 ? 'avg' : 'low';
  const spinColor = spinNum > 2500 ? 'text-emerald-400' : spinNum > 2200 ? 'text-white/70' : 'text-amber-400';

  let mixEntries: [string, string][] = [];
  try {
    const raw = typeof data.pitchMix === 'string' ? JSON.parse(data.pitchMix) : data.pitchMix;
    if (raw && typeof raw === 'object') {
      mixEntries = Object.entries(raw).map(([k, v]) => [k, String(v)]);
    }
  } catch { /* ignore */ }

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
      'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)]',
      isHero && 'sm:rounded-3xl',
    )}>
      {/* Gradient header */}
      <div className={cn('relative px-4 pt-4 pb-3 bg-gradient-to-br to-transparent border-b border-[var(--border-subtle)]', cfg.header)}>
        <div className="absolute top-3 right-3">
          <span className={cn('inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border', cfg.badge)}>
            <Target className={cn('w-2.5 h-2.5', cfg.icon)} />
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{category}</span>
          <span className="text-white/25">·</span>
          <span className="text-[9px] text-white/40">{subcategory}</span>
        </div>
        <h3 className="text-sm font-black text-white leading-snug pr-28">{title}</h3>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Batter vs Pitcher matchup strip */}
        {(data.batterName || data.pitcherName) && (
          <div className="flex items-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2">
            <div className="flex-1 text-center min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-0.5">Batter</p>
              <p className="text-xs font-bold text-white truncate">{data.batterName ?? '—'}</p>
            </div>
            <span className="text-[10px] font-black text-[var(--text-faint)] px-3 shrink-0">vs</span>
            <div className="flex-1 text-center min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-0.5">Pitcher</p>
              <p className="text-xs font-bold text-white truncate">{data.pitcherName ?? '—'}</p>
            </div>
          </div>
        )}

        {/* Edge + velocity + primary pitch tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">RV/100</p>
            <p className={cn('text-base font-black tabular-nums', edgeColor)}>{edgeStr}</p>
          </div>
          {data.pitcherAvgVelocity !== undefined && (
            <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Velo</p>
              <p className="text-base font-black tabular-nums text-white">{data.pitcherAvgVelocity} <span className="text-[10px] font-normal text-[var(--text-faint)]">mph</span></p>
            </div>
          )}
          {data.dominantPitchType && (
            <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] p-2.5 text-center">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Primary</p>
              <p className="text-base font-black text-white">{data.dominantPitchType}</p>
            </div>
          )}
        </div>

        {/* Spin rate */}
        {spinNum > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-faint)]">Spin Rate</span>
            <span className={cn('font-semibold tabular-nums', spinColor)}>
              {spinNum.toLocaleString('en-US')} rpm
              <span className="text-[var(--text-faint)] font-normal ml-1">({spinLabel})</span>
            </span>
          </div>
        )}

        {/* Pitch mix bars */}
        {mixEntries.length > 0 && (
          <div className="space-y-1.5">
            {mixEntries.slice(0, 5).map(([pitch, pct]) => (
              <div key={pitch} className="flex items-center gap-2 text-[10px]">
                <span className="w-6 text-[var(--text-muted)] font-mono">{pitch}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', PITCH_COLORS[pitch.toUpperCase()] ?? 'bg-purple-500/60')}
                    style={{ width: pct.toString().replace('%', '') + '%' }}
                  />
                </div>
                <span className="text-[var(--text-muted)] w-8 text-right tabular-nums">{pct}</span>
              </div>
            ))}
          </div>
        )}

        {data.signal && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.signal}</p>
        )}
      </div>

      {onAnalyze && (
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-purple-400 transition-all duration-150"
          >
            Full Matchup Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </article>
  );
}
