'use client';

import { useState, memo } from 'react';
import { TrendingUp, ChevronRight, Zap, Target, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisLightbox } from './AnalysisLightbox';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LightboxMetric { label: string; value: string }
interface LightboxSection { title: string; metrics: LightboxMetric[] }

interface MLBProjectionCardProps {
  data: {
    type: string;
    title: string;
    category: string;
    subcategory: string;
    gradient: string;
    status: string;
    realData?: boolean;
    player_id?: number;
    player_name?: string;
    team?: string;
    position?: string;
    projections?: { hr_proj: number; k_proj: number; breakout_score: number };
    percentiles?: { p10: number; p50: number; p90: number };
    matchup_score?: number;
    summary_metrics?: LightboxMetric[];
    lightbox?: { sections: LightboxSection[] };
    trend_note?: string;
    last_updated?: string;
    // Flat data fallback (from AI JSON output)
    data?: Record<string, any>;
    [key: string]: any;
  };
  onAnalyze?: () => void;
  isHero?: boolean;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; header: string }> = {
  hot: {
    label: 'HOT',
    dot: 'bg-red-400',
    text: 'text-red-400',
    bg: 'bg-red-500/15 border-red-500/30',
    header: 'from-red-600/75 via-rose-900/55 to-slate-900/40',
  },
  edge: {
    label: 'EDGE',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    header: 'from-emerald-600/75 via-teal-900/55 to-slate-900/40',
  },
  value: {
    label: 'VALUE',
    dot: 'bg-blue-400',
    text: 'text-blue-400',
    bg: 'bg-blue-500/15 border-blue-500/30',
    header: 'from-blue-600/75 via-indigo-900/55 to-slate-900/40',
  },
  neutral: {
    label: 'PROJ',
    dot: 'bg-gray-400',
    text: 'text-gray-400',
    bg: 'bg-gray-500/15 border-gray-500/30',
    header: 'from-slate-600/75 via-gray-900/55 to-slate-900/40',
  },
};

// ─── Percentile bar ───────────────────────────────────────────────────────────

function PercentileBar({ p10, p50, p90, label }: { p10: number; p50: number; p90: number; label: string }) {
  const maxVal = Math.max(p90, 1);
  const p10Pct  = (p10 / maxVal) * 100;
  const p50Pct  = (p50 / maxVal) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label} Range</span>
      </div>
      <div className="relative h-4 bg-[oklch(0.10_0.01_280)] rounded-full overflow-hidden">
        {/* P10–P90 range bar */}
        <div
          className="absolute top-0 bottom-0 bg-gradient-to-r from-slate-500/40 to-emerald-500/40 rounded-full"
          style={{ left: `${p10Pct}%`, right: `${100 - (p90 / maxVal * 100)}%` }}
        />
        {/* P50 marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 rounded-full"
          style={{ left: `${p50Pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] font-bold text-gray-500">
        <span>P10: {p10}</span>
        <span className="text-emerald-400">P50: {p50}</span>
        <span>P90: {p90}</span>
      </div>
    </div>
  );
}

// ─── Breakout score ring ──────────────────────────────────────────────────────

function BreakoutRing({ score }: { score: number }) {
  const color = score >= 70 ? 'text-amber-400' : score >= 50 ? 'text-blue-400' : 'text-gray-500';
  const label = score >= 70 ? 'BREAKOUT' : score >= 50 ? 'UPSIDE' : 'STABLE';
  const circumference = 2 * Math.PI * 20;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-12 h-12">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" stroke="oklch(0.18 0.01 280)" strokeWidth="4" fill="none" />
          <circle
            cx="24" cy="24" r="20"
            stroke={score >= 70 ? '#fbbf24' : score >= 50 ? '#60a5fa' : '#6b7280'}
            strokeWidth="4" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-[11px] font-black', color)}>{score}</span>
        </div>
      </div>
      <span className={cn('text-[8px] font-black uppercase tracking-wider', color)}>{label}</span>
    </div>
  );
}

function metricValueColor(label: string, value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'text-white';
  const lo = label.toLowerCase();
  if (lo.includes('barrel') || lo.includes(' ev') || lo.includes('hard') || lo.includes('k/9') || lo.includes('strikeout') || lo.includes('csw') || lo.includes('swstr') || lo.includes('stuff')) {
    return num >= 12 ? 'text-emerald-400' : num >= 7 ? 'text-amber-400' : 'text-red-400';
  }
  if (lo.includes('era') || lo.includes('whip') || lo.includes('walk') || lo.includes('bb%') || lo.includes('chase')) {
    return num <= 3 ? 'text-emerald-400' : num <= 4.5 ? 'text-amber-400' : 'text-red-400';
  }
  if (value.endsWith('%')) {
    return num >= 60 ? 'text-emerald-400' : num >= 40 ? 'text-amber-400' : 'text-red-400';
  }
  return 'text-white';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const MLBProjectionCard = memo(function MLBProjectionCard({ data, onAnalyze, isHero = false }: MLBProjectionCardProps) {
  const [showLightbox, setShowLightbox] = useState(false);

  // Normalize data (handles both flat and nested formats)
  const playerName   = data.player_name ?? data.data?.player ?? data.title ?? 'Player';
  const team         = data.team ?? data.data?.team ?? '';
  const position     = data.position ?? data.data?.position ?? '';
  const projections  = data.projections ?? {
    hr_proj:       parseFloat(data.data?.hrProb ?? '0') / 100,
    k_proj:        parseFloat(data.data?.kProj ?? '0'),
    breakout_score:parseInt(data.data?.breakoutScore ?? '0'),
  };
  const percentiles  = data.percentiles ?? { p10: 0, p50: projections.hr_proj > 0 ? 1 : 0, p90: 1 };
  const metrics      = data.summary_metrics ?? [];
  const lightboxSections = data.lightbox?.sections ?? [];
  const matchupScore = data.matchup_score ?? 0;
  const trendNote    = data.trend_note ?? '';

  const statusKey    = (data.status ?? 'neutral').toLowerCase();
  const cfg          = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.neutral;

  const isPitcher    = position === 'SP' || position === 'RP';
  const hrPct        = +(projections.hr_proj * 100).toFixed(1);
  const kProj        = +projections.k_proj.toFixed(1);
  const breakout     = projections.breakout_score;

  // Primary hero metrics (3 shown)
  const hero1 = isPitcher
    ? { label: 'K/Game', value: `${kProj}` }
    : { label: 'HR Prob', value: `${hrPct}%` };

  const hero2 = { label: 'DFS Score', value: `${(matchupScore * 100).toFixed(0)}/100` };

  const dkPts = metrics.find(m => m.label === 'DK Proj Pts')?.value;

  return (
    <>
      <article className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
        isHero
          ? 'border-[oklch(0.30_0.03_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.18)]'
          : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.10)]',
      )}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', data.gradient || cfg.header)}>
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', cfg.dot)} />
            <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.text)}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Activity className="w-3 h-3 text-white/60" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">MLB · LeverageMetrics</span>
            <span className="text-white/30">·</span>
            <span className="text-[9px] text-white/50 truncate">{data.subcategory}</span>
          </div>
          <div className="flex items-start justify-between gap-2 pr-16">
            <div>
              <h3
                className={cn(
                  'font-black text-white leading-tight',
                  isHero ? 'text-lg' : 'text-sm',
                  onAnalyze && 'cursor-pointer hover:text-blue-300 transition-colors',
                )}
                onClick={onAnalyze}
                title={onAnalyze ? `Analyze ${playerName}` : undefined}
              >
                {playerName}
              </h3>
              {(team || position) && (
                <p className="text-[9px] font-bold text-white/50 mt-0.5">
                  {team}{team && position ? ' · ' : ''}{position}
                </p>
              )}
            </div>
            {isPitcher && breakout > 0 && (
              <BreakoutRing score={breakout} />
            )}
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* ── Hero metrics strip ─────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <MetricBox label={hero1.label} value={hero1.value} highlight />
            <MetricBox label={hero2.label} value={hero2.value} />
            {dkPts && <MetricBox label="DK Pts" value={dkPts} />}
          </div>

          {/* ── Percentile bar ──────────────────────────────────────────── */}
          {(percentiles.p10 !== undefined || percentiles.p90 > 0) && (
            <div className="px-3 py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)]">
              <PercentileBar
                p10={percentiles.p10}
                p50={percentiles.p50}
                p90={percentiles.p90}
                label={isPitcher ? 'K' : 'HR'}
              />
            </div>
          )}

          {/* ── Summary metrics ────────────────────────────────────────── */}
          {metrics.length > 0 && (
            <div className="space-y-1">
              {metrics.slice(0, isHero ? 6 : 4).map((m, i) => {
                const isPercent = String(m.value).endsWith('%');
                const numVal = parseFloat(String(m.value));
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[oklch(0.08_0.01_280)]">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">{m.label}</span>
                    <div className="flex flex-col items-end gap-0.5 min-w-[3rem]">
                      <span className={cn('text-[10px] font-black tabular-nums', metricValueColor(m.label, String(m.value)))}>{m.value}</span>
                      {isPercent && !isNaN(numVal) && (
                        <div className="h-0.5 w-10 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', numVal >= 60 ? 'bg-emerald-500' : numVal >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(100, numVal)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Trend note ─────────────────────────────────────────────── */}
          {trendNote && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2">{trendNote}</p>
            </div>
          )}

          {/* ── CTA row ────────────────────────────────────────────────── */}
          <div className="flex gap-2">
            {lightboxSections.length > 0 && (
              <button
                onClick={() => setShowLightbox(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-gray-500 hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Full Breakdown
              </button>
            )}
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-gray-500 hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Analyze
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── Data source badge ─────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-800/50">
            <div className="flex items-center gap-1">
              <Target className="w-2.5 h-2.5 text-gray-700" />
              <span className="text-[8px] font-bold text-gray-700 uppercase tracking-wider">LeverageMetrics Engine</span>
            </div>
            <span className="text-[8px] text-gray-700">Monte Carlo N=1,000</span>
          </div>
        </div>
      </article>

      {/* Lightbox */}
      <AnalysisLightbox
        open={showLightbox && lightboxSections.length > 0}
        onClose={() => setShowLightbox(false)}
        title={`${playerName} — Full Breakdown`}
        sections={lightboxSections}
        accentText={cfg.text}
        accentBg={cfg.bg.split(' ')[0]}
        accentBorder={cfg.bg.split(' ')[1] ?? 'border-blue-500/30'}
      />
    </>
  );
});

// ─── Sub-component ────────────────────────────────────────────────────────────

function MetricBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.16_0.015_280)] px-2 py-2.5">
      <span className="text-[7px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
      <span className={cn('text-sm font-black tabular-nums', highlight ? 'text-emerald-400' : 'text-white')}>
        {value}
      </span>
    </div>
  );
}
