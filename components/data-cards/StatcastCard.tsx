'use client';

import { useState, useCallback, memo } from 'react';
import Image from 'next/image';
import { TrendingUp, Activity, BarChart3, Bookmark, Zap, Wind, ChevronRight } from 'lucide-react';
import { AnalysisLightbox, type LightboxSection } from './AnalysisLightbox';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Metric { label: string; value: string; }

interface SeasonStats {
  avg: string; hr: number; rbi: number; ops: string;
  slg: string; obp: string; hits: number; atBats: number;
  gamesPlayed: number; sb?: number; era?: string; k?: number; bb?: number;
}

interface GameLogEntry {
  date: string; opp: string; result?: string;
  ab?: number; h?: number; hr?: number; rbi?: number;
  ip?: string; k?: number; er?: number; bb?: number;
}

interface PropLine {
  label: string; statType: string; line: number;
  overOdds: number; impliedPct: number; hitRate: string; trend: 'hot' | 'cold' | 'neutral';
}

interface StatcastCardData {
  type: string; title: string; category: string; subcategory: string;
  gradient: string; status: string; summary_metrics: Metric[];
  lightbox?: { sections?: LightboxSection[] };
  data?: Record<string, any>;
  trend_note?: string; last_updated?: string;
}

interface StatcastCardProps {
  data: StatcastCardData;
  onAnalyze?: () => void;
  isHero?: boolean;
}

// ── Visual config ─────────────────────────────────────────────────────────────

interface TypeConf {
  emoji: string; label: string; gradient: string;
  accentBorder: string; accentText: string; accentBg: string; iconBg: string;
}

const TYPE_CONFIG: Record<string, TypeConf> = {
  statcast_summary_card: {
    emoji: '⚾', label: 'Statcast',
    gradient: 'from-cyan-500/5 dark:from-cyan-600/25 dark:via-blue-800/10 to-transparent',
    accentBorder: 'border-cyan-500/30', accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10', iconBg: 'bg-cyan-500/15',
  },
  hr_prop_card: {
    emoji: '💣', label: 'HR Prop',
    gradient: 'from-rose-500/5 dark:from-rose-600/25 dark:via-red-900/10 to-transparent',
    accentBorder: 'border-rose-500/30', accentText: 'text-rose-400',
    accentBg: 'bg-rose-500/10', iconBg: 'bg-rose-500/15',
  },
  game_simulation_card: {
    emoji: '🎲', label: 'Simulation',
    gradient: 'from-violet-500/5 dark:from-violet-600/25 dark:via-purple-900/10 to-transparent',
    accentBorder: 'border-violet-500/30', accentText: 'text-violet-400',
    accentBg: 'bg-violet-500/10', iconBg: 'bg-violet-500/15',
  },
  leaderboard_card: {
    emoji: '🏆', label: 'Leaderboard',
    gradient: 'from-amber-500/5 dark:from-amber-600/25 dark:via-yellow-900/10 to-transparent',
    accentBorder: 'border-amber-500/30', accentText: 'text-amber-400',
    accentBg: 'bg-amber-500/10', iconBg: 'bg-amber-500/15',
  },
  pitch_analysis_card: {
    emoji: '🌀', label: 'Pitch Mix',
    gradient: 'from-teal-500/5 dark:from-teal-600/25 dark:via-cyan-900/10 to-transparent',
    accentBorder: 'border-teal-500/30', accentText: 'text-teal-400',
    accentBg: 'bg-teal-500/10', iconBg: 'bg-teal-500/15',
  },
};
const DEFAULT_CONF: TypeConf = TYPE_CONFIG.statcast_summary_card;

const STATUS_CONFIG: Record<string, { label: string; dotCls: string; textCls: string; bgCls: string; borderCls: string }> = {
  hot:     { label: 'HOT',     dotCls: 'bg-red-400',     textCls: 'text-red-400',     bgCls: 'bg-red-500/10',     borderCls: 'border-red-500/25' },
  edge:    { label: 'EDGE',    dotCls: 'bg-amber-400',   textCls: 'text-amber-400',   bgCls: 'bg-amber-500/10',   borderCls: 'border-amber-500/25' },
  value:   { label: 'VALUE',   dotCls: 'bg-emerald-400', textCls: 'text-emerald-400', bgCls: 'bg-emerald-500/10', borderCls: 'border-emerald-500/25' },
  optimal: { label: 'OPTIMAL', dotCls: 'bg-sky-400',     textCls: 'text-sky-400',     bgCls: 'bg-sky-500/10',     borderCls: 'border-sky-500/25' },
};

// ── Pitcher Gauge constants & helpers ─────────────────────────────────────────

const PITCHER_LEAGUE_AVG: Record<string, { avg: number; lowerBetter: boolean }> = {
  'xwOBA Against':       { avg: 0.315, lowerBetter: true  },
  'Exit Velo Against':   { avg: 88.5,  lowerBetter: true  },
  'Hard Hit% Against':   { avg: 36.5,  lowerBetter: true  },
  'Barrel% Against':     { avg: 7.5,   lowerBetter: true  },
  'xwOBA':               { avg: 0.315, lowerBetter: false },
  'Exit Velocity':       { avg: 88.5,  lowerBetter: false },
  'Hard Hit%':           { avg: 36.5,  lowerBetter: false },
};

function getPitcherPercentile(label: string, rawValue: string): number | null {
  const entry = PITCHER_LEAGUE_AVG[label];
  if (!entry) return null;
  const val = parseFloat(rawValue);
  if (!Number.isFinite(val)) return null;
  const { avg, lowerBetter } = entry;
  const maxDiff = avg * 0.40;
  const diff = lowerBetter ? avg - val : val - avg;
  return Math.min(100, Math.max(0, Math.round(50 + (diff / maxDiff) * 50)));
}

function gaugeColor(pct: number): string {
  if (pct >= 80) return '#4ade80';
  if (pct >= 60) return '#60a5fa';
  if (pct >= 40) return '#fbbf24';
  return '#f87171';
}

const PITCH_LABEL_SHORT: Record<string, string> = {
  'xwOBA Against':     'xwOBA vs',
  'Exit Velo Against': 'EV vs',
  'Hard Hit% Against': 'HH% vs',
  'Barrel% Against':   'BBL% vs',
};

// ── Watchlist hook ─────────────────────────────────────────────────────────────

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

// ── Value formatting ──────────────────────────────────────────────────────────

function getValueStyle(value: string): { textCls: string; barWidth?: number } {
  const v = (value ?? '').trim();
  if (v.endsWith('%')) {
    const num = parseFloat(v);
    if (!isNaN(num)) {
      const pct = Math.min(100, Math.max(0, Math.abs(num)));
      const textCls = num >= 60 ? 'text-emerald-400' : num >= 35 ? 'text-amber-400' : 'text-rose-400';
      if (!v.startsWith('+') && !v.startsWith('-')) return { textCls, barWidth: pct };
      return { textCls };
    }
  }
  if (v.toLowerCase().includes('mph')) {
    const num = parseFloat(v);
    if (!isNaN(num))
      return { textCls: num >= 92 ? 'text-emerald-400' : num >= 88 ? 'text-amber-400' : 'text-rose-400' };
  }
  if (/^[+-]\d{2,4}$/.test(v)) return { textCls: v.startsWith('+') ? 'text-emerald-400' : 'text-rose-400' };
  if (/^[+-][\d.]+%$/.test(v)) return { textCls: v.startsWith('+') ? 'text-emerald-400' : 'text-rose-400' };
  return { textCls: 'text-foreground' };
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function HeroMetrics({ metrics, conf }: { metrics: Metric[]; conf: TypeConf }) {
  const top = metrics.slice(0, 3);
  if (!top.length) return null;
  const gridCols = top.length === 1 ? 'grid-cols-1' : top.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <div className={cn('grid gap-2 mb-4', gridCols)}>
      {top.map((m, i) => {
        const { textCls, barWidth } = getValueStyle(m.value);
        return (
          <div key={i} className={cn(
            'flex flex-col items-center rounded-2xl border py-3 px-2 text-center',
            conf.accentBg, conf.accentBorder,
            'shadow-sm',
            'animate-fade-in-up',
          )} style={{ animationDelay: `${i * 60}ms` }}>
            <span className={cn('text-xl font-black tabular-nums leading-none', textCls)}>{m.value}</span>
            <span className={cn('mt-1.5 text-[9px] font-black uppercase tracking-widest opacity-70 leading-tight', conf.accentText)}>
              {m.label}
            </span>
            {barWidth !== undefined && (
              <div className="w-full h-1 rounded-full bg-black/20 overflow-hidden mt-2">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    barWidth >= 60 ? 'bg-emerald-400' : barWidth >= 35 ? 'bg-amber-400' : 'bg-rose-400',
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pitcher gauge ring components ─────────────────────────────────────────────

function GaugeArc({ percentile, color }: { percentile: number; color: string }) {
  const R = 34, CX = 44, CY = 44;
  const startDeg = 210, totalDeg = 240;
  const filled = totalDeg * (percentile / 100);

  function arcPath(deg: number) {
    const rad = (d: number) => (d * Math.PI) / 180;
    const x1 = CX + R * Math.cos(rad(startDeg));
    const y1 = CY + R * Math.sin(rad(startDeg));
    const x2 = CX + R * Math.cos(rad(startDeg + deg));
    const y2 = CY + R * Math.sin(rad(startDeg + deg));
    const large = deg > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  return (
    <svg viewBox="0 0 88 88" className="w-full h-full" aria-hidden>
      <path d={arcPath(totalDeg)} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
      {percentile > 0 && (
        <path d={arcPath(filled)} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
      )}
    </svg>
  );
}

function PitcherGauges({ metrics }: { metrics: Metric[] }) {
  const top = metrics.slice(0, 3);
  if (!top.length) return null;
  return (
    <div className="flex justify-around items-start gap-1 mb-4">
      {top.map((m, i) => {
        const pct   = getPitcherPercentile(m.label, m.value);
        const color = pct !== null ? gaugeColor(pct) : '#6b7280';
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            {/* Gauge ring */}
            <div className="relative w-20 h-20">
              <GaugeArc percentile={pct ?? 50} color={color} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                <span className="text-[14px] font-black tabular-nums text-[var(--foreground)] leading-none">
                  {m.value}
                </span>
                {pct !== null && (
                  <span className="text-[9px] font-black mt-0.5" style={{ color }}>
                    {pct}<span className="text-[7px]">th</span>
                  </span>
                )}
              </div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--foreground)]/40 text-center leading-tight px-0.5">
              {PITCH_LABEL_SHORT[m.label] ?? m.label}
            </span>
            {PITCHER_LEAGUE_AVG[m.label] && (
              <span className="text-[8px] text-[var(--foreground)]/20">
                lg avg {PITCHER_LEAGUE_AVG[m.label].avg}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricRow({ label, value }: Metric) {
  const { textCls, barWidth } = getValueStyle(value);
  return (
    <div className="py-2 border-b border-[var(--border-subtle)] last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--text-faint)] font-medium">{label}</span>
        <span className={cn('text-[11px] font-black tabular-nums', textCls)}>{value}</span>
      </div>
      {barWidth !== undefined && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              barWidth >= 60 ? 'bg-emerald-500/70' : barWidth >= 35 ? 'bg-amber-500/70' : 'bg-rose-500/70',
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Stat tile (grid) ──────────────────────────────────────────────────────────

function StatTile({ label, value, pct, accentText }: { label: string; value: string; pct?: number; accentText: string }) {
  const { textCls } = getValueStyle(value);
  return (
    <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-2.5">
      <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mb-1 font-bold">{label}</div>
      <div className={cn('text-base font-black tabular-nums', textCls)}>{value}</div>
      {pct !== undefined && (
        <div className="h-1 rounded-full bg-[var(--bg-overlay)] overflow-hidden mt-1.5">
          <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const PITCHER_TABS = ['Stats', 'Advanced', 'Props'] as const;

function PitcherTabBar({ active, onSelect, accentBg, accentBorder, accentText }: {
  active: number; onSelect: (i: number) => void;
  accentBg: string; accentBorder: string; accentText: string;
}) {
  return (
    <div className="flex gap-1 mb-4 p-0.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
      {PITCHER_TABS.map((label, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150',
            active === i
              ? cn(accentBg, accentBorder, accentText, 'border shadow-sm')
              : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Tab 0: Stats ──────────────────────────────────────────────────────────────

function TabStats({ metrics, trendNote, conf }: {
  metrics: Metric[]; trendNote?: string; conf: TypeConf;
}) {
  return (
    <div>
      <PitcherGauges metrics={metrics} />
      {trendNote && (
        <div className={cn(
          'mt-3 px-3.5 py-3 rounded-2xl border-l-2',
          conf.accentBg, conf.accentBorder,
          'border-l-cyan-400',
        )}>
          <div className="flex items-start gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{trendNote}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 1: Advanced ───────────────────────────────────────────────────────────

function TabAdvanced({ metrics, data, seasonStats, gameLog, conf }: {
  metrics: Metric[];
  data: Record<string, any>;
  seasonStats?: SeasonStats;
  gameLog: GameLogEntry[];
  conf: TypeConf;
}) {
  const extraMetrics = metrics.slice(3);
  const hasPitchMix  = data.pitchMixFB || data.pitchMixBrk || data.pitchMixOff;
  const hasRelease   = data.spinRate || data.extension || data.hBreak || data.vBreak;
  const hasSeason    = !!seasonStats;
  const hasLog       = gameLog.length > 0;

  return (
    <div className="space-y-4">
      {/* Core rate stats */}
      {extraMetrics.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-2">Rate Stats</p>
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {extraMetrics.map((m, i) => (
              <div key={i} className={cn('px-3 py-2', i % 2 === 1 && 'bg-white/[0.015]')}>
                <MetricRow label={m.label} value={m.value} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pitch Arsenal */}
      {hasPitchMix && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-2">Pitch Arsenal</p>
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] p-3 space-y-2.5">
            {[
              { label: 'Fastball',  val: data.pitchMixFB,  color: '#60a5fa' },
              { label: 'Breaking',  val: data.pitchMixBrk, color: '#a78bfa' },
              { label: 'Offspeed',  val: data.pitchMixOff, color: '#fcd34d' },
            ].filter(p => p.val != null).map((p, i) => {
              const pct = parseFloat(p.val ?? '0') || 0;
              return (
                <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: p.color }}>
                      {p.label}
                    </span>
                    <span className="text-[11px] font-black text-[var(--foreground)] tabular-nums">{p.val}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: `linear-gradient(90deg, ${p.color}80, ${p.color})`,
                        boxShadow: `0 0 8px ${p.color}44`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spin & Release */}
      {hasRelease && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-2">Spin & Release</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Spin Rate', val: data.spinRate },
              { label: 'Extension', val: data.extension },
              { label: 'H-Break',   val: data.hBreak },
              { label: 'V-Break',   val: data.vBreak },
            ].filter(r => r.val).map((r, i) => (
              <StatTile key={i} label={r.label} value={r.val} accentText={conf.accentText} />
            ))}
          </div>
        </div>
      )}

      {/* Season Stats */}
      {hasSeason && seasonStats && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-2">Season Stats</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'ERA', val: seasonStats.era ?? '--', hi: true },
              { label: 'K',   val: String(seasonStats.k ?? 0), hi: true },
              { label: 'BB',  val: String(seasonStats.bb ?? 0), hi: false },
              { label: 'G',   val: String(seasonStats.gamesPlayed), hi: false },
            ].map((s, i) => (
              <StatTile key={i} label={s.label} value={s.val} accentText={conf.accentText} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Form */}
      {hasLog && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-2">Recent Form</p>
          {/* Dot sparkline */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[8px] text-[var(--foreground)]/25 uppercase tracking-widest">Form</span>
            {gameLog.slice(0, 5).map((g, i) => {
              const er = g.er ?? 0;
              const ip = parseFloat(g.ip ?? '0');
              const isQS = ip >= 6 && er <= 3;
              const isBad = er >= 4;
              return (
                <div
                  key={i}
                  className="w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center text-[8px] font-black animate-fade-in-up"
                  title={`${g.date} vs ${g.opp}: ${g.ip ?? '?'} IP, ${g.k ?? 0} K, ${er} ER`}
                  style={{
                    background: isQS ? 'rgba(74,222,128,0.2)' : isBad ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)',
                    border: `1px solid ${isQS ? 'rgba(74,222,128,0.4)' : isBad ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.3)'}`,
                    color: isQS ? '#4ade80' : isBad ? '#f87171' : '#fbbf24',
                    animationDelay: `${i * 60}ms`,
                  }}
                >
                  {isQS ? 'Q' : isBad ? '✗' : '·'}
                </div>
              );
            })}
            <span className="text-[8px] text-[var(--foreground)]/20 ml-1">← recent</span>
          </div>

          {/* Game log table */}
          <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
            <div className="grid px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
              style={{ gridTemplateColumns: '1fr 40px 32px 28px 28px 28px' }}>
              {['Date', 'Opp', 'IP', 'K', 'ER', 'BB'].map(h => (
                <span key={h} className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] text-right first:text-left">{h}</span>
              ))}
            </div>
            {gameLog.map((g, i) => {
              const ip = parseFloat(g.ip ?? '0');
              const isQS = ip >= 6 && (g.er ?? 0) <= 3;
              return (
                <div
                  key={i}
                  className={cn(
                    'grid px-3 py-2 border-b border-[var(--border-subtle)] last:border-0',
                    i % 2 === 1 && 'bg-white/[0.015]',
                  )}
                  style={{ gridTemplateColumns: '1fr 40px 32px 28px 28px 28px' }}
                >
                  <span className="text-[10px] text-[var(--text-faint)] whitespace-nowrap">
                    {g.date}
                    {isQS && <span className="ml-1 text-[7px] font-black text-emerald-400">QS</span>}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-bold text-right truncate">{g.opp}</span>
                  <span className="text-[10px] text-[var(--foreground)]/70 font-bold text-right">{g.ip ?? '—'}</span>
                  <span className="text-[10px] font-black text-emerald-400 text-right">{g.k ?? '—'}</span>
                  <span className={cn(
                    'text-[10px] font-black text-right',
                    (g.er ?? 0) === 0 ? 'text-emerald-400' : (g.er ?? 0) <= 2 ? 'text-amber-400' : 'text-rose-400',
                  )}>
                    {g.er ?? '—'}
                  </span>
                  <span className="text-[10px] text-[var(--text-faint)] text-right">{g.bb ?? '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Props ──────────────────────────────────────────────────────────────

function TabProps({ data, propLines, onAnalyze }: {
  data: Record<string, any>;
  propLines: PropLine[];
  onAnalyze?: () => void;
}) {
  const fmtOdds = (o: number) => (o > 0 ? `+${o}` : String(o));
  const barWidth = (pct: number) => Math.min(100, Math.max(4, pct));

  if (propLines.length > 0) {
    return (
      <div className="space-y-3">
        {propLines.map((prop, i) => (
          <div key={i} className="rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border',
                  prop.trend === 'hot' ? 'bg-orange-500/15 text-orange-300 border-orange-500/25'
                  : prop.trend === 'cold' ? 'bg-sky-500/15 text-sky-300 border-sky-500/25'
                  : 'bg-[var(--bg-overlay)] text-[var(--text-faint)] border-[var(--border-subtle)]',
                )}>
                  {prop.trend === 'hot' ? '🔥 HOT' : prop.trend === 'cold' ? '❄ COLD' : 'NEUTRAL'}
                </span>
                <span className="text-[11px] font-black text-foreground">{prop.label}</span>
                <span className="text-[10px] text-[var(--text-faint)]">O{prop.line}</span>
              </div>
              <span className={cn(
                'text-[12px] font-black tabular-nums px-2.5 py-1 rounded-xl border',
                prop.overOdds > 0
                  ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                  : 'text-amber-300 bg-amber-500/10 border-amber-500/20',
              )}>
                {fmtOdds(prop.overOdds)}
              </span>
            </div>

            {/* Implied probability bar */}
            <div className="px-3.5 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Implied Probability</span>
                <span className={cn(
                  'text-[10px] font-black',
                  prop.impliedPct >= 60 ? 'text-emerald-400' : prop.impliedPct >= 45 ? 'text-amber-400' : 'text-rose-400',
                )}>
                  {prop.impliedPct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    prop.impliedPct >= 60 ? 'bg-emerald-500'
                    : prop.impliedPct >= 45 ? 'bg-amber-500'
                    : 'bg-rose-500',
                  )}
                  style={{ width: `${barWidth(prop.impliedPct)}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--text-faint)]">
                {prop.hitRate !== '—' ? `Hit in ${prop.hitRate} recent games` : 'No recent game data available'}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // No prop lines — show K projection from raw data
  const kPctRaw   = data.kPctRaw   as number | undefined;
  const fbVeloRaw = data.fbVeloRaw as number | undefined;

  return (
    <div className="space-y-3">
      {(kPctRaw != null || fbVeloRaw != null) && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-2">K Projection Estimate</p>
          <div className="grid grid-cols-2 gap-2">
            {kPctRaw != null && (
              <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/20 p-3 text-center">
                <p className="text-xl font-black text-emerald-300 tabular-nums">{kPctRaw.toFixed(1)}%</p>
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400/70 mt-1">Season K%</p>
              </div>
            )}
            {fbVeloRaw != null && (
              <div className="rounded-2xl bg-blue-500/8 border border-blue-500/20 p-3 text-center">
                <p className="text-xl font-black text-blue-300 tabular-nums">{fbVeloRaw.toFixed(1)} <span className="text-sm">mph</span></p>
                <p className="text-[9px] font-black uppercase tracking-wider text-blue-400/70 mt-1">FB Velocity</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="w-10 h-10 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
          <Zap className="w-5 h-5 text-[var(--text-faint)]" />
        </div>
        <p className="text-[11px] text-[var(--text-faint)]">Live prop lines load when game is scheduled</p>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[10px] font-black hover:bg-blue-500/20 transition-colors"
          >
            <Zap className="w-3 h-3" />
            Ask AI for K Prop Analysis
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main StatcastCard ─────────────────────────────────────────────────────────

export const StatcastCard = memo(function StatcastCard({ data, onAnalyze, isHero = false }: StatcastCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const cardType   = (data.type ?? '').toLowerCase();
  const conf       = TYPE_CONFIG[cardType] ?? DEFAULT_CONF;
  const statusKey  = (data.status ?? 'value').toLowerCase();
  const statusConf = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.value;

  const hasSummaryMetrics = Array.isArray(data.summary_metrics) && data.summary_metrics.length > 0;
  const sections: LightboxSection[] = data.lightbox?.sections ?? [];
  const hasLightbox = sections.length > 0;

  const playerName  = data.data?.playerName as string ?? data.title ?? '';
  const headshotUrl = (data.data?.headshotUrl as string | null | undefined) ?? getPlayerHeadshotUrl(playerName);
  const seasonStats = data.data?.seasonStats as SeasonStats | undefined;
  const gameLog     = Array.isArray(data.data?.gameLog) ? (data.data.gameLog as GameLogEntry[]) : [];
  const propLines   = (data.data?.propLines as PropLine[] | undefined) ?? [];

  const { watched, toggle: toggleWatch } = useWatchlist(playerName);

  const isPitcherCard = cardType === 'statcast_summary_card';

  return (
    <>
      {/* ── Main card ── */}
      <div className={cn(
        'group relative rounded-2xl border transition-all duration-300',
        // Glassmorphism base
        'bg-gradient-to-br',
        conf.gradient,
        'backdrop-blur-sm',
        conf.accentBorder,
        // Shadow
        'shadow-xl shadow-black/20',
        'hover:shadow-2xl hover:shadow-black/30 hover:scale-[1.01]',
        isHero ? 'p-6' : 'p-4',
      )}>
        {/* Subtle inner glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 relative">
          <div className="flex items-center gap-3 min-w-0">
            {/* Player avatar */}
            <div className={cn(
              'flex items-center justify-center flex-shrink-0 rounded-2xl overflow-hidden',
              conf.iconBg, 'border', conf.accentBorder,
              'shadow-lg',
              isHero ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg',
            )}>
              {headshotUrl && !imgError ? (
                <Image
                  src={headshotUrl} alt={playerName}
                  width={isHero ? 48 : 40} height={isHero ? 48 : 40}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : conf.emoji}
            </div>

            {/* Title block */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn('text-[9px] font-black uppercase tracking-widest', conf.accentText)}>{data.category ?? 'MLB'}</span>
                <span className="text-[9px] text-[var(--border-subtle)]">·</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{data.subcategory ?? conf.label}</span>
              </div>
              <h3
                className={cn(
                  'font-black text-foreground leading-tight truncate',
                  isHero ? 'text-base' : 'text-sm',
                  onAnalyze && 'cursor-pointer hover:text-cyan-300 transition-colors',
                )}
                onClick={onAnalyze}
              >
                {data.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Watchlist bookmark */}
            {isPitcherCard && (
              <button
                onClick={toggleWatch}
                title={watched ? 'Remove bookmark' : 'Bookmark player'}
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-150 border',
                  watched
                    ? 'text-cyan-400 bg-cyan-500/15 border-cyan-500/25 shadow-sm'
                    : 'text-[var(--text-faint)] bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:text-cyan-400 hover:bg-cyan-500/10',
                )}
              >
                <Bookmark className="w-3.5 h-3.5" fill={watched ? 'currentColor' : 'none'} />
              </button>
            )}

            {/* Status badge */}
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-xl border',
              statusConf.bgCls, statusConf.borderCls,
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-sm animate-pulse', statusConf.dotCls)} />
              <span className={cn('text-[9px] font-black tracking-widest', statusConf.textCls)}>{statusConf.label}</span>
            </div>
          </div>
        </div>

        {/* Tab bar (pitcher cards only) */}
        {isPitcherCard && (
          <PitcherTabBar
            active={activeTab}
            onSelect={setActiveTab}
            accentBg={conf.accentBg}
            accentBorder={conf.accentBorder}
            accentText={conf.accentText}
          />
        )}

        {/* Content */}
        {isPitcherCard ? (
          <>
            {activeTab === 0 && hasSummaryMetrics && (
              <TabStats metrics={data.summary_metrics} trendNote={data.trend_note} conf={conf} />
            )}
            {activeTab === 1 && (
              <TabAdvanced metrics={data.summary_metrics ?? []} data={data.data ?? {}} seasonStats={seasonStats} gameLog={gameLog} conf={conf} />
            )}
            {activeTab === 2 && (
              <TabProps data={data.data ?? {}} propLines={propLines} onAnalyze={onAnalyze} />
            )}
          </>
        ) : (
          /* Non-pitcher statcast cards: flat layout with enhanced tiles */
          <>
            {hasSummaryMetrics && <HeroMetrics metrics={data.summary_metrics} conf={conf} />}
            {/* Remaining metrics as tiled grid */}
            {hasSummaryMetrics && data.summary_metrics.slice(3).length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {data.summary_metrics.slice(3).map((m: Metric, i: number) => (
                  <StatTile key={i} label={m.label} value={m.value} accentText={conf.accentText} />
                ))}
              </div>
            )}
            {!hasSummaryMetrics && data.data && (
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {Object.entries(data.data)
                  .filter(([k]) => !['playerName','realData','headshotUrl','seasonStats','gameLog','propLines'].includes(k))
                  .map(([k, v], i) => (
                    <StatTile
                      key={i}
                      label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      value={String(v)}
                      accentText={conf.accentText}
                    />
                  ))
                }
              </div>
            )}
            {data.trend_note && (
              <div className={cn(
                'mt-3 px-3.5 py-3 rounded-2xl border-l-2',
                conf.accentBg, conf.accentBorder,
              )}>
                <div className="flex items-start gap-2">
                  <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.trend_note}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 relative">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] border border-[var(--border-subtle)] rounded-lg px-2 py-0.5">
              {data.data?.sport === 'NFL' ? 'NFL Stats'
               : data.data?.sport === 'NBA' ? 'NBA Stats'
               : data.data?.sport === 'NHL' ? 'NHL Stats'
               : 'Baseball Savant'}
            </span>
            {data.last_updated && (
              <span className="text-[9px] text-[var(--text-faint)]">· {data.last_updated}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-white/8 text-[var(--text-muted)] hover:text-foreground text-[10px] font-black transition-colors border border-[var(--border-subtle)] hover:scale-105 active:scale-95 transition-transform duration-150"
              >
                <BarChart3 className="w-3 h-3" />
                AI Analysis
              </button>
            )}
            {hasLightbox && (
              <button
                onClick={() => setLightboxOpen(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all border shadow-sm',
                  conf.accentBg, 'hover:opacity-90', conf.accentText, conf.accentBorder,
                  'hover:scale-105 active:scale-95 transition-transform duration-150',
                )}
              >
                <ChevronRight className="w-3 h-3" />
                Full Breakdown
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AnalysisLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={data.title}
        sections={sections as LightboxSection[]}
        accentText={conf.accentText}
        accentBg={conf.accentBg}
        accentBorder={conf.accentBorder}
        rawData={data}
      />
    </>
  );
});

export default StatcastCard;
