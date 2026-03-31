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
  // Approximate American odds from probability (no vig)
  if (prob >= 0.5) return -Math.round((prob / (1 - prob)) * 100);
  return Math.round(((1 - prob) / prob) * 100);
}

const CONFIDENCE_CONFIG = {
  high:   { label: 'High',   color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  medium: { label: 'Medium', color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30'   },
  low:    { label: 'Low',    color: 'text-rose-400',    bg: 'bg-rose-500/15',     border: 'border-rose-500/30'   },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const HRPredictionCard = memo(function HRPredictionCard({ data }: HRPredictionCardProps) {
  // Error state
  if (!data.success && data.error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        <p className="font-semibold mb-1">⚠ HR Prediction unavailable</p>
        <p className="text-rose-400/80">{data.error}</p>
      </div>
    );
  }

  const confCfg      = CONFIDENCE_CONFIG[data.confidence ?? 'low'];
  const modelOdds    = impliedFromProb(data.probability);
  const hasEdge      = data.impliedOdds != null && Math.abs(data.edge) > 0.005;
  const edgePositive = data.edge > 0;

  // Circular gauge
  const CIRC = 2 * Math.PI * 40; // r=40
  const gaugeStroke = edgePositive ? '#10b981' : data.edge < -0.02 ? '#f43f5e' : '#94a3b8';
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

  // Component breakdown bars (relative to each factor's typical range)
  const factors: Array<{ label: string; value: number; range: [number, number]; fmt?: (v: number) => string }> = [
    { label: 'Base Rate',      value: data.components.baseRate,      range: [0, 0.20],       fmt: fmtPct  },
    { label: 'Park Factor',    value: data.components.parkFactor,    range: [0.85, 1.35],    fmt: v => v.toFixed(2) },
    { label: 'Weather',        value: data.components.weatherFactor, range: [0.85, 1.25],    fmt: v => v.toFixed(2) },
    { label: 'Matchup',        value: data.components.matchupFactor, range: [0.70, 1.80],    fmt: v => v.toFixed(2) },
    ...(data.components.mlAdjusted !== undefined
      ? [{ label: 'ML Adjusted', value: data.components.mlAdjusted, range: [0.80, 1.20] as [number, number], fmt: (v: number) => v.toFixed(2) }]
      : []),
  ];

  // Confidence interval
  const ciHalf = data.confidence === 'high' ? 0.03 : data.confidence === 'medium' ? 0.07 : 0.12;
  const ciLo   = Math.max(0, data.probability - ciHalf);
  const ciHi   = Math.min(1, data.probability + ciHalf);
  const CI_MAX = 0.30; // track represents 0–30% probability range

  return (
    <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-600/20 via-red-900/15 to-slate-900/40 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">💣</span>
          <div>
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">HR Prop — v3 Engine</p>
            <p className="text-white font-bold text-base leading-tight">{data.player}</p>
          </div>
        </div>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${confCfg.bg} ${confCfg.border} ${confCfg.color}`}>
          {confCfg.label} confidence
        </div>
      </div>

      {/* Venue / pitcher strip */}
      {(data.pitcherName || data.venue || data.gameTime) && (
        <div className="px-4 pb-2 text-xs text-slate-400 flex items-center gap-3 flex-wrap">
          {data.pitcherName && <span>vs {data.pitcherName}</span>}
          {data.venue && <span>· {data.venue}</span>}
          {data.gameTime && <span>· {data.gameTime}</span>}
          {data.dataSource === 'mlb_api_fallback' && (
            <span className="text-amber-500/70">· estimated</span>
          )}
        </div>
      )}

      {/* Primary probability */}
      <div className="px-4 py-3 flex items-center gap-4 border-t border-rose-500/10">
        {/* Circular gauge */}
        <svg viewBox="0 0 100 100" className="w-20 h-20 shrink-0" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={gaugeStroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={gaugeDashOffset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
          <text x="50" y="47" textAnchor="middle" style={{ fontSize: '18px', fill: 'white', fontWeight: 900 }}>
            {(data.probability * 100).toFixed(0)}%
          </text>
          <text x="50" y="62" textAnchor="middle" style={{ fontSize: '8px', fill: 'rgba(148,163,184,0.7)' }}>
            HR PROB
          </text>
        </svg>

        <div className="flex-1">
          <p className="text-xs text-slate-400 mb-0.5">Fair odds</p>
          <p className="text-2xl font-black text-white tabular-nums">{fmtOdds(modelOdds)}</p>
          {kellyRec !== null && (
            <p className="text-[10px] text-emerald-400/80 mt-1">
              ¼ Kelly: {(kellyRec * 100).toFixed(1)}% stake
            </p>
          )}
        </div>

        {/* Edge vs market */}
        {hasEdge && (
          <div className={`ml-auto text-right px-3 py-2 rounded-lg border ${
            edgePositive
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : 'bg-rose-500/10   border-rose-500/25   text-rose-400'
          }`}>
            <p className="text-xs font-medium opacity-70 mb-0.5">Edge vs market</p>
            <p className="text-lg font-bold tabular-nums">{fmtEdge(data.edge)}</p>
            <p className="text-xs opacity-60">mkt: {fmtOdds(data.impliedOdds)}</p>
          </div>
        )}

        {!hasEdge && (
          <div className="ml-auto text-right px-3 py-2 rounded-lg border border-slate-700/40 bg-slate-800/20 text-slate-500">
            <p className="text-xs font-medium mb-0.5">Market odds</p>
            <p className="text-lg font-bold tabular-nums">{fmtOdds(data.impliedOdds ?? null)}</p>
          </div>
        )}
      </div>

      {/* Confidence interval range */}
      <div className="px-4 py-2.5 border-t border-rose-500/10">
        <div className="flex justify-between items-center mb-1 text-[9px]">
          <span className="text-slate-500 uppercase tracking-wider">Probability Range ({data.confidence} confidence)</span>
          <span className="text-slate-400 font-bold">{(ciLo * 100).toFixed(1)}% – {(ciHi * 100).toFixed(1)}%</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 rounded-full bg-rose-500/50"
            style={{
              left: `${Math.min(100, (ciLo / CI_MAX) * 100)}%`,
              right: `${Math.max(0, 100 - (ciHi / CI_MAX) * 100)}%`,
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/70"
            style={{ left: `${Math.min(100, (data.probability / CI_MAX) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
          <span>0%</span>
          <span>15%</span>
          <span>30%</span>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="px-4 py-3 border-t border-rose-500/10 space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Factor breakdown</p>
        {factors.map(f => {
          const [lo, hi] = f.range;
          const pct = Math.max(0, Math.min(100, ((f.value - lo) / (hi - lo)) * 100));
          const isNeutral = Math.abs(f.value - 1.0) < 0.02 && f.label !== 'Base Rate';
          const barColor = isNeutral
            ? 'bg-slate-500'
            : f.value >= 1.0 || f.label === 'Base Rate'
            ? 'bg-rose-500'
            : 'bg-slate-600';

          return (
            <div key={f.label} className="flex items-center gap-3">
              <p className="text-xs text-slate-400 w-24 flex-shrink-0">{f.label}</p>
              <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs font-mono text-slate-300 w-12 text-right flex-shrink-0">
                {f.fmt ? f.fmt(f.value) : f.value.toFixed(3)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="px-4 pb-4 pt-1">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1">
            {data.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-400/80 flex items-start gap-1.5">
                <span className="mt-0.5 flex-shrink-0">⚠</span>
                <span>{w}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between text-xs text-slate-600">
        <span>LeverageMetrics v3 · platoon ±1 · pitch mix vuln</span>
        {data.dataSource && (
          <span>{data.dataSource === 'statcast_db' ? '⚾ Statcast' : '🌐 MLB API'}</span>
        )}
      </div>
    </div>
  );
});
