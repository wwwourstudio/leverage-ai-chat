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

export function PitchMatchupCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  onAnalyze,
  isHero,
}: PitchMatchupCardProps) {
  const advantage = data.advantageSide ?? 'neutral';
  const edge = Number(data.compositeEdge ?? 0);
  const edgeStr = edge >= 0 ? `+${edge.toFixed(1)}` : edge.toFixed(1);

  const adv = {
    batter:  { border: 'border-emerald-600/40', badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', label: 'Batter Edge' },
    pitcher: { border: 'border-red-600/40',     badge: 'bg-red-500/15     border-red-500/40     text-red-400',     label: 'Pitcher Edge' },
    neutral: { border: 'border-[oklch(0.22_0.02_280)]', badge: 'bg-slate-500/10 border-slate-500/30 text-slate-400', label: 'Neutral' },
  }[advantage];

  // Pitch type colors
  const PITCH_COLORS: Record<string, string> = {
    FF: 'bg-red-500/70', FT: 'bg-orange-500/70', SI: 'bg-orange-400/70',
    FC: 'bg-amber-500/70', SL: 'bg-blue-500/70', ST: 'bg-sky-400/70',
    CH: 'bg-emerald-500/70', FS: 'bg-teal-500/70', CB: 'bg-yellow-500/70',
    CU: 'bg-yellow-500/70', KC: 'bg-yellow-400/70',
  };
  const getPitchColor = (pt: string) => PITCH_COLORS[pt.toUpperCase()] ?? 'bg-purple-500/60';

  // Spin rate context
  const spinNum = Number(data.pitcherSpinRate ?? 0);
  const spinLabel = spinNum > 2500 ? 'elite' : spinNum > 2200 ? 'avg' : 'low';
  const spinColor = spinNum > 2500 ? 'text-emerald-400' : spinNum > 2200 ? 'text-[oklch(0.80_0.005_85)]' : 'text-amber-400';

  // Parse pitch mix if JSON string
  let mixEntries: [string, string][] = [];
  try {
    const raw = typeof data.pitchMix === 'string' ? JSON.parse(data.pitchMix) : data.pitchMix;
    if (raw && typeof raw === 'object') {
      mixEntries = Object.entries(raw).map(([k, v]) => [k, String(v)]);
    }
  } catch { /* ignore */ }

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border transition-all duration-200 animate-fade-in-up',
        adv.border, 'hover:brightness-110',
        isHero && 'sm:rounded-3xl',
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
              <span className="text-[oklch(0.3_0.01_280)] mx-1.5">/</span>
              <span className="text-[10px] font-medium text-[oklch(0.45_0.01_280)]">{subcategory}</span>
              <h3 className="text-sm font-black text-[oklch(0.92_0.005_85)] mt-1 leading-snug">{title}</h3>
            </div>
          </div>
          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0', adv.badge)}>
            {adv.label}
          </span>
        </div>

        {/* Batter vs pitcher strip */}
        {(data.batterName || data.pitcherName) && (
          <div className="flex items-center justify-between rounded-lg bg-[oklch(0.09_0.01_280)] border border-[oklch(0.18_0.015_280)] px-3 py-1.5 mb-3 text-xs">
            <div className="text-center min-w-0 flex-1">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-0.5">Batter</p>
              <p className="font-semibold text-[oklch(0.85_0.005_85)] truncate">{data.batterName ?? '—'}</p>
            </div>
            <span className="text-[10px] font-black text-[oklch(0.38_0.01_280)] px-3 shrink-0">vs</span>
            <div className="text-center min-w-0 flex-1">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.42_0.01_280)] mb-0.5">Pitcher</p>
              <p className="font-semibold text-[oklch(0.85_0.005_85)] truncate">{data.pitcherName ?? '—'}</p>
            </div>
          </div>
        )}

        {/* Edge + velocity */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
            <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">RV/100</p>
            <p className={cn('text-base font-black tabular-nums', edge >= 1.5 ? 'text-emerald-400' : edge <= -1.5 ? 'text-red-400' : 'text-[oklch(0.80_0.005_85)]')}>
              {edgeStr}
            </p>
          </div>
          {data.pitcherAvgVelocity !== undefined && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Velo</p>
              <p className="text-base font-black tabular-nums text-[oklch(0.85_0.005_85)]">{data.pitcherAvgVelocity} mph</p>
            </div>
          )}
          {data.dominantPitchType && (
            <div className="bg-[oklch(0.09_0.01_280)] rounded-lg border border-[oklch(0.18_0.015_280)] p-2.5 text-center">
              <p className="text-[8px] uppercase tracking-widest text-[oklch(0.40_0.01_280)] mb-1">Primary</p>
              <p className="text-base font-black tabular-nums text-[oklch(0.85_0.005_85)]">{data.dominantPitchType}</p>
            </div>
          )}
        </div>

        {/* Spin rate context */}
        {spinNum > 0 && (
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[oklch(0.45_0.01_280)]">Spin Rate</span>
            <span className={cn('font-semibold tabular-nums', spinColor)}>
              {spinNum.toLocaleString()} rpm
              <span className="text-[oklch(0.45_0.01_280)] font-normal ml-1">({spinLabel})</span>
            </span>
          </div>
        )}

        {/* Pitch mix breakdown */}
        {mixEntries.length > 0 && (
          <div className="space-y-1 mb-3">
            {mixEntries.slice(0, 4).map(([pitch, pct]) => (
              <div key={pitch} className="flex items-center gap-2 text-xs">
                <span className="w-6 text-[oklch(0.50_0.01_280)] font-mono text-[10px]">{pitch}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[oklch(0.18_0.015_280)] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', getPitchColor(pitch))}
                    style={{ width: pct.toString().replace('%', '') + '%' }}
                  />
                </div>
                <span className="text-[oklch(0.55_0.01_280)] w-8 text-right">{pct}</span>
              </div>
            ))}
          </div>
        )}

        {data.signal && (
          <p className="text-[11px] text-[oklch(0.60_0.01_280)] leading-relaxed">{data.signal}</p>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-purple-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
          >
            Full Matchup Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
