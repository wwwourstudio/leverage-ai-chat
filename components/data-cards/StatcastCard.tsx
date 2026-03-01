'use client';

import { useState } from 'react';

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
  lightbox?: {
    sections?: LightboxSection[];
  };
  // Legacy flat data shape (if AI returns data: {...} instead of summary_metrics)
  data?: Record<string, string | number>;
}

interface StatcastCardProps {
  data: StatcastCardData;
  onAnalyze?: () => void;
  isHero?: boolean;
}

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
// Card type display config
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<string, { emoji: string; label: string }> = {
  statcast_summary_card: { emoji: '⚾', label: 'Statcast' },
  hr_prop_card:          { emoji: '💣', label: 'HR Prop' },
  game_simulation_card:  { emoji: '🎲', label: 'Simulation' },
  leaderboard_card:      { emoji: '🏆', label: 'Leaderboard' },
  pitch_analysis_card:   { emoji: '🌀', label: 'Pitch Mix' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricRow({ label, value }: Metric) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function SummaryMetrics({ metrics }: { metrics: Metric[] }) {
  if (!metrics?.length) return null;
  return (
    <div className="mt-3 space-y-0">
      {metrics.map((m, i) => (
        <MetricRow key={i} label={m.label} value={m.value} />
      ))}
    </div>
  );
}

/** Fallback: render flat data Record as metric rows */
function FlatDataMetrics({ data }: { data: Record<string, string | number> }) {
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return (
    <div className="mt-3 space-y-0">
      {entries.map(([k, v], i) => (
        <MetricRow
          key={i}
          label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          value={String(v)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightbox (full-screen overlay, no external Dialog dependency)
// ---------------------------------------------------------------------------

function Lightbox({
  open,
  onClose,
  title,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: LightboxSection[];
}) {
  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-indigo-500/30 shadow-2xl shadow-indigo-900/40"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-white/10">
          <h3 className="text-base font-black text-white">{title}</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-colors text-sm font-bold"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Sections */}
        <div className="p-5 space-y-5">
          {sections.map((section, i) => (
            <div key={i}>
              <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-400 mb-2">
                {section.title}
              </h4>
              <div className="bg-white/5 rounded-xl p-3">
                {section.metrics?.map((m, j) => (
                  <MetricRow key={j} label={m.label} value={m.value} />
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No breakdown data available.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-sm font-bold transition-colors border border-indigo-500/30"
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

  const cardType  = (data.type ?? '').toLowerCase();
  const typeConf  = TYPE_CONFIG[cardType] ?? { emoji: '⚾', label: 'MLB' };
  const statusKey = (data.status ?? 'value').toLowerCase();
  const statusConf = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.value;

  // Prefer structured summary_metrics; fall back to flat data
  const hasSummaryMetrics = Array.isArray(data.summary_metrics) && data.summary_metrics.length > 0;

  // Lightbox sections
  const sections: LightboxSection[] = data.lightbox?.sections ?? [];
  const hasLightbox = sections.length > 0;

  return (
    <>
      <div
        className={`group relative bg-gradient-to-br ${
          data.gradient || 'from-indigo-600/80 via-violet-700/60 to-indigo-900/40'
        } rounded-2xl border border-indigo-500/20 hover:border-indigo-400/40 transition-all duration-300 shadow-lg hover:shadow-indigo-900/30 ${
          isHero ? 'p-6' : 'p-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          {/* Icon + breadcrumb */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-lg flex-shrink-0">
              {typeConf.emoji}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-400">
                  {data.category ?? 'MLB'}
                </span>
                <span className="text-[9px] text-gray-600">·</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  {data.subcategory ?? typeConf.label}
                </span>
              </div>
              <h3 className={`font-black text-white leading-tight ${isHero ? 'text-base' : 'text-sm'}`}>
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

        {/* Metrics */}
        <div className="mt-1">
          {hasSummaryMetrics ? (
            <SummaryMetrics metrics={data.summary_metrics} />
          ) : data.data ? (
            <FlatDataMetrics data={data.data} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          {/* Source tag */}
          <span className="text-[9px] font-bold text-indigo-500/70 uppercase tracking-wider">
            Statcast · Baseball Savant
          </span>

          <div className="flex items-center gap-2">
            {/* onAnalyze button (AI deep dive from parent) */}
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-bold transition-colors border border-white/10"
              >
                AI Analysis
              </button>
            )}

            {/* Lightbox trigger */}
            {hasLightbox && (
              <button
                onClick={() => setLightboxOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white text-[10px] font-bold transition-colors border border-indigo-500/30"
              >
                Full Breakdown
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={data.title}
        sections={sections}
      />
    </>
  );
}

export default StatcastCard;
