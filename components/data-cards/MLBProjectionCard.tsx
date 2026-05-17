'use client';

import React, { useState, memo, useId } from 'react';
import Image from 'next/image';
import { TrendingUp, ChevronRight, Zap, Target, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayerHeadshotUrl } from '@/lib/constants';
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
    header: 'from-red-600/30 via-rose-900/15 to-transparent',
  },
  edge: {
    label: 'EDGE',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    header: 'from-emerald-600/30 via-teal-900/15 to-transparent',
  },
  value: {
    label: 'VALUE',
    dot: 'bg-blue-400',
    text: 'text-blue-400',
    bg: 'bg-blue-500/15 border-blue-500/30',
    header: 'from-blue-600/30 via-indigo-900/15 to-transparent',
  },
  neutral: {
    label: 'PROJ',
    dot: 'bg-[var(--text-faint)]',
    text: 'text-[var(--text-muted)]',
    bg: 'bg-[var(--bg-surface)] border-[var(--border-subtle)]',
    header: 'from-blue-600/25 via-indigo-800/10 to-transparent',
  },
};

// ─── Percentile bar ───────────────────────────────────────────────────────────

function PercentileBar({ p10, p50, p90, label }: { p10: number; p50: number; p90: number; label: string }) {
  const maxVal = Math.max(p90, 1);
  const p10Pct = (p10 / maxVal) * 100;
  const p50Pct = (p50 / maxVal) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/40">{label} Range</span>
        <span className="text-[9px] text-[var(--foreground)]/50 tabular-nums">P10: {p10} · P50: {p50} · P90: {p90}</span>
      </div>
      <div className="relative h-2 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
        <div
          className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-blue-500/40 to-emerald-500/60"
          style={{ left: `${p10Pct}%`, right: `${100 - (p90 / maxVal * 100)}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 rounded-full shadow-[0_0_4px_#10b981]"
          style={{ left: `${p50Pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[var(--foreground)]/40">
        <span>Floor</span>
        <span className="text-emerald-400 font-bold">Median</span>
        <span>Ceiling</span>
      </div>
    </div>
  );
}

// ─── Breakout score ring ──────────────────────────────────────────────────────

function BreakoutRing({ score }: { score: number }) {
  const color = score >= 70 ? '#fbbf24' : score >= 50 ? '#60a5fa' : '#6b7280';
  const label = score >= 70 ? 'BREAKOUT' : score >= 50 ? 'UPSIDE' : 'STABLE';
  const circumference = 2 * Math.PI * 20;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none" />
          <circle
            cx="24" cy="24" r="20"
            stroke={color}
            strokeWidth="4" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black text-[var(--foreground)]">{score}</span>
        </div>
      </div>
      <span className="text-[9px] font-black uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── DK Sparkline (recent form) ──────────────────────────────────────────────

function DKSparkline({ data, height = 28 }: { data: Array<{ price: number }>; height?: number }) {
  const uid = useId();
  if (data.length < 2) return null;
  const prices = data.map(d => d.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const viewW = 200;
  const pad = 2, innerH = height - pad * 2;
  const pts = prices.map((p, i) => [
    (i / (prices.length - 1)) * viewW,
    pad + innerH - ((p - min) / range) * innerH,
  ] as [number, number]);
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L ${viewW},${height} L 0,${height} Z`;
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? '#10b981' : '#94a3b8';
  const gid = `dksp-${uid.replace(/:/g, '')}`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${viewW} ${height}`} preserveAspectRatio="none" className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

function metricValueColor(label: string, value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'text-[var(--foreground)]';
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
  return 'text-[var(--foreground)]';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const MLBProjectionCard = memo(function MLBProjectionCard({ data, onAnalyze, isHero = false }: MLBProjectionCardProps) {
  const [showLightbox, setShowLightbox] = useState(false);
  const [headshotError, setHeadshotError] = useState(false);

  // Normalize data (handles both flat and nested formats)
  const playerName  = data.player_name ?? data.data?.player ?? data.title ?? 'Player';
  const team        = data.team ?? data.data?.team ?? '';
  const position    = data.position ?? data.data?.position ?? '';
  const projections = data.projections ?? {
    hr_proj:        parseFloat(data.data?.hrProb ?? '0') / 100,
    k_proj:         parseFloat(data.data?.kProj ?? '0'),
    breakout_score: parseInt(data.data?.breakoutScore ?? '0'),
  };
  const percentiles = data.percentiles ?? { p10: 0, p50: projections.hr_proj > 0 ? 1 : 0, p90: 1 };
  const metrics     = data.summary_metrics ?? [];
  const lightboxSections = data.lightbox?.sections ?? [];
  const matchupScore = data.matchup_score ?? 0;
  const trendNote   = data.trend_note ?? '';

  const recentDkPts  = data.data?.recentDKPts as string | undefined;
  const sparkData    = recentDkPts
    ? String(recentDkPts).split(',').map(v => ({ price: parseFloat(v.trim()) })).filter(d => !isNaN(d.price))
    : [];
  const recentAvgLabel = data.data?.recentGamesAvg as string | undefined;

  const homeDkAvg = data.data?.homeDKAvg as string | undefined;
  const roadDkAvg = data.data?.roadDKAvg as string | undefined;
  const homeGames = data.data?.homeSplitGames as string | undefined;
  const roadGames = data.data?.roadSplitGames as string | undefined;

  const statusKey = (data.status ?? 'neutral').toLowerCase();
  const cfg       = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.neutral;

  const isPitcher = position === 'SP' || position === 'RP';
  const hrPct     = +(projections.hr_proj * 100).toFixed(1);
  const kProj     = +projections.k_proj.toFixed(1);
  const breakout  = projections.breakout_score;

  const hero1 = isPitcher
    ? { label: 'K/Game', value: `${kProj}` }
    : { label: 'HR Prob', value: `${hrPct}%` };

  const hero2 = { label: 'DFS Score', value: `${(matchupScore * 100).toFixed(0)}/100` };
  const dkPts = metrics.find(m => m.label === 'DK Proj Pts')?.value;

  const breakoutColor = breakout >= 70 ? '#fbbf24' : breakout >= 50 ? '#60a5fa' : 'rgba(255,255,255,0.3)';

  return (
    <>
      <article className={cn(
        'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300',
        isHero
          ? 'border-blue-500/30 shadow-[0_0_32px_rgba(59,130,246,0.12)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_24px_rgba(59,130,246,0.10)]',
      )}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className={cn('relative px-4 pr-10 pt-4 pb-3 bg-gradient-to-br border-b border-[var(--border-subtle)]', cfg.header)}>
          {/* Sport chip + status badge — inline, no absolute, clears bookmark overlay */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Activity className="w-3 h-3 text-[var(--foreground)]/40 shrink-0" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/40">MLB · LeverageMetrics</span>
              {data.subcategory && <><span className="text-[var(--foreground)]/20">·</span><span className="text-[9px] text-[var(--foreground)]/30 truncate">{data.subcategory}</span></>}
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-elevated)] backdrop-blur-sm border border-[var(--border-subtle)] shrink-0">
              <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', cfg.dot)} />
              <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.text)}>{cfg.label}</span>
            </div>
          </div>

          {/* Hero player section — headshot + name */}
          <div className="flex items-center gap-3">
            {(() => {
              const headshotUrl = getPlayerHeadshotUrl(playerName);
              if (!headshotUrl || headshotError) return null;
              return (
                <div className="relative shrink-0">
                  <Image
                    src={headshotUrl} alt={playerName}
                    width={isHero ? 56 : 44} height={isHero ? 56 : 44}
                    className={cn(
                      'rounded-2xl object-cover bg-[var(--bg-elevated)] border border-[var(--border-subtle)]',
                      isHero ? 'w-14 h-14' : 'w-11 h-11',
                    )}
                    onError={() => setHeadshotError(true)}
                    unoptimized
                  />
                </div>
              );
            })()}
            <div className="min-w-0 flex-1">
              {team && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/30 text-[9px] font-black text-blue-300 uppercase tracking-wider mb-1">
                  {team}{position ? ` · ${position}` : ''}
                </span>
              )}
              <h3
                className={cn(
                  'font-black text-[var(--foreground)] leading-tight',
                  isHero ? 'text-xl' : 'text-base',
                  onAnalyze && 'cursor-pointer hover:text-blue-300 transition-colors',
                )}
                onClick={onAnalyze}
                title={onAnalyze ? `Analyze ${playerName}` : undefined}
              >
                {playerName}
              </h3>
              {!team && position && (
                <p className="text-[10px] font-bold text-[var(--foreground)]/40 mt-0.5">{position}</p>
              )}
            </div>
            {breakout > 0 && <BreakoutRing score={breakout} />}
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3 pt-3">

          {/* ── Hero metrics 2×2 tile grid ──────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: hero1.label, value: hero1.value, accent: 'blue' as const, large: true },
              { label: hero2.label, value: hero2.value, accent: 'indigo' as const, large: true },
              ...(dkPts ? [{ label: 'DK Pts', value: dkPts, accent: 'emerald' as const, large: false }] : []),
              ...(kProj > 0 && !isPitcher ? [{ label: 'K Proj', value: `${kProj}`, accent: 'slate' as const, large: false }] : []),
            ].map((tile, index) => (
              <StatTile
                key={tile.label}
                label={tile.label}
                value={tile.value}
                accent={tile.accent}
                large={tile.large}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 80}ms` }}
              />
            ))}
          </div>

          {/* ── Breakout score bar ──────────────────────────────────── */}
          {breakout > 0 && (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/40">Breakout Score</span>
                <span className="text-[11px] font-black tabular-nums" style={{ color: breakoutColor }}>{breakout}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${breakout}%`, background: breakout >= 70 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : breakout >= 50 ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : 'rgba(100,116,139,0.6)' }}
                />
              </div>
            </div>
          )}

          {/* ── Percentile bar ──────────────────────────────────────── */}
          {(percentiles.p10 !== undefined || percentiles.p90 > 0) && (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
              <PercentileBar
                p10={percentiles.p10}
                p50={percentiles.p50}
                p90={percentiles.p90}
                label={isPitcher ? 'K' : 'HR'}
              />
            </div>
          )}

          {/* ── Recent form sparkline with dots ─────────────────────── */}
          {sparkData.length >= 3 && (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--foreground)]/40">Recent Form</span>
                {recentAvgLabel && (
                  <span className="text-[9px] font-bold text-[var(--foreground)]/50">{recentAvgLabel}</span>
                )}
              </div>
              <DKSparkline data={sparkData} height={28} />
            </div>
          )}

          {/* ── Home / road splits ─────────────────────────────────── */}
          {(homeDkAvg || roadDkAvg) && (
            <div className="grid grid-cols-2 gap-2">
              {homeDkAvg && (
                <div className="flex flex-col items-center gap-0.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-2.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400/60">Home</span>
                  <span className="text-base font-black text-[var(--foreground)] tabular-nums">{homeDkAvg}</span>
                  {homeGames && <span className="text-[9px] text-[var(--foreground)]/30">{homeGames}</span>}
                </div>
              )}
              {roadDkAvg && (
                <div className="flex flex-col items-center gap-0.5 rounded-xl bg-slate-500/8 border border-slate-500/20 px-3 py-2.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400/60">Road</span>
                  <span className="text-base font-black text-[var(--foreground)] tabular-nums">{roadDkAvg}</span>
                  {roadGames && <span className="text-[9px] text-[var(--foreground)]/30">{roadGames}</span>}
                </div>
              )}
            </div>
          )}

          {/* ── Percentile rank bars for summary metrics ──────────── */}
          {metrics.length > 0 && (
            <div className="space-y-1.5">
              {metrics.slice(0, isHero ? 6 : 4).map((m, i) => {
                const isPercent = String(m.value).endsWith('%');
                const numVal = parseFloat(String(m.value));
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <span className="text-[9px] text-[var(--foreground)]/40 uppercase tracking-wide">{m.label}</span>
                    <div className="flex items-center gap-2">
                      {isPercent && !isNaN(numVal) && (
                        <div className="h-1 w-16 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, numVal)}%`,
                              background: numVal >= 60 ? '#10b981' : numVal >= 40 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                      )}
                      <span className={cn('text-[10px] font-black tabular-nums', metricValueColor(m.label, String(m.value)))}>{m.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Trend note ─────────────────────────────────────────── */}
          {trendNote && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 animate-fade-in-up animate-delay-225">
              <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-300/80 leading-relaxed line-clamp-2">{trendNote}</p>
            </div>
          )}

          {/* ── CTA row ────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-1">
            {lightboxSections.length > 0 && (
              <button
                onClick={() => setShowLightbox(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--foreground)]/40 hover:text-[var(--foreground)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-default)] transition-all duration-150 hover:scale-105 active:scale-95 transition-transform"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Full Breakdown
              </button>
            )}
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs font-semibold text-blue-300 hover:bg-blue-500/25 hover:border-blue-400/50 transition-all duration-150 hover:scale-105 active:scale-95 transition-transform"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Analyze
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── Data source badge ─────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1">
              <Target className="w-2.5 h-2.5 text-[var(--foreground)]/20" />
              <span className="text-[9px] font-bold text-[var(--foreground)]/20 uppercase tracking-wider">LeverageMetrics Engine</span>
            </div>
            <div className="flex items-center gap-2">
              {data.last_updated && (
                <span className="text-[9px] text-[var(--foreground)]/20">{data.last_updated}</span>
              )}
              <span className="text-[9px] text-[var(--foreground)]/20">Monte Carlo N=1,000</span>
            </div>
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

function StatTile({ label, value, accent = 'blue', large = false, className, style }: { label: string; value: string; accent?: 'blue' | 'indigo' | 'emerald' | 'slate'; large?: boolean; className?: string; style?: React.CSSProperties }) {
  const accentMap = {
    blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-300'   },
    indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-300' },
    emerald:{ bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',text: 'text-emerald-300' },
    slate:  { bg: 'bg-[var(--bg-elevated)]', border: 'border-[var(--border-subtle)]', text: 'text-[var(--foreground)]/70' },
  };
  const a = accentMap[accent];
  return (
    <div className={cn('flex flex-col items-center rounded-xl border px-2 py-3', a.bg, a.border, className)} style={style}>
      <span className="text-[8px] font-black uppercase tracking-widest text-[var(--foreground)]/35 mb-1">{label}</span>
      <span className={cn('font-black tabular-nums', large ? 'text-xl' : 'text-base', a.text)}>
        {value}
      </span>
    </div>
  );
}
