'use client';

import { useState, useCallback, memo } from 'react';
import { TrendingUp, Activity, BarChart3, Bookmark, Zap, Wind } from 'lucide-react';
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
        // Notify app-level badge counter
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
    <div className="py-1.5 border-b border-[var(--border-subtle)] last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${textCls}`}>{value}</span>
      </div>
      {barWidth !== undefined && (
        <div className="mt-1 h-0.5 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barWidth >= 60 ? 'bg-emerald-500/60' : barWidth >= 35 ? 'bg-amber-500/60' : 'bg-rose-500/60'}`} style={{ width: `${barWidth}%` }} />
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
    <div
      className="flex gap-1 mb-3 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {PITCHER_TABS.map((label, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={cn(
            'flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold border transition-all duration-150',
            active === i
              ? `${accentBg} ${accentBorder} ${accentText}`
              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Tab 0: Stats ──────────────────────────────────────────────────────────────
// Shows the top 3 hero metrics only + trend note (clean summary view)

function TabStats({ metrics, trendNote, conf }: {
  metrics: Metric[]; trendNote?: string; conf: TypeConf;
}) {
  return (
    <div>
      <HeroMetrics metrics={metrics} conf={conf} />
      {trendNote && (
        <div className={`mt-3 px-3 py-2 rounded-xl ${conf.accentBg} border ${conf.accentBorder}`}>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed italic">{trendNote}</p>
        </div>
      )}
    </div>
  );
}

// ── Tab 1: Advanced ───────────────────────────────────────────────────────────
// Always shows the remaining summary_metrics (index 3+) so it's never empty,
// plus pitch arsenal / spin-rate / season stats / game log when available.

function TabAdvanced({ metrics, data, seasonStats, gameLog, conf }: {
  metrics: Metric[];
  data: Record<string, any>;
  seasonStats?: SeasonStats;
  gameLog: GameLogEntry[];
  conf: TypeConf;
}) {
  const extraMetrics = metrics.slice(3);           // Whiff%, K%, FB Velo, Barrel%, BB%…
  const hasPitchMix  = data.pitchMixFB || data.pitchMixBrk || data.pitchMixOff;
  const hasRelease   = data.spinRate || data.extension || data.hBreak || data.vBreak;
  const hasSeason    = !!seasonStats;
  const hasLog       = gameLog.length > 0;

  return (
    <div className="space-y-3">
      {/* Core rate stats — always present (Whiff%, K%, FB Velo, Barrel%, BB%, …) */}
      {extraMetrics.length > 0 && (
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--text-faint)] mb-1.5">Rate Stats</p>
          <div className="space-y-0">
            {extraMetrics.map((m, i) => <MetricRow key={i} label={m.label} value={m.value} />)}
          </div>
        </div>
      )}

      {/* Pitch Arsenal */}
      {hasPitchMix && (
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--text-faint)] mb-2">Pitch Arsenal</p>
          <div className="flex gap-1.5">
            {data.pitchMixFB && (
              <div className="flex-1 flex flex-col items-center rounded-xl bg-blue-500/15 border border-blue-500/30 py-2 px-1">
                <span className="text-sm font-black text-blue-300 tabular-nums">{data.pitchMixFB}</span>
                <span className="text-[9px] font-bold uppercase text-blue-400/70 mt-0.5">Fastball</span>
              </div>
            )}
            {data.pitchMixBrk && (
              <div className="flex-1 flex flex-col items-center rounded-xl bg-violet-500/15 border border-violet-500/30 py-2 px-1">
                <span className="text-sm font-black text-violet-300 tabular-nums">{data.pitchMixBrk}</span>
                <span className="text-[9px] font-bold uppercase text-violet-400/70 mt-0.5">Breaking</span>
              </div>
            )}
            {data.pitchMixOff && (
              <div className="flex-1 flex flex-col items-center rounded-xl bg-amber-500/15 border border-amber-500/30 py-2 px-1">
                <span className="text-sm font-black text-amber-300 tabular-nums">{data.pitchMixOff}</span>
                <span className="text-[9px] font-bold uppercase text-amber-400/70 mt-0.5">Offspeed</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spin & Release */}
      {hasRelease && (
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--text-faint)] mb-2">Spin & Release</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Spin Rate', val: data.spinRate },
              { label: 'Extension', val: data.extension },
              { label: 'H-Break',   val: data.hBreak },
              { label: 'V-Break',   val: data.vBreak },
            ].filter(r => r.val).map((r, i) => (
              <div key={i} className="bg-[var(--bg-elevated)] rounded-xl p-2.5 text-center">
                <p className={`text-sm font-black tabular-nums ${conf.accentText}`}>{r.val}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-faint)] mt-0.5">{r.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season Stats */}
      {hasSeason && seasonStats && (
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--text-faint)] mb-2">Season Stats</p>
          <div className="grid grid-cols-4 gap-1">
            {[
              { label: 'ERA', val: seasonStats.era ?? '--' },
              { label: 'K',   val: String(seasonStats.k ?? 0) },
              { label: 'BB',  val: String(seasonStats.bb ?? 0) },
              { label: 'G',   val: String(seasonStats.gamesPlayed) },
            ].map((s, i) => (
              <div key={i} className="bg-[var(--bg-elevated)] rounded-xl p-2 text-center">
                <p className={`text-sm font-black tabular-nums ${i < 2 ? conf.accentText : 'text-foreground/70'}`}>{s.val}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-faint)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Form */}
      {hasLog && (
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--text-faint)] mb-2">Recent Form</p>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left text-[var(--text-faint)] font-semibold pb-1.5 pr-2">Date</th>
                  <th className="text-left text-[var(--text-faint)] font-semibold pb-1.5 pr-2">Opp</th>
                  <th className="text-right text-[var(--text-faint)] font-semibold pb-1.5 pr-2">IP</th>
                  <th className="text-right text-[var(--text-faint)] font-semibold pb-1.5 pr-2">K</th>
                  <th className="text-right text-[var(--text-faint)] font-semibold pb-1.5 pr-2">ER</th>
                  <th className="text-right text-[var(--text-faint)] font-semibold pb-1.5">BB</th>
                </tr>
              </thead>
              <tbody>
                {gameLog.map((g, i) => (
                  <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="py-1.5 pr-2 text-[var(--text-muted)] whitespace-nowrap">{g.date}</td>
                    <td className="py-1.5 pr-2 text-[var(--text-muted)] font-medium whitespace-nowrap">{g.opp}</td>
                    <td className="py-1.5 pr-2 text-right text-foreground font-medium">{g.ip ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-right font-bold text-emerald-400">{g.k ?? '—'}</td>
                    <td className={cn('py-1.5 pr-2 text-right font-bold',
                      (g.er ?? 0) === 0 ? 'text-emerald-400' : (g.er ?? 0) <= 2 ? 'text-amber-400' : 'text-rose-400'
                    )}>{g.er ?? '—'}</td>
                    <td className="py-1.5 text-right text-[var(--text-muted)]">{g.bb ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      <div className="space-y-4">
        {propLines.map((prop, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-foreground">{prop.label} O{prop.line}</span>
              <span className={cn('text-[11px] font-black tabular-nums',
                prop.overOdds > 0 ? 'text-emerald-400' : 'text-amber-300'
              )}>{fmtOdds(prop.overOdds)}</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    prop.impliedPct >= 60 ? 'bg-emerald-500/70'
                    : prop.impliedPct >= 45 ? 'bg-amber-500/70'
                    : 'bg-rose-500/60'
                  )}
                  style={{ width: `${barWidth(prop.impliedPct)}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-9 text-right">{prop.impliedPct}% imp</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={cn('text-[10px]',
                prop.trend === 'hot' ? 'text-orange-400' : prop.trend === 'cold' ? 'text-sky-400' : 'text-[var(--text-faint)]'
              )}>{prop.trend === 'hot' ? '🔥' : prop.trend === 'cold' ? '❄' : '→'}</span>
              <span className="text-[10px] text-[var(--text-faint)]">
                {prop.hitRate !== '—' ? `Hit in ${prop.hitRate} games` : 'No recent game data'}
              </span>
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
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--text-faint)] mb-2">K Projection Estimate</p>
          <div className="grid grid-cols-2 gap-1.5">
            {kPctRaw != null && (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2.5 text-center">
                <p className="text-sm font-black text-emerald-300 tabular-nums">{kPctRaw.toFixed(1)}%</p>
                <p className="text-[9px] font-bold uppercase text-emerald-400/70 mt-0.5">Season K%</p>
              </div>
            )}
            {fbVeloRaw != null && (
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-2.5 text-center">
                <p className="text-sm font-black text-blue-300 tabular-nums">{fbVeloRaw.toFixed(1)} mph</p>
                <p className="text-[9px] font-bold uppercase text-blue-400/70 mt-0.5">FB Velocity</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 py-4">
        <Zap className="w-5 h-5 text-[var(--text-faint)]" />
        <p className="text-[11px] text-[var(--text-faint)] text-center">Live prop lines load when game is scheduled</p>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="mt-1 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold hover:bg-blue-500/25 transition-colors"
          >
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
  const gameLog     = (data.data?.gameLog as GameLogEntry[] | undefined) ?? [];
  const propLines   = (data.data?.propLines as PropLine[] | undefined) ?? [];

  const { watched, toggle: toggleWatch } = useWatchlist(playerName);

  // Only show tabs for pitcher analysis cards; other statcast types keep the original flat layout
  const isPitcherCard = cardType === 'statcast_summary_card';

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
                <span className="text-[9px] text-[var(--border-subtle)]">·</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-faint)]">{data.subcategory ?? conf.label}</span>
              </div>
              <h3
                className={`font-black text-foreground leading-tight truncate ${isHero ? 'text-base' : 'text-sm'}${onAnalyze ? ' cursor-pointer hover:text-blue-300 transition-colors' : ''}`}
                onClick={onAnalyze}
              >
                {data.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Watchlist heart */}
            {isPitcherCard && (
              <button
                onClick={toggleWatch}
                title={watched ? 'Remove bookmark' : 'Bookmark player'}
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150',
                  watched
                    ? 'text-blue-500 bg-blue-500/20 border border-blue-500/30'
                    : 'text-[var(--text-faint)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:text-blue-500 hover:bg-blue-500/10',
                )}
              >
                <Bookmark className="w-3.5 h-3.5" fill={watched ? 'currentColor' : 'none'} />
              </button>
            )}
            {/* Status badge */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-overlay)]/20 border border-[var(--border-subtle)]">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConf.dotCls}`} />
              <span className={`text-[9px] font-extrabold tracking-widest ${statusConf.textCls}`}>{statusConf.label}</span>
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
          /* Non-pitcher statcast cards: original flat layout */
          <>
            {hasSummaryMetrics && <HeroMetrics metrics={data.summary_metrics} conf={conf} />}
            <div className="space-y-0">
              {hasSummaryMetrics
                ? data.summary_metrics.slice(3).map((m: Metric, i: number) => <MetricRow key={i} label={m.label} value={m.value} />)
                : data.data ? (
                    <div className="space-y-0">
                      {Object.entries(data.data)
                        .filter(([k]) => !['playerName','realData','headshotUrl','seasonStats','gameLog','propLines'].includes(k))
                        .map(([k, v], i) => (
                          <MetricRow key={i} label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={String(v)} />
                        ))
                      }
                    </div>
                  ) : null
              }
            </div>
            {data.trend_note && (
              <div className={`mt-3 px-3 py-2 rounded-xl ${conf.accentBg} border ${conf.accentBorder}`}>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed italic">{data.trend_note}</p>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5">
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
              <button onClick={onAnalyze} className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-foreground text-[10px] font-bold transition-colors border border-[var(--border-subtle)]">
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
