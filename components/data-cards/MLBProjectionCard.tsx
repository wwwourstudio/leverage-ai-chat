'use client';

import React, { useState, useCallback, memo, useId } from 'react';
import Image from 'next/image';
import { TrendingUp, ChevronRight, Zap, Target, Activity, BarChart3, Bookmark } from 'lucide-react';
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
    data?: Record<string, any>;
    [key: string]: any;
  };
  onAnalyze?: () => void;
  isHero?: boolean;
}

// ─── Status / accent config ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string;
  dot: string;
  dotCls: string;
  textCls: string;
  borderCls: string;
  bgCls: string;
  gradient: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
}> = {
  hot: {
    label: 'HOT',
    dot: '#f87171',
    dotCls: 'bg-red-400',
    textCls: 'text-red-400',
    borderCls: 'border-red-500/30',
    bgCls: 'bg-red-500/15',
    gradient: 'from-red-500/5 dark:from-red-600/20 dark:via-rose-900/10 to-transparent',
    accentBorder: 'border-red-500/30',
    accentBg: 'bg-red-500/10',
    accentText: 'text-red-400',
  },
  edge: {
    label: 'EDGE',
    dot: '#60a5fa',
    dotCls: 'bg-blue-400',
    textCls: 'text-blue-400',
    borderCls: 'border-blue-500/30',
    bgCls: 'bg-blue-500/15',
    gradient: 'from-blue-500/5 dark:from-blue-600/20 dark:via-teal-900/10 to-transparent',
    accentBorder: 'border-blue-500/30',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-400',
  },
  value: {
    label: 'VALUE',
    dot: '#60a5fa',
    dotCls: 'bg-blue-400',
    textCls: 'text-blue-400',
    borderCls: 'border-blue-500/30',
    bgCls: 'bg-blue-500/15',
    gradient: 'from-blue-500/5 dark:from-indigo-600/20 dark:via-indigo-900/10 to-transparent',
    accentBorder: 'border-blue-500/30',
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-400',
  },
  neutral: {
    label: 'PROJ',
    dot: '#94a3b8',
    dotCls: 'bg-slate-400',
    textCls: 'text-[var(--text-muted)]',
    borderCls: 'border-[var(--border-subtle)]',
    bgCls: 'bg-[var(--bg-surface)]',
    gradient: 'from-blue-500/3 dark:from-indigo-800/15 to-transparent',
    accentBorder: 'border-[var(--border-subtle)]',
    accentBg: 'bg-[var(--bg-elevated)]',
    accentText: 'text-[var(--text-muted)]',
  },
};

// ─── Watchlist hook ───────────────────────────────────────────────────────────

const WATCHLIST_KEY = 'leverage_watchlist';
interface WatchlistEntry { name: string; team?: string; position: string; addedAt: string; }

function useWatchlist(playerName: string) {
  const [watched, setWatched] = useState<boolean>(() => {
    try {
      const list: WatchlistEntry[] = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
      return list.some(e => e.name === playerName);
    } catch { return false; }
  });

  const toggle = useCallback(() => {
    setWatched(prev => {
      const next = !prev;
      try {
        const list: WatchlistEntry[] = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
        const updated = next
          ? [...list, { name: playerName, position: 'SP', addedAt: new Date().toISOString() }]
          : list.filter(e => e.name !== playerName);
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: updated.length } }));
      } catch {}
      return next;
    });
  }, [playerName]);

  return { watched, toggle };
}

// ─── Percentile bar ───────────────────────────────────────────────────────────

function PercentileBar({ p10, p50, p90, label }: { p10: number; p50: number; p90: number; label: string }) {
  const maxVal = Math.max(p90, 1);
  const p10Pct = (p10 / maxVal) * 100;
  const p50Pct = (p50 / maxVal) * 100;
  const p90Pct = 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">{label} Range</span>
        <span className="text-[9px] text-[var(--text-faint)] tabular-nums">P10: {p10} · P50: {p50} · P90: {p90}</span>
      </div>
      <div className="relative h-2 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
        {/* Floor-to-ceiling span */}
        <div
          className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-blue-500/40 to-blue-500/60"
          style={{ left: `${p10Pct}%`, right: `${100 - p90Pct}%` }}
        />
        {/* Median marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 rounded-full shadow-[0_0_4px_theme(colors.emerald.400)]"
          style={{ left: `${p50Pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[var(--text-faint)]">
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
  const labelCls = score >= 70 ? 'text-amber-400' : score >= 50 ? 'text-blue-400' : 'text-[var(--text-faint)]';
  const scoreCls = score >= 70 ? 'text-amber-300' : score >= 50 ? 'text-blue-300' : 'text-[var(--text-muted)]';
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
          <span className={cn('text-[11px] font-black', scoreCls)}>{score}</span>
        </div>
      </div>
      <span className={cn('text-[9px] font-black uppercase tracking-wider', labelCls)}>{label}</span>
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

function metricBarCls(numVal: number): string {
  return numVal >= 60 ? 'bg-emerald-500' : numVal >= 40 ? 'bg-amber-500' : 'bg-red-500';
}

function metricValueColor(label: string, value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'text-foreground';
  const lo = label.toLowerCase();
  if (lo.includes('barrel') || lo.includes(' ev') || lo.includes('hard') || lo.includes('k/9') || lo.includes('strikeout') || lo.includes('csw') || lo.includes('swstr') || lo.includes('stuff')) {
    return num >= 12 ? 'text-blue-400' : num >= 7 ? 'text-amber-400' : 'text-red-400';
  }
  if (lo.includes('era') || lo.includes('whip') || lo.includes('walk') || lo.includes('bb%') || lo.includes('chase')) {
    return num <= 3 ? 'text-blue-400' : num <= 4.5 ? 'text-amber-400' : 'text-red-400';
  }
  if (value.endsWith('%')) {
    return num >= 60 ? 'text-blue-400' : num >= 40 ? 'text-amber-400' : 'text-red-400';
  }
  return 'text-foreground';
}

// ─── Breakout bar ─────────────────────────────────────────────────────────────

function BreakoutBar({ score }: { score: number }) {
  const barCls = score >= 70
    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
    : score >= 50
      ? 'bg-gradient-to-r from-blue-500 to-blue-400'
      : 'bg-slate-500/60';
  const textCls = score >= 70 ? 'text-amber-400' : score >= 50 ? 'text-blue-400' : 'text-[var(--text-faint)]';

  return (
    <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Breakout Score</span>
        <span className={cn('text-[11px] font-black tabular-nums', textCls)}>{score}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barCls)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const MLBProjectionCard = memo(function MLBProjectionCard({ data, onAnalyze, isHero = false }: MLBProjectionCardProps) {
  const [showLightbox, setShowLightbox] = useState(false);
  const [headshotError, setHeadshotError] = useState(false);

  const playerName  = data.player_name ?? data.data?.player ?? data.title ?? 'Player';
  const team        = data.team ?? data.data?.team ?? '';
  const position    = data.position ?? data.data?.position ?? '';
  const projections = data.projections ?? {
    hr_proj:        parseFloat(data.data?.hrProb ?? '0') / 100,
    k_proj:         parseFloat(data.data?.kProj ?? '0'),
    breakout_score: parseInt(data.data?.breakoutScore ?? '0'),
  };
  const percentiles    = data.percentiles ?? { p10: 0, p50: projections.hr_proj > 0 ? 1 : 0, p90: 1 };
  const metrics        = data.summary_metrics ?? [];
  const lightboxSections = data.lightbox?.sections ?? [];
  const matchupScore   = data.matchup_score ?? 0;
  const trendNote      = data.trend_note ?? '';

  const sparkData = (() => {
    const raw = data.data?.recentDKPts as string | undefined;
    return raw
      ? String(raw).split(',').map(v => ({ price: parseFloat(v.trim()) })).filter(d => !isNaN(d.price))
      : [];
  })();
  const recentAvgLabel = data.data?.recentGamesAvg as string | undefined;
  const homeDkAvg  = data.data?.homeDKAvg as string | undefined;
  const roadDkAvg  = data.data?.roadDKAvg as string | undefined;
  const homeGames  = data.data?.homeSplitGames as string | undefined;
  const roadGames  = data.data?.roadSplitGames as string | undefined;

  const statusKey  = (data.status ?? 'neutral').toLowerCase();
  const cfg        = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.neutral;

  const isPitcher  = position === 'SP' || position === 'RP';
  const hrPct      = +(projections.hr_proj * 100).toFixed(1);
  const kProj      = +projections.k_proj.toFixed(1);
  const breakout   = projections.breakout_score;

  const hero1  = isPitcher ? { label: 'K/Game', value: `${kProj}` } : { label: 'HR Prob', value: `${hrPct}%` };
  const hero2  = { label: 'DFS Score', value: `${(matchupScore * 100).toFixed(0)}/100` };
  const dkPts  = metrics.find(m => m.label === 'DK Proj Pts')?.value;

  const headshotUrl = getPlayerHeadshotUrl(playerName);

  const { watched, toggle: toggleWatch } = useWatchlist(playerName);

  return (
    <>
      <article className={cn(
        'group relative rounded-2xl border transition-all duration-300',
        'bg-gradient-to-br', cfg.gradient,
        'backdrop-blur-sm',
        cfg.accentBorder,
        'shadow-xl shadow-black/20',
        'hover:shadow-2xl hover:shadow-black/30 hover:scale-[1.01]',
        isHero ? 'p-6' : 'p-4',
      )}>
        {/* Inner glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 mb-4 relative">
          <div className="flex items-center gap-3 min-w-0">
            {/* Headshot */}
            <div className={cn(
              'flex items-center justify-center flex-shrink-0 rounded-2xl overflow-hidden',
              cfg.accentBg, 'border', cfg.accentBorder,
              'shadow-lg',
              isHero ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg',
            )}>
              {headshotUrl && !headshotError ? (
                <Image
                  src={headshotUrl} alt={playerName}
                  width={isHero ? 48 : 40} height={isHero ? 48 : 40}
                  className="w-full h-full object-cover"
                  onError={() => setHeadshotError(true)}
                  unoptimized
                />
              ) : '⚾'}
            </div>

            {/* Title block */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Activity className={cn('w-2.5 h-2.5 shrink-0', cfg.accentText)} />
                <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.accentText)}>
                  {data.category ?? 'MLB'}
                </span>
                {data.subcategory && (
                  <>
                    <span className="text-[9px] text-[var(--border-subtle)]">·</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{data.subcategory}</span>
                  </>
                )}
              </div>
              <h3
                className={cn(
                  'font-black text-foreground leading-tight truncate',
                  isHero ? 'text-base' : 'text-sm',
                  onAnalyze && cn('cursor-pointer transition-colors', 'hover:text-blue-300'),
                )}
                onClick={onAnalyze}
                title={onAnalyze ? `Analyze ${playerName}` : undefined}
              >
                {playerName}
              </h3>
              {(team || position) && (
                <span className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider mt-0.5',
                  cfg.accentBg, cfg.accentBorder, cfg.accentText,
                )}>
                  {team}{team && position ? ` · ${position}` : position}
                </span>
              )}
            </div>
          </div>

          {/* Right actions: bookmark + status */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={toggleWatch}
              title={watched ? 'Remove bookmark' : 'Bookmark player'}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-150 border',
                watched
                  ? cn(cfg.accentText, cfg.accentBg, cfg.accentBorder, 'shadow-sm')
                  : 'text-[var(--text-faint)] bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:text-blue-400 hover:bg-blue-500/10',
              )}
            >
              <Bookmark className="w-3.5 h-3.5" fill={watched ? 'currentColor' : 'none'} />
            </button>

            {/* Status badge */}
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-xl border',
              cfg.bgCls, cfg.borderCls,
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-sm animate-pulse', cfg.dotCls)} />
              <span className={cn('text-[9px] font-black tracking-widest', cfg.textCls)}>{cfg.label}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* ── Hero metrics 2×2 tile grid ──────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: hero1.label, value: hero1.value, accent: 'blue' as const, large: true },
              { label: hero2.label, value: hero2.value, accent: 'accent' as const, large: true },
              ...(dkPts ? [{ label: 'DK Pts', value: dkPts, accent: 'accent' as const, large: false }] : []),
              ...(kProj > 0 && !isPitcher ? [{ label: 'K Proj', value: `${kProj}`, accent: 'muted' as const, large: false }] : []),
            ].map((tile, index) => (
              <StatTile
                key={tile.label}
                label={tile.label}
                value={tile.value}
                accent={tile.accent}
                large={tile.large}
                accentText={cfg.accentText}
                accentBg={cfg.accentBg}
                accentBorder={cfg.accentBorder}
                animDelay={index * 80}
              />
            ))}
          </div>

          {/* ── Breakout score bar + ring ────────────────────── */}
          {breakout > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <BreakoutBar score={breakout} />
              </div>
              <BreakoutRing score={breakout} />
            </div>
          )}

          {/* ── Percentile bar ───────────────────────────────── */}
          {(percentiles.p10 !== undefined || percentiles.p90 > 0) && (
            <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
              <PercentileBar
                p10={percentiles.p10}
                p50={percentiles.p50}
                p90={percentiles.p90}
                label={isPitcher ? 'K' : 'HR'}
              />
            </div>
          )}

          {/* ── Recent form sparkline ────────────────────────── */}
          {sparkData.length >= 3 && (
            <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Recent Form</span>
                {recentAvgLabel && (
                  <span className="text-[9px] font-bold text-[var(--text-faint)]">{recentAvgLabel}</span>
                )}
              </div>
              <DKSparkline data={sparkData} height={28} />
            </div>
          )}

          {/* ── Home / road splits ───────────────────────────── */}
          {(homeDkAvg || roadDkAvg) && (
            <div className="grid grid-cols-2 gap-2">
              {homeDkAvg && (
                <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-blue-500/8 border border-blue-500/20 px-3 py-2.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-blue-400/70">Home</span>
                  <span className="text-base font-black text-foreground tabular-nums">{homeDkAvg}</span>
                  {homeGames && <span className="text-[9px] text-[var(--text-faint)]">{homeGames}</span>}
                </div>
              )}
              {roadDkAvg && (
                <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-faint)]">Road</span>
                  <span className="text-base font-black text-foreground tabular-nums">{roadDkAvg}</span>
                  {roadGames && <span className="text-[9px] text-[var(--text-faint)]">{roadGames}</span>}
                </div>
              )}
            </div>
          )}

          {/* ── Summary metric rows ──────────────────────────── */}
          {metrics.length > 0 && (
            <div className="space-y-1.5">
              {metrics.slice(0, isHero ? 6 : 4).map((m, i) => {
                const isPercent = String(m.value).endsWith('%');
                const numVal = parseFloat(String(m.value));
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">{m.label}</span>
                    <div className="flex items-center gap-2">
                      {isPercent && !isNaN(numVal) && (
                        <div className="h-1 w-16 rounded-full bg-[var(--bg-overlay)] overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', metricBarCls(numVal))}
                            style={{ width: `${Math.min(100, numVal)}%` }}
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

          {/* ── Trend note ───────────────────────────────────── */}
          {trendNote && (
            <div className={cn(
              'flex items-start gap-2 px-3 py-2.5 rounded-2xl border-l-2',
              cfg.accentBg, cfg.accentBorder,
            )}>
              <Zap className={cn('w-3 h-3 shrink-0 mt-0.5', cfg.accentText)} />
              <p className="text-[10px] text-[var(--text-faint)] leading-relaxed line-clamp-2">{trendNote}</p>
            </div>
          )}

          {/* ── CTA row ──────────────────────────────────────── */}
          <div className="flex gap-2 pt-1">
            {lightboxSections.length > 0 && (
              <button
                onClick={() => setShowLightbox(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-faint)] hover:text-foreground hover:bg-[var(--bg-overlay)] hover:border-[var(--border-default)] transition-all duration-150 hover:scale-105 active:scale-95"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Full Breakdown
              </button>
            )}
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl border text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95',
                  cfg.accentBg, cfg.accentBorder, cfg.accentText,
                  'hover:opacity-80',
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Analyze
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1">
              <Target className="w-2.5 h-2.5 text-[var(--text-faint)]/50" />
              <span className="text-[9px] font-bold text-[var(--text-faint)]/50 uppercase tracking-wider">LeverageMetrics Engine</span>
            </div>
            <div className="flex items-center gap-2">
              {data.last_updated && (
                <span className="text-[9px] text-[var(--text-faint)]/50">{data.last_updated}</span>
              )}
              <span className="text-[9px] text-[var(--text-faint)]/50">Monte Carlo N=1,000</span>
            </div>
          </div>
        </div>
      </article>

      <AnalysisLightbox
        open={showLightbox && lightboxSections.length > 0}
        onClose={() => setShowLightbox(false)}
        title={`${playerName} — Full Breakdown`}
        sections={lightboxSections}
        accentText={cfg.accentText}
        accentBg={cfg.bgCls.split(' ')[0]}
        accentBorder={cfg.borderCls}
      />
    </>
  );
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({
  label, value, accent = 'blue', large = false,
  accentText, accentBg, accentBorder, animDelay,
}: {
  label: string;
  value: string;
  accent?: 'blue' | 'accent' | 'muted';
  large?: boolean;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  animDelay?: number;
}) {
  const tileText  = accent === 'blue' ? 'text-blue-300' : accent === 'accent' ? accentText : 'text-[var(--text-muted)]';
  const tileBg    = accent === 'blue' ? 'bg-blue-500/10' : accent === 'accent' ? accentBg : 'bg-[var(--bg-elevated)]';
  const tileBorder = accent === 'blue' ? 'border-blue-500/20' : accent === 'accent' ? accentBorder : 'border-[var(--border-subtle)]';

  return (
    <div
      className={cn('flex flex-col items-center rounded-2xl border px-2 py-3 animate-fade-in-up', tileBg, tileBorder)}
      style={animDelay != null ? { animationDelay: `${animDelay}ms` } : undefined}
    >
      <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-1">{label}</span>
      <span className={cn('font-black tabular-nums', large ? 'text-xl' : 'text-base', tileText)}>
        {value}
      </span>
    </div>
  );
}
