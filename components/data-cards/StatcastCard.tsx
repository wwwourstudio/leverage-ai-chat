'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Calendar, Activity, BarChart3 } from 'lucide-react';
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
    gradient: 'from-blue-600/75 via-blue-900/55 to-slate-900/40',
    accentBorder: 'border-blue-500/30', accentText: 'text-blue-400',
    accentBg: 'bg-blue-500/15', iconBg: 'bg-blue-500/20',
  },
  hr_prop_card: {
    emoji: '💣', label: 'HR Prop',
    gradient: 'from-rose-600/75 via-red-900/55 to-slate-900/40',
    accentBorder: 'border-rose-500/30', accentText: 'text-rose-400',
    accentBg: 'bg-rose-500/15', iconBg: 'bg-rose-500/20',
  },
  game_simulation_card: {
    emoji: '🎲', label: 'Simulation',
    gradient: 'from-violet-600/75 via-purple-900/55 to-slate-900/40',
    accentBorder: 'border-violet-500/30', accentText: 'text-violet-400',
    accentBg: 'bg-violet-500/15', iconBg: 'bg-violet-500/20',
  },
  leaderboard_card: {
    emoji: '🏆', label: 'Leaderboard',
    gradient: 'from-amber-600/75 via-yellow-900/55 to-slate-900/40',
    accentBorder: 'border-amber-500/30', accentText: 'text-amber-400',
    accentBg: 'bg-amber-500/15', iconBg: 'bg-amber-500/20',
  },
  pitch_analysis_card: {
    emoji: '🌀', label: 'Pitch Mix',
    gradient: 'from-teal-600/75 via-cyan-900/55 to-slate-900/40',
    accentBorder: 'border-teal-500/30', accentText: 'text-teal-400',
    accentBg: 'bg-teal-500/15', iconBg: 'bg-teal-500/20',
  },
};
const DEFAULT_CONF: TypeConf = TYPE_CONFIG.statcast_summary_card;

const STATUS_CONFIG: Record<string, { label: string; dotCls: string; textCls: string }> = {
  hot:     { label: 'HOT',     dotCls: 'bg-red-400',     textCls: 'text-red-400' },
  edge:    { label: 'EDGE',    dotCls: 'bg-amber-400',   textCls: 'text-amber-400' },
  value:   { label: 'VALUE',   dotCls: 'bg-emerald-400', textCls: 'text-emerald-400' },
  optimal: { label: 'OPTIMAL', dotCls: 'bg-sky-400',     textCls: 'text-sky-400' },
};

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
  return { textCls: 'text-white' };
}

// ── Main card internals ───────────────────────────────────────────────────────

function HeroMetrics({ metrics, conf }: { metrics: Metric[]; conf: TypeConf }) {
  const top = metrics.slice(0, 3);
  if (!top.length) return null;
  return (
    <div className={`grid gap-2 mb-3 grid-cols-${top.length === 1 ? '1' : top.length === 2 ? '2' : '3'}`}>
      {top.map((m, i) => {
        const { textCls } = getValueStyle(m.value);
        return (
          <div key={i} className={`flex flex-col items-center rounded-xl ${conf.accentBg} border ${conf.accentBorder} py-2.5 px-1.5 text-center`}>
            <span className={`text-base font-black tabular-nums leading-none ${textCls}`}>{m.value}</span>
            <span className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${conf.accentText} opacity-80 leading-tight`}>{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetricRow({ label, value }: Metric) {
  const { textCls, barWidth } = getValueStyle(value);
  return (
    <div className="py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${textCls}`}>{value}</span>
      </div>
      {barWidth !== undefined && (
        <div className="mt-1 h-0.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barWidth >= 60 ? 'bg-emerald-500/60' : barWidth >= 35 ? 'bg-amber-500/60' : 'bg-rose-500/60'}`} style={{ width: `${barWidth}%` }} />
        </div>
      )}
    </div>
  );
}

function FlatDataMetrics({ data }: { data: Record<string, any> }) {
  const SKIP = new Set(['playerName', 'realData', 'headshotUrl', 'seasonStats', 'gameLog', 'propLines']);
  const entries = Object.entries(data).filter(([k]) => !SKIP.has(k));
  if (!entries.length) return null;
  return (
    <div className="space-y-0">
      {entries.map(([k, v], i) => (
        <MetricRow key={i} label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={String(v)} />
      ))}
    </div>
  );
}

// ── Sub-card: Season Stats ────────────────────────────────────────────────────

function SeasonSubCard({ stats, conf }: { stats: SeasonStats; conf: TypeConf }) {
  const isPitcher = !!stats.era;
  const year = new Date().getFullYear();

  return (
    <div className={`rounded-2xl bg-gradient-to-br from-violet-600/40 via-purple-900/30 to-slate-900/60 border border-violet-500/25 p-4 h-full`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
          <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-violet-400">{year} Season</p>
          <p className="text-[11px] font-bold text-white leading-tight">
            {isPitcher ? 'Pitching Stats' : 'Batting Stats'}
          </p>
        </div>
        <span className="ml-auto text-[9px] font-bold text-gray-500 border border-gray-700/40 rounded px-1.5 py-0.5">MLB</span>
      </div>

      {isPitcher ? (
        <>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              { label: 'ERA', val: stats.era ?? '--', hi: true },
              { label: 'K', val: String(stats.k ?? 0), hi: true },
              { label: 'BB', val: String(stats.bb ?? 0), hi: false },
              { label: 'G', val: String(stats.gamesPlayed), hi: false },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-2 text-center">
                <p className={`text-sm font-black tabular-nums ${s.hi ? 'text-violet-300' : 'text-white/70'}`}>{s.val}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-violet-400/70 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Big 4 tiles */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            {[
              { label: 'HR', val: String(stats.hr) },
              { label: 'RBI', val: String(stats.rbi) },
              { label: 'H', val: String(stats.hits) },
              { label: 'SB', val: String(stats.sb ?? 0) },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-2 text-center">
                <p className="text-sm font-black text-white tabular-nums">{s.val}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-violet-400/70 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Rate stats */}
          <div className="space-y-0">
            {[
              { label: 'AVG', value: stats.avg },
              { label: 'OPS', value: stats.ops },
              { label: 'SLG', value: stats.slg },
              { label: 'OBP', value: stats.obp },
              { label: 'G / AB', value: `${stats.gamesPlayed} / ${stats.atBats}` },
            ].map((m, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-[11px] text-gray-400">{m.label}</span>
                <span className="text-[11px] font-bold text-white tabular-nums">{m.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-card: Recent Form (game log) ─────────────────────────────────────────

function RecentFormSubCard({ log }: { log: GameLogEntry[] }) {
  if (!log.length) return null;
  const isPitcher = log[0].ip !== undefined;

  // Compute batter hit streak / on-fire indicator
  const consecutiveHits = !isPitcher
    ? log.reduce((streak, g) => (g.h ?? 0) > 0 ? streak + 1 : 0, 0)
    : 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-600/40 via-teal-900/30 to-slate-900/60 border border-emerald-500/25 p-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400">Recent Form</p>
          <p className="text-[11px] font-bold text-white leading-tight">Last {log.length} Games</p>
        </div>
        {consecutiveHits >= 3 && (
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
            🔥 {consecutiveHits}-game hit streak
          </span>
        )}
      </div>

      {/* Game log table */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-gray-500 font-semibold pb-1.5 pr-2 whitespace-nowrap">Date</th>
              <th className="text-left text-gray-500 font-semibold pb-1.5 pr-2">Opp</th>
              {isPitcher ? (
                <>
                  <th className="text-right text-gray-500 font-semibold pb-1.5 pr-2">IP</th>
                  <th className="text-right text-gray-500 font-semibold pb-1.5 pr-2">K</th>
                  <th className="text-right text-gray-500 font-semibold pb-1.5 pr-2">ER</th>
                  <th className="text-right text-gray-500 font-semibold pb-1.5">BB</th>
                </>
              ) : (
                <>
                  <th className="text-right text-gray-500 font-semibold pb-1.5 pr-2">AB</th>
                  <th className="text-right text-gray-500 font-semibold pb-1.5 pr-2">H</th>
                  <th className="text-right text-gray-500 font-semibold pb-1.5 pr-2">HR</th>
                  <th className="text-right text-gray-500 font-semibold pb-1.5">RBI</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {log.map((g, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="py-1.5 pr-2 text-gray-400 whitespace-nowrap">{g.date}</td>
                <td className="py-1.5 pr-2 text-gray-300 whitespace-nowrap font-medium">{g.opp}</td>
                {isPitcher ? (
                  <>
                    <td className="py-1.5 pr-2 text-right text-white font-medium">{g.ip}</td>
                    <td className="py-1.5 pr-2 text-right font-bold text-emerald-400">{g.k}</td>
                    <td className={cn('py-1.5 pr-2 text-right font-bold', (g.er ?? 0) === 0 ? 'text-emerald-400' : (g.er ?? 0) <= 2 ? 'text-amber-400' : 'text-rose-400')}>{g.er}</td>
                    <td className="py-1.5 text-right text-gray-400">{g.bb}</td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5 pr-2 text-right text-gray-400">{g.ab ?? '—'}</td>
                    <td className={cn('py-1.5 pr-2 text-right font-bold tabular-nums',
                      (g.h ?? 0) >= 3 ? 'text-emerald-400' : (g.h ?? 0) >= 1 ? 'text-amber-300' : 'text-gray-500'
                    )}>{g.h ?? '—'}</td>
                    <td className={cn('py-1.5 pr-2 text-right font-bold tabular-nums',
                      (g.hr ?? 0) > 0 ? 'text-rose-400' : 'text-gray-600'
                    )}>{g.hr ?? 0}</td>
                    <td className="py-1.5 text-right text-gray-400 tabular-nums">{g.rbi ?? 0}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      {!isPitcher && (
        <div className="mt-2 pt-2 border-t border-white/5 flex gap-3 text-[10px] text-gray-500">
          <span>
            Total H: <span className="text-white font-semibold">{log.reduce((s, g) => s + (g.h ?? 0), 0)}</span>
          </span>
          <span>
            HR: <span className="text-rose-400 font-semibold">{log.reduce((s, g) => s + (g.hr ?? 0), 0)}</span>
          </span>
          <span>
            RBI: <span className="text-white font-semibold">{log.reduce((s, g) => s + (g.rbi ?? 0), 0)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sub-card: Prop Lines ──────────────────────────────────────────────────────

function PropLinesSubCard({ lines }: { lines: PropLine[] }) {
  if (!lines.length) return null;

  const fmtOdds = (o: number) => (o > 0 ? `+${o}` : String(o));
  const barWidth = (pct: number) => Math.min(100, Math.max(4, pct));

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-600/40 via-orange-900/30 to-slate-900/60 border border-amber-500/25 p-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400">Prop Lines</p>
          <p className="text-[11px] font-bold text-white leading-tight">Today&apos;s Markets</p>
        </div>
        <span className="ml-auto text-[9px] font-bold text-gray-500 border border-gray-700/40 rounded px-1.5 py-0.5">ODDS API</span>
      </div>

      {/* Prop rows */}
      <div className="space-y-3">
        {lines.map((prop, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-white">
                {prop.label} O{prop.line}
              </span>
              <span className={cn(
                'text-[11px] font-black tabular-nums',
                prop.overOdds > 0 ? 'text-emerald-400' : 'text-amber-300',
              )}>
                {fmtOdds(prop.overOdds)}
              </span>
            </div>
            {/* Progress bar + implied pct */}
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    prop.impliedPct >= 60 ? 'bg-emerald-500/70'
                    : prop.impliedPct >= 45 ? 'bg-amber-500/70'
                    : 'bg-rose-500/60',
                  )}
                  style={{ width: `${barWidth(prop.impliedPct)}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 tabular-nums w-9 text-right">
                {prop.impliedPct}% imp
              </span>
            </div>
            {/* Hit rate streak */}
            <div className="flex items-center gap-1">
              <span className={cn(
                'text-[10px]',
                prop.trend === 'hot' ? 'text-orange-400' : prop.trend === 'cold' ? 'text-sky-400' : 'text-gray-500',
              )}>
                {prop.trend === 'hot' ? '🔥' : prop.trend === 'cold' ? '❄' : '→'}
              </span>
              <span className="text-[10px] text-gray-500">
                {prop.hitRate !== '—' ? `Hit in ${prop.hitRate} games` : 'No recent game data'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-card slider ───────────────────────────────────────────────────────────

function SubCardSlider({
  children,
}: {
  children: React.ReactNode[];
}) {
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const total = children.length;

  const goTo = useCallback((n: number) => setPage(Math.max(0, Math.min(n, total - 1))), [total]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 44 && Math.abs(dx) > dy * 1.5) dx > 0 ? goTo(page + 1) : goTo(page - 1);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (total === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {/* Sliding track */}
      <div className="overflow-hidden rounded-2xl" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {children.map((child, i) => (
            <div key={i} className="w-full flex-shrink-0">
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Nav: dots + arrows */}
      {total > 1 && (
        <div className="flex items-center justify-between px-0.5">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150',
              page === 0 ? 'opacity-0 pointer-events-none' : 'text-[oklch(0.45_0.01_280)] hover:text-white hover:bg-[oklch(0.18_0.015_280)]',
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5" role="tablist">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === page}
                  onClick={() => goTo(i)}
                  className={cn(
                    'rounded-full transition-all duration-250',
                    i === page ? 'w-5 h-1.5 bg-blue-400' : 'w-1.5 h-1.5 bg-[oklch(0.24_0.01_280)] hover:bg-[oklch(0.36_0.01_280)]',
                  )}
                />
              ))}
            </div>
            <span className="text-[9px] font-semibold tabular-nums text-[oklch(0.32_0.01_280)]">
              {page + 1}/{total}
            </span>
          </div>

          <button
            onClick={() => goTo(page + 1)}
            disabled={page === total - 1}
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150',
              page === total - 1 ? 'opacity-0 pointer-events-none' : 'text-[oklch(0.45_0.01_280)] hover:text-white hover:bg-[oklch(0.18_0.015_280)]',
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main StatcastCard ─────────────────────────────────────────────────────────

export const StatcastCard = memo(function StatcastCard({ data, onAnalyze, isHero = false }: StatcastCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

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
  const gameLog     = (data.data?.gameLog as GameLogEntry[] | undefined) ?? [];
  const propLines   = (data.data?.propLines as PropLine[] | undefined) ?? [];

  // Build sub-cards (only include if data is available)
  const subCards: React.ReactNode[] = [];
  if (seasonStats) subCards.push(<SeasonSubCard key="season" stats={seasonStats} conf={conf} />);
  if (gameLog.length > 0) subCards.push(<RecentFormSubCard key="recent" log={gameLog} />);
  if (propLines.length > 0) subCards.push(<PropLinesSubCard key="props" lines={propLines} />);

  return (
    <>
      {/* ── Main hero card ── */}
      <div className={`group relative bg-gradient-to-br ${conf.gradient} rounded-2xl border ${conf.accentBorder} hover:brightness-110 transition-all duration-300 shadow-lg ${isHero ? 'p-6' : 'p-4'}`}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`flex items-center justify-center flex-shrink-0 rounded-xl ${conf.iconBg} border ${conf.accentBorder} overflow-hidden ${isHero ? 'w-11 h-11 text-xl' : 'w-9 h-9 text-lg'}`}>
              {headshotUrl && !imgError ? (
                <img src={headshotUrl} alt={playerName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
              ) : conf.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[9px] font-extrabold uppercase tracking-widest ${conf.accentText}`}>{data.category ?? 'MLB'}</span>
                <span className="text-[9px] text-gray-600">·</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{data.subcategory ?? conf.label}</span>
              </div>
              <h3
                className={`font-black text-white leading-tight truncate ${isHero ? 'text-base' : 'text-sm'}${onAnalyze ? ' cursor-pointer hover:text-blue-300 transition-colors' : ''}`}
                onClick={onAnalyze}
              >
                {data.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/30 border border-white/10 flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConf.dotCls}`} />
            <span className={`text-[9px] font-extrabold tracking-widest ${statusConf.textCls}`}>{statusConf.label}</span>
          </div>
        </div>

        {/* Statcast metrics */}
        {hasSummaryMetrics && <HeroMetrics metrics={data.summary_metrics} conf={conf} />}
        <div className="space-y-0">
          {hasSummaryMetrics
            ? data.summary_metrics.slice(3).map((m, i) => <MetricRow key={i} label={m.label} value={m.value} />)
            : data.data ? <FlatDataMetrics data={data.data} /> : null
          }
        </div>

        {/* Trend note */}
        {data.trend_note && (
          <div className={`mt-3 px-3 py-2 rounded-xl ${conf.accentBg} border ${conf.accentBorder}`}>
            <p className="text-[11px] text-gray-300 leading-relaxed italic">{data.trend_note}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 border border-gray-700/40 rounded px-1.5 py-0.5">
              {data.data?.sport === 'NFL' ? 'NFL Stats'
               : data.data?.sport === 'NBA' ? 'NBA Stats'
               : data.data?.sport === 'NHL' ? 'NHL Stats'
               : 'Baseball Savant'}
            </span>
            {data.last_updated && (
              <span className="text-[9px] text-gray-600">· {data.last_updated}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onAnalyze && (
              <button onClick={onAnalyze} className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-bold transition-colors border border-white/10">
                AI Analysis
              </button>
            )}
            {hasLightbox && (
              <button onClick={() => setLightboxOpen(true)} className={`px-2.5 py-1 rounded-lg ${conf.accentBg} hover:opacity-90 ${conf.accentText} text-[10px] font-bold transition-opacity border ${conf.accentBorder}`}>
                Full Breakdown
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Sub-card slider (Season + Recent Form) ── */}
      {subCards.length > 0 && (
        <SubCardSlider>{subCards}</SubCardSlider>
      )}

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
