'use client';

import { memo } from 'react';

// ─── Types (mirrors HRPredictionBridgeOutput from hr-prediction-bridge.ts) ────

interface HRPredictionData {
  type: 'hr_prediction_card';
  player: string;
  probability: number;          // 0–1
  impliedOdds: number | null;   // American odds (+650, -110, etc.)
  edge: number;                 // model − market implied prob
  components: {
    baseRate: number;
    parkFactor: number;
    weatherFactor: number;
    matchupFactor: number;
    mlAdjusted?: number;
  };
  confidence: 'low' | 'medium' | 'high';
  pitcherName?: string;
  venue?: string;
  gameTime?: string;
  dataSource?: 'statcast_db' | 'mlb_api_fallback';
  warnings?: string[];
  // error path
  success?: boolean;
  error?: string;
}

interface HRPredictionCardProps {
  data: HRPredictionData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtOdds(american: number | null): string {
  if (american == null) return '—';
  return american >= 0 ? `+${american}` : `${american}`;
}

function fmtEdge(edge: number): string {
  const sign = edge >= 0 ? '+' : '';
  return `${sign}${(edge * 100).toFixed(1)}pp`;
}

function impliedFromProb(prob: number): number {
  if (prob >= 0.5) return -Math.round((prob / (1 - prob)) * 100);
  return Math.round(((1 - prob) / prob) * 100);
}

const CONFIDENCE_CONFIG = {
  high:   { label: 'HIGH',   color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  medium: { label: 'MEDIUM', color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30'   },
  low:    { label: 'LOW',    color: 'text-rose-300',    bg: 'bg-rose-500/15',     border: 'border-rose-500/30'   },
};

// Pitch type colors for component bars
const FACTOR_COLORS: Record<string, { bar: string; label: string }> = {
  'Base Rate':   { bar: '#f43f5e', label: 'BASE RATE'   },
  'Park Factor': { bar: '#f59e0b', label: 'PARK FACTOR' },
  'Weather':     { bar: '#60a5fa', label: 'WEATHER'     },
  'Matchup':     { bar: '#a78bfa', label: 'MATCHUP'     },
  'ML Adjusted': { bar: '#10b981', label: 'ML ADJ'      },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const HRPredictionCard = memo(function HRPredictionCard({ data }: HRPredictionCardProps) {
  // Error state
  if (!data.success && data.error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        <p className="font-semibold mb-1">HR Prediction unavailable</p>
        <p className="text-rose-400/80">{data.error}</p>
      </div>
    );
  }

  const confCfg      = CONFIDENCE_CONFIG[data.confidence ?? 'low'];
  const modelOdds    = impliedFromProb(data.probability);
  const hasEdge      = data.impliedOdds != null && Math.abs(data.edge) > 0.005;
  const edgePositive = data.edge > 0;

  const probPct = data.probability * 100;
  const heroColor = probPct >= 15 ? '#10b981' : probPct >= 8 ? '#f59e0b' : '#f43f5e';

  // Circular gauge
  const CIRC = 2 * Math.PI * 40;
  const gaugeDashOffset = CIRC * (1 - data.probability);

  // Quarter-Kelly stake recommendation
  const kellyRec = (() => {
    if (data.impliedOdds == null || data.edge <= 0) return null;
    const american = data.impliedOdds;
    const decimal  = american >= 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
    const b = decimal - 1;
    const p = data.probability;
    const q = 1 - p;
    const full = (p * b - q) / b;
    return Math.max(0, full * 0.25);
  })();

  const factors: Array<{ label: string; value: number; range: [number, number]; fmt?: (v: number) => string }> = [
    { label: 'Base Rate',   value: data.components.baseRate,      range: [0, 0.20],    fmt: fmtPct  },
    { label: 'Park Factor', value: data.components.parkFactor,    range: [0.85, 1.35], fmt: v => v.toFixed(2) },
    { label: 'Weather',     value: data.components.weatherFactor, range: [0.85, 1.25], fmt: v => v.toFixed(2) },
    { label: 'Matchup',     value: data.components.matchupFactor, range: [0.70, 1.80], fmt: v => v.toFixed(2) },
    ...(data.components.mlAdjusted !== undefined
      ? [{ label: 'ML Adjusted', value: data.components.mlAdjusted, range: [0.80, 1.20] as [number, number], fmt: (v: number) => v.toFixed(2) }]
      : []),
  ];

  const ciHalf = data.confidence === 'high' ? 0.03 : data.confidence === 'medium' ? 0.07 : 0.12;
  const ciLo   = Math.max(0, data.probability - ciHalf);
  const ciHi   = Math.min(1, data.probability + ciHalf);
  const CI_MAX = 0.30;

  return (
    <div className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_24px_rgba(244,63,94,0.10)] transition-all duration-300">

      {/* ── Header ── */}
      <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-rose-600/25 dark:via-red-900/10 to-transparent border-b border-[var(--border-subtle)]">
        {/* Confidence badge top-right */}
        <div className={`absolute top-3 right-3 text-[9px] font-black px-2 py-1 rounded-lg border ${confCfg.bg} ${confCfg.border} ${confCfg.color} uppercase tracking-widest`}>
          {confCfg.label} CONF
        </div>

        {/* Sport chip */}
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/40 block mb-2">
          MLB · HR Prediction · v3 Engine
        </span>

        {/* Player name hero */}
        <h3 className="text-base font-black text-[var(--foreground)] leading-tight pr-20">{data.player}</h3>

        {/* Venue / pitcher strip */}
        {(data.pitcherName || data.venue || data.gameTime) && (
          <p className="text-[10px] text-[var(--foreground)]/40 mt-1 flex items-center gap-2 flex-wrap">
            {data.pitcherName && <span>vs {data.pitcherName}</span>}
            {data.venue && <span>· {data.venue}</span>}
            {data.gameTime && <span>· {data.gameTime}</span>}
            {data.dataSource === 'mlb_api_fallback' && <span className="text-amber-400/70">· estimated</span>}
          </p>
        )}
      </div>

      {/* ── HERO probability section ── */}
      <div className="px-4 py-4 flex items-center gap-5 border-b border-[var(--border-subtle)]">
        {/* Large circular gauge */}
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className="w-24 h-24" aria-hidden="true">
            {/* Track */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            {/* Progress */}
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={heroColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={gaugeDashOffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${heroColor}60)` }}
            />
            {/* Center text */}
            <text x="50" y="44" textAnchor="middle" style={{ fontSize: '20px', fill: 'white', fontWeight: 900, fontFamily: 'monospace' }}>
              {probPct.toFixed(0)}%
            </text>
            <text x="50" y="60" textAnchor="middle" style={{ fontSize: '8px', fill: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
              HR PROB
            </text>
          </svg>
        </div>

        {/* Odds column */}
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-[var(--foreground)]/35 mb-0.5">Fair Value Odds</p>
            <p className="text-3xl font-black text-[var(--foreground)] tabular-nums" style={{ color: heroColor }}>{fmtOdds(modelOdds)}</p>
          </div>
          {kellyRec !== null && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25">
              <span className="text-[9px] font-black text-blue-400">1/4 Kelly: {(kellyRec * 100).toFixed(1)}% stake</span>
            </div>
          )}
        </div>

        {/* Edge vs market */}
        {hasEdge ? (
          <div className={`shrink-0 text-center px-3 py-2.5 rounded-xl border ${
            edgePositive
              ? 'bg-blue-500/10 border-blue-500/25'
              : 'bg-rose-500/10 border-rose-500/25'
          }`}>
            <p className="text-[8px] font-black uppercase tracking-wider mb-0.5" style={{ color: edgePositive ? '#6ee7b7' : '#fda4af' }}>
              {edgePositive ? 'EDGE' : 'FADE'}
            </p>
            <p className={`text-lg font-black tabular-nums ${edgePositive ? 'text-blue-300' : 'text-rose-300'}`}>
              {fmtEdge(data.edge)}
            </p>
            <p className="text-[8px] text-[var(--foreground)]/30 mt-0.5">mkt: {fmtOdds(data.impliedOdds)}</p>
          </div>
        ) : (
          <div className="shrink-0 text-center px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <p className="text-[8px] font-black uppercase tracking-wider text-[var(--foreground)]/30 mb-0.5">MARKET</p>
            <p className="text-lg font-black tabular-nums text-[var(--foreground)]/60">{fmtOdds(data.impliedOdds ?? null)}</p>
          </div>
        )}
      </div>

      {/* ── Confidence interval range ── */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/35">Probability Range</span>
          <span className="text-[9px] font-bold text-[var(--foreground)]/50 tabular-nums">{(ciLo * 100).toFixed(1)}% – {(ciHi * 100).toFixed(1)}%</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
          <div
            className="absolute top-0 bottom-0 rounded-full bg-rose-500/50"
            style={{
              left: `${Math.min(100, (ciLo / CI_MAX) * 100)}%`,
              right: `${Math.max(0, 100 - (ciHi / CI_MAX) * 100)}%`,
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--foreground)]/70 rounded-full"
            style={{ left: `${Math.min(100, (data.probability / CI_MAX) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[8px] text-[var(--foreground)]/25 mt-1">
          <span>0%</span>
          <span>15%</span>
          <span>30%</span>
        </div>
      </div>

      {/* ── Component factor bars ── */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/35 mb-3">Factor Breakdown</p>
        {factors.map(f => {
          const [lo, hi] = f.range;
          const pct = Math.max(0, Math.min(100, ((f.value - lo) / (hi - lo)) * 100));
          const fc = FACTOR_COLORS[f.label];
          const barColor = fc?.bar ?? '#94a3b8';
          return (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--foreground)]/35 w-20 shrink-0">
                {fc?.label ?? f.label}
              </span>
              <div className="flex-1 h-1.5 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 6px ${barColor}60` }}
                />
              </div>
              <span className="text-[10px] font-black text-[var(--foreground)]/60 w-12 text-right tabular-nums shrink-0">
                {f.fmt ? f.fmt(f.value) : f.value.toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Warnings ── */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 space-y-1">
            {data.warnings.map((w, i) => (
              <p key={i} className="text-[10px] text-amber-300/80 flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-amber-400">!</span>
                <span>{w}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-[var(--border-subtle)]">
        <span className="text-[9px] text-[var(--foreground)]/20">LeverageMetrics v3 · platoon ±1 · pitch mix vuln</span>
        {data.dataSource && (
          <span className="text-[9px] text-[var(--foreground)]/20">{data.dataSource === 'statcast_db' ? 'Statcast' : 'MLB API'}</span>
        )}
      </div>
    </div>
  );
});
