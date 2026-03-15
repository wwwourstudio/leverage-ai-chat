'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types (mirrors the JSON shape the MLB AI prompt returns)
// ---------------------------------------------------------------------------

interface Metric {
  label: string;
  value: string;
}

interface LightboxSection {
  title: string;
  metrics: Metric[];
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
  // Legacy flat data shape
  data?: Record<string, string | number>;
  // Optional enrichment fields
  trend_note?: string;
  last_updated?: string;
}

interface StatcastCardProps {
  data: StatcastCardData;
  onAnalyze?: () => void;
  isHero?: boolean;
}

// ---------------------------------------------------------------------------
// Type-specific visual config
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; dotCls: string; textCls: string }> = {
  hot:     { label: 'HOT',     dotCls: 'bg-red-400',     textCls: 'text-red-400' },
  edge:    { label: 'EDGE',    dotCls: 'bg-amber-400',   textCls: 'text-amber-400' },
  value:   { label: 'VALUE',   dotCls: 'bg-emerald-400', textCls: 'text-emerald-400' },
  optimal: { label: 'OPTIMAL', dotCls: 'bg-sky-400',     textCls: 'text-sky-400' },
};

// ---------------------------------------------------------------------------
// Smart value formatting
// ---------------------------------------------------------------------------

interface ValueStyle {
  textCls: string;
  barWidth?: number; // 0–100 triggers a progress bar under the row
}

function getValueStyle(value: string): ValueStyle {
  const v = (value ?? '').trim();

  // Percentage → bar + traffic-light colour
  if (v.endsWith('%')) {
    const num = parseFloat(v);
    if (!isNaN(num)) {
      const pct = Math.min(100, Math.max(0, Math.abs(num)));
      const textCls = num >= 60 ? 'text-emerald-400' : num >= 35 ? 'text-amber-400' : 'text-rose-400';
      // Only show bar for non-edge values (not +/-%)
      if (!v.startsWith('+') && !v.startsWith('-')) {
        return { textCls, barWidth: pct };
      }
      return { textCls };
    }
  }

  // Speed in mph — colour-code by exit velocity / pitch speed range
  if (v.toLowerCase().includes('mph')) {
    const num = parseFloat(v);
    if (!isNaN(num)) {
      const textCls = num >= 92 ? 'text-emerald-400' : num >= 88 ? 'text-amber-400' : 'text-rose-400';
      return { textCls };
    }
  }

  // American odds: standalone +NNN or -NNN
  if (/^[+-]\d{2,4}$/.test(v)) {
    return { textCls: v.startsWith('+') ? 'text-emerald-400' : 'text-rose-400' };
  }

  // Positive/negative differential edge (e.g. "+3.1%", "-1.2%")
  if (/^[+-][\d.]+%$/.test(v)) {
    return { textCls: v.startsWith('+') ? 'text-emerald-400' : 'text-rose-400' };
  }

  return { textCls: 'text-white' };
}

// ---------------------------------------------------------------------------
// Hero metrics strip — first 3 metrics as bold tiles
// ---------------------------------------------------------------------------

function HeroMetrics({ metrics, conf }: { metrics: Metric[]; conf: TypeConf }) {
  const top = metrics.slice(0, 3);
  if (!top.length) return null;

  return (
    <div className={`grid gap-2 mb-3 ${top.length === 1 ? 'grid-cols-1' : top.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {top.map((m, i) => {
        const { textCls } = getValueStyle(m.value);
        return (
          <div
            key={i}
            className={`flex flex-col items-center rounded-xl ${conf.accentBg} border ${conf.accentBorder} py-2.5 px-1.5 text-center`}
          >
            <span className={`text-base font-black tabular-nums leading-none ${textCls}`}>{m.value}</span>
            <span className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${conf.accentText} opacity-80 leading-tight`}>
              {m.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric row with optional progress bar
// ---------------------------------------------------------------------------

function SmartMetricRow({ label, value }: Metric) {
  const { textCls, barWidth } = getValueStyle(value);

  return (
    <div className="py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${textCls}`}>{value}</span>
      </div>
      {barWidth !== undefined && (
        <div className="mt-1 h-0.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              barWidth >= 60 ? 'bg-emerald-500/60' : barWidth >= 35 ? 'bg-amber-500/60' : 'bg-rose-500/60'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SummaryMetrics({ metrics }: { metrics: Metric[] }) {
  // First 3 shown in hero strip; render the rest here
  const rest = metrics.slice(3);
  if (!rest.length) return null;
  return (
    <div className="space-y-0">
      {rest.map((m, i) => (
        <SmartMetricRow key={i} label={m.label} value={m.value} />
      ))}
    </div>
  );
}

function FlatDataMetrics({ data }: { data: Record<string, string | number> }) {
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return (
    <div className="space-y-0">
      {entries.map(([k, v], i) => (
        <SmartMetricRow
          key={i}
          label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          value={String(v)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightbox — full-screen overlay with keyboard Escape + Copy JSON
// ---------------------------------------------------------------------------

function Lightbox({
  open,
  onClose,
  title,
  sections,
  conf,
  rawData,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: LightboxSection[];
  conf: TypeConf;
  rawData?: unknown;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCopy = useCallback(() => {
    if (!rawData) return;
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rawData]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={`relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-zinc-900 border ${conf.accentBorder} shadow-2xl`}
        onClick={(e: any) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-white leading-tight truncate">{title}</h3>
            <p className={`text-[9px] font-extrabold uppercase tracking-widest ${conf.accentText} mt-0.5`}>
              Full Breakdown · Press Esc to close
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {!!rawData && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-bold transition-colors border border-white/10"
              >
                {copied ? '✓ Copied' : 'Copy JSON'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-colors text-sm font-bold"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Sections */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {sections.map((section, i) => (
            <div key={i}>
              <h4 className={`text-[10px] font-extrabold uppercase tracking-widest ${conf.accentText} mb-2`}>
                {section.title}
              </h4>
              <div className={`rounded-xl ${conf.accentBg} border ${conf.accentBorder} px-3 py-1`}>
                {section.metrics?.map((m, j) => (
                  <SmartMetricRow key={j} label={m.label} value={m.value} />
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No breakdown data available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-white/10 shrink-0 flex items-center gap-2">
          <img src="/statcast-logo.png" alt="Statcast" className="h-3.5 w-auto opacity-60" />
          <button
            onClick={onClose}
            className={`ml-auto px-4 py-2 rounded-xl ${conf.accentBg} hover:opacity-90 ${conf.accentText} text-sm font-bold transition-opacity border ${conf.accentBorder}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main StatcastCard
// ---------------------------------------------------------------------------

export function StatcastCard({ data, onAnalyze, isHero = false }: StatcastCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const cardType   = (data.type ?? '').toLowerCase();
  const conf       = TYPE_CONFIG[cardType] ?? DEFAULT_TYPE_CONF;
  const statusKey  = (data.status ?? 'value').toLowerCase();
  const statusConf = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.value;

  const hasSummaryMetrics = Array.isArray(data.summary_metrics) && data.summary_metrics.length > 0;
  const sections: LightboxSection[] = data.lightbox?.sections ?? [];
  const hasLightbox = sections.length > 0;

  return (
    <>
      <div
        className={`group relative bg-gradient-to-br ${conf.gradient} rounded-2xl border ${conf.accentBorder} hover:brightness-110 transition-all duration-300 shadow-lg ${
          isHero ? 'p-6' : 'p-4'
        }`}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Icon + breadcrumb + title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex items-center justify-center flex-shrink-0 rounded-xl ${conf.iconBg} border ${conf.accentBorder} ${
                isHero ? 'w-11 h-11 text-xl' : 'w-9 h-9 text-lg'
              }`}
            >
              {conf.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[9px] font-extrabold uppercase tracking-widest ${conf.accentText}`}>
                  {data.category ?? 'MLB'}
                </span>
                <span className="text-[9px] text-gray-600">·</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  {data.subcategory ?? conf.label}
                </span>
              </div>
              <h3 className={`font-black text-white leading-tight truncate ${isHero ? 'text-base' : 'text-sm'}`}>
                {data.title}
              </h3>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/30 border border-white/10 flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConf.dotCls}`} />
            <span className={`text-[9px] font-extrabold tracking-widest ${statusConf.textCls}`}>
              {statusConf.label}
            </span>
          </div>
        </div>

        {/* ── Hero metrics grid (first 3) ── */}
        {hasSummaryMetrics && (
          <HeroMetrics metrics={data.summary_metrics} conf={conf} />
        )}

        {/* ── Remaining metrics list ── */}
        <div>
          {hasSummaryMetrics ? (
            <SummaryMetrics metrics={data.summary_metrics} />
          ) : data.data ? (
            <FlatDataMetrics data={data.data} />
          ) : null}
        </div>

        {/* ── Trend note ── */}
        {data.trend_note && (
          <div className={`mt-3 px-3 py-2 rounded-xl ${conf.accentBg} border ${conf.accentBorder}`}>
            <p className="text-[11px] text-gray-300 leading-relaxed italic">{data.trend_note}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          {/* Statcast logo + recency note */}
          <div className="flex items-center gap-1.5">
            <img src="/statcast-logo.png" alt="Statcast" className="h-3.5 w-auto opacity-75" />
            {data.last_updated && (
              <span className="text-[9px] text-gray-600">· {data.last_updated}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-bold transition-colors border border-white/10"
              >
                AI Analysis
              </button>
            )}
            {hasLightbox && (
              <button
                onClick={() => setLightboxOpen(true)}
                className={`px-2.5 py-1 rounded-lg ${conf.accentBg} hover:opacity-90 ${conf.accentText} text-[10px] font-bold transition-opacity border ${conf.accentBorder}`}
              >
                Full Breakdown
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      <Lightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={data.title}
        sections={sections}
        conf={conf}
        rawData={data}
      />
    </>
  );
}

export default StatcastCard;
