'use client';

import { useState, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnalysisLightbox, type LightboxSection } from './AnalysisLightbox';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Metric {
  label: string;
  value: string;
}

interface SeasonStats {
  avg: string;
  hr: number;
  rbi: number;
  ops: string;
  slg: string;
  obp: string;
  hits: number;
  atBats: number;
  gamesPlayed: number;
  sb?: number;
  era?: string;
  k?: number;
  bb?: number;
}

interface GameLogEntry {
  date: string;
  opp: string;
  result?: string;
  ab?: number;
  h?: number;
  hr?: number;
  rbi?: number;
  ip?: string;
  k?: number;
  er?: number;
  bb?: number;
}

interface StatcastCardData {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  status: string;
  summary_metrics: Metric[];
  lightbox?: { sections?: LightboxSection[] };
  data?: Record<string, any>;
  trend_note?: string;
  last_updated?: string;
}

interface StatcastCardProps {
  data: StatcastCardData;
  onAnalyze?: () => void;
  isHero?: boolean;
}

// ── Visual config ─────────────────────────────────────────────────────────────

interface TypeConf {
  emoji: string;
  label: string;
  gradient: string;
  accentBorder: string;
  accentText: string;
  accentBg: string;
  iconBg: string;
}

const TYPE_CONFIG: Record<string, TypeConf> = {
  statcast_summary_card: {
    emoji: '⚾',
    label: 'Statcast',
    gradient: 'from-blue-600/75 via-blue-900/55 to-slate-900/40',
    accentBorder: 'border-blue-500/30',
    accentText: 'text-blue-400',
    accentBg: 'bg-blue-500/15',
    iconBg: 'bg-blue-500/20',
  },
  hr_prop_card: {
    emoji: '💣',
    label: 'HR Prop',
    gradient: 'from-rose-600/75 via-red-900/55 to-slate-900/40',
    accentBorder: 'border-rose-500/30',
    accentText: 'text-rose-400',
    accentBg: 'bg-rose-500/15',
    iconBg: 'bg-rose-500/20',
  },
  game_simulation_card: {
    emoji: '🎲',
    label: 'Simulation',
    gradient: 'from-violet-600/75 via-purple-900/55 to-slate-900/40',
    accentBorder: 'border-violet-500/30',
    accentText: 'text-violet-400',
    accentBg: 'bg-violet-500/15',
    iconBg: 'bg-violet-500/20',
  },
  leaderboard_card: {
    emoji: '🏆',
    label: 'Leaderboard',
    gradient: 'from-amber-600/75 via-yellow-900/55 to-slate-900/40',
    accentBorder: 'border-amber-500/30',
    accentText: 'text-amber-400',
    accentBg: 'bg-amber-500/15',
    iconBg: 'bg-amber-500/20',
  },
  pitch_analysis_card: {
    emoji: '🌀',
    label: 'Pitch Mix',
    gradient: 'from-teal-600/75 via-cyan-900/55 to-slate-900/40',
    accentBorder: 'border-teal-500/30',
    accentText: 'text-teal-400',
    accentBg: 'bg-teal-500/15',
    iconBg: 'bg-teal-500/20',
  },
};

const DEFAULT_TYPE_CONF: TypeConf = TYPE_CONFIG.statcast_summary_card;

const STATUS_CONFIG: Record<string, { label: string; dotCls: string; textCls: string }> = {
  hot:     { label: 'HOT',     dotCls: 'bg-red-400',     textCls: 'text-red-400' },
  edge:    { label: 'EDGE',    dotCls: 'bg-amber-400',   textCls: 'text-amber-400' },
  value:   { label: 'VALUE',   dotCls: 'bg-emerald-400', textCls: 'text-emerald-400' },
  optimal: { label: 'OPTIMAL', dotCls: 'bg-sky-400',     textCls: 'text-sky-400' },
};

// ── Value formatting ──────────────────────────────────────────────────────────

interface ValueStyle { textCls: string; barWidth?: number; }

function getValueStyle(value: string): ValueStyle {
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
    if (!isNaN(num)) {
      return { textCls: num >= 92 ? 'text-emerald-400' : num >= 88 ? 'text-amber-400' : 'text-rose-400' };
    }
  }
  if (/^[+-]\d{2,4}$/.test(v)) return { textCls: v.startsWith('+') ? 'text-emerald-400' : 'text-rose-400' };
  if (/^[+-][\d.]+%$/.test(v)) return { textCls: v.startsWith('+') ? 'text-emerald-400' : 'text-rose-400' };
  return { textCls: 'text-white' };
}

// ── Statcast tab ──────────────────────────────────────────────────────────────

function HeroMetrics({ metrics, conf }: { metrics: Metric[]; conf: TypeConf }) {
  const top = metrics.slice(0, 3);
  if (!top.length) return null;
  return (
    <div className={`grid gap-2 mb-3 ${top.length === 1 ? 'grid-cols-1' : top.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
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

// ── Season stats tab ──────────────────────────────────────────────────────────

function SeasonStatsTab({ stats, conf }: { stats: SeasonStats; conf: TypeConf }) {
  const isPitcher = !!stats.era;
  if (isPitcher) {
    return (
      <div className="space-y-0">
        {[
          { label: 'ERA', value: stats.era ?? '--' },
          { label: 'K', value: String(stats.k ?? 0) },
          { label: 'BB', value: String(stats.bb ?? 0) },
          { label: 'Games', value: String(stats.gamesPlayed) },
        ].map((m, i) => <MetricRow key={i} label={m.label} value={m.value} />)}
      </div>
    );
  }

  const mainStats = [
    { label: 'AVG', value: stats.avg },
    { label: 'OPS', value: stats.ops },
    { label: 'SLG', value: stats.slg },
    { label: 'OBP', value: stats.obp },
  ];

  return (
    <div>
      {/* Big 4 tiles */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[
          { label: 'HR', value: String(stats.hr) },
          { label: 'RBI', value: String(stats.rbi) },
          { label: 'H', value: String(stats.hits) },
          { label: 'SB', value: String(stats.sb ?? 0) },
        ].map((m, i) => (
          <div key={i} className={`flex flex-col items-center rounded-xl ${conf.accentBg} border ${conf.accentBorder} py-2 text-center`}>
            <span className="text-base font-black text-white tabular-nums">{m.value}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${conf.accentText} opacity-80`}>{m.label}</span>
          </div>
        ))}
      </div>
      <div className="space-y-0">
        {mainStats.map((m, i) => <MetricRow key={i} label={m.label} value={m.value} />)}
        <MetricRow label="G" value={String(stats.gamesPlayed)} />
        <MetricRow label="AB" value={String(stats.atBats)} />
      </div>
    </div>
  );
}

// ── Recent form tab ───────────────────────────────────────────────────────────

function RecentFormTab({ log }: { log: GameLogEntry[] }) {
  if (!log.length) {
    return <p className="text-xs text-gray-500 py-4 text-center">No recent game data</p>;
  }
  const isPitcher = log[0].ip !== undefined;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-gray-500 font-semibold pb-1.5 pr-2">Date</th>
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
              <td className="py-1.5 pr-2 text-gray-400">{g.date}</td>
              <td className="py-1.5 pr-2 text-gray-300 whitespace-nowrap">{g.opp}</td>
              {isPitcher ? (
                <>
                  <td className="py-1.5 pr-2 text-right text-white font-medium">{g.ip}</td>
                  <td className="py-1.5 pr-2 text-right text-emerald-400 font-bold">{g.k}</td>
                  <td className={cn('py-1.5 pr-2 text-right font-bold', (g.er ?? 0) === 0 ? 'text-emerald-400' : (g.er ?? 0) <= 2 ? 'text-amber-400' : 'text-rose-400')}>{g.er}</td>
                  <td className="py-1.5 text-right text-gray-400">{g.bb}</td>
                </>
              ) : (
                <>
                  <td className="py-1.5 pr-2 text-right text-gray-400">{g.ab ?? '-'}</td>
                  <td className={cn('py-1.5 pr-2 text-right font-bold', (g.h ?? 0) >= 2 ? 'text-emerald-400' : (g.h ?? 0) === 1 ? 'text-amber-400' : 'text-gray-500')}>{g.h ?? '-'}</td>
                  <td className={cn('py-1.5 pr-2 text-right font-bold', (g.hr ?? 0) > 0 ? 'text-rose-400' : 'text-gray-500')}>{g.hr ?? 0}</td>
                  <td className="py-1.5 text-right text-gray-400">{g.rbi ?? 0}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'statcast' | 'season' | 'recent';

interface TabBarProps {
  active: Tab;
  onChange: (t: Tab) => void;
  hasSeason: boolean;
  hasRecent: boolean;
  conf: TypeConf;
}

function TabBar({ active, onChange, hasSeason, hasRecent, conf }: TabBarProps) {
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'statcast', label: 'Statcast' },
    ...(hasSeason ? [{ id: 'season' as Tab, label: 'Season' }] : []),
    ...(hasRecent  ? [{ id: 'recent'  as Tab, label: 'Recent' }] : []),
  ];
  if (tabs.length < 2) return null;
  return (
    <div className="flex gap-1 mb-3 border-b border-white/10 pb-0 -mx-0">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'text-[11px] font-semibold px-2.5 py-1.5 transition-colors border-b-2 -mb-px',
            active === t.id
              ? `${conf.accentText} border-current`
              : 'text-gray-500 border-transparent hover:text-gray-300',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Flat data fallback ────────────────────────────────────────────────────────

function FlatDataMetrics({ data }: { data: Record<string, string | number> }) {
  const SKIP_KEYS = new Set(['playerName', 'realData', 'headshotUrl', 'seasonStats', 'gameLog']);
  const entries = Object.entries(data).filter(([k]) => !SKIP_KEYS.has(k));
  if (!entries.length) return null;
  return (
    <div className="space-y-0">
      {entries.map(([k, v], i) => (
        <MetricRow key={i} label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={String(v)} />
      ))}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export const StatcastCard = memo(function StatcastCard({ data, onAnalyze, isHero = false }: StatcastCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('statcast');

  const cardType   = (data.type ?? '').toLowerCase();
  const conf       = TYPE_CONFIG[cardType] ?? DEFAULT_TYPE_CONF;
  const statusKey  = (data.status ?? 'value').toLowerCase();
  const statusConf = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.value;

  const hasSummaryMetrics = Array.isArray(data.summary_metrics) && data.summary_metrics.length > 0;
  const sections: LightboxSection[] = data.lightbox?.sections ?? [];
  const hasLightbox = sections.length > 0;

  const playerName  = data.data?.playerName as string ?? data.title ?? '';
  const headshotUrl = (data.data?.headshotUrl as string | null | undefined) ?? getPlayerHeadshotUrl(playerName);
  const seasonStats = data.data?.seasonStats as SeasonStats | undefined;
  const gameLog     = (data.data?.gameLog as GameLogEntry[] | undefined) ?? [];

  const hasSeason = !!seasonStats;
  const hasRecent = gameLog.length > 0;

  return (
    <>
      <div className={`group relative bg-gradient-to-br ${conf.gradient} rounded-2xl border ${conf.accentBorder} hover:brightness-110 transition-all duration-300 shadow-lg ${isHero ? 'p-6' : 'p-4'}`}>

        {/* ── Header ── */}
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

        {/* ── Tab bar ── */}
        <TabBar active={activeTab} onChange={setActiveTab} hasSeason={hasSeason} hasRecent={hasRecent} conf={conf} />

        {/* ── Tab content ── */}
        {activeTab === 'statcast' && (
          <>
            {hasSummaryMetrics && <HeroMetrics metrics={data.summary_metrics} conf={conf} />}
            {hasSummaryMetrics
              ? <div className="space-y-0">{data.summary_metrics.slice(3).map((m, i) => <MetricRow key={i} label={m.label} value={m.value} />)}</div>
              : data.data ? <FlatDataMetrics data={data.data} /> : null
            }
          </>
        )}

        {activeTab === 'season' && seasonStats && (
          <SeasonStatsTab stats={seasonStats} conf={conf} />
        )}

        {activeTab === 'recent' && (
          <RecentFormTab log={gameLog} />
        )}

        {/* ── Trend note (Statcast tab only) ── */}
        {activeTab === 'statcast' && data.trend_note && (
          <div className={`mt-3 px-3 py-2 rounded-xl ${conf.accentBg} border ${conf.accentBorder}`}>
            <p className="text-[11px] text-gray-300 leading-relaxed italic">{data.trend_note}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 border border-gray-700/40 rounded px-1.5 py-0.5">
              {activeTab === 'season' ? 'MLB Stats API'
               : activeTab === 'recent' ? 'Game Log'
               : (data.data?.sport === 'NFL' ? 'NFL Stats'
               : data.data?.sport === 'NBA' ? 'NBA Stats'
               : 'Baseball Savant')}
            </span>
            {data.last_updated && activeTab === 'statcast' && (
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
