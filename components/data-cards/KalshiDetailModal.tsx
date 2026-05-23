'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { X, ExternalLink, Bookmark, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KalshiTileData } from './KalshiMarketTile';

export interface KalshiDetailOutcome extends KalshiTileData['outcomes'][0] {
  yesPrice: number;
  noPrice: number;
  priceHistory: Array<{ ts: number; pct: number }>;
}

export interface KalshiDetailData extends Omit<KalshiTileData, 'outcomes'> {
  outcomes: KalshiDetailOutcome[];
  eventTicker?: string;
  closeTimeIso?: string;
  subtitle?: string;
}

interface Props {
  market: KalshiDetailData;
  onClose: () => void;
}

const CHART_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899'];
const DATE_RANGES = ['1D', '1W', '1M', 'ALL'] as const;

function buildTradeUrl(ticker: string, eventTicker?: string): string {
  if (eventTicker) return `https://kalshi.com/markets/${eventTicker}/${ticker}`;
  return `https://kalshi.com/markets/${ticker}`;
}

function smoothCurve(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

function ProbabilityChart({
  outcomes,
  range,
}: {
  outcomes: KalshiDetailOutcome[];
  range: (typeof DATE_RANGES)[number];
}) {
  const W = 600;
  const H = 180;
  const PAD = { t: 10, r: 10, b: 20, l: 10 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const allSeries = useMemo(() => {
    return outcomes.slice(0, 5).map((o, oi) => {
      let pts = [...o.priceHistory];

      // Filter by range
      const now = Date.now();
      if (range === '1D') pts = pts.filter(p => p.ts >= now - 86400000);
      else if (range === '1W') pts = pts.filter(p => p.ts >= now - 7 * 86400000);
      else if (range === '1M') pts = pts.filter(p => p.ts >= now - 30 * 86400000);

      // Fall back to synthetic 3-point line if no history
      if (pts.length < 2) {
        const prev = Math.max(1, Math.min(99, o.yesPct - (o.isLeading ? 5 : -3)));
        pts = [
          { ts: now - 7 * 86400000, pct: prev },
          { ts: now - 3 * 86400000, pct: (prev + o.yesPct) / 2 },
          { ts: now, pct: o.yesPct },
        ];
      }

      const minTs = pts[0].ts;
      const maxTs = pts[pts.length - 1].ts;
      const tsRange = maxTs - minTs || 1;

      const svgPts = pts.map(p => ({
        x: PAD.l + ((p.ts - minTs) / tsRange) * chartW,
        y: PAD.t + (1 - p.pct / 100) * chartH,
      }));

      return { svgPts, color: CHART_COLORS[oi], outcome: o };
    });
  }, [outcomes, range, chartW, chartH, PAD.l, PAD.t]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 180 }}>
      <defs>
        {allSeries.map((s, i) => (
          <linearGradient key={i} id={`kg-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {/* Grid lines */}
      {[25, 50, 75].map(pct => {
        const y = PAD.t + (1 - pct / 100) * chartH;
        return (
          <line key={pct} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
            stroke="#2a2d3e" strokeWidth="1" />
        );
      })}
      {/* Fill + line per series */}
      {allSeries.map((s, i) => {
        const path = smoothCurve(s.svgPts);
        if (!path) return null;
        const firstPt = s.svgPts[0];
        const lastPt = s.svgPts[s.svgPts.length - 1];
        const fillPath = `${path} L ${lastPt.x} ${H - PAD.b} L ${firstPt.x} ${H - PAD.b} Z`;
        return (
          <g key={i}>
            <path d={fillPath} fill={`url(#kg-${i})`} />
            <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
            {/* Dot at current price */}
            <circle cx={lastPt.x} cy={lastPt.y} r="4" fill={s.color} />
          </g>
        );
      })}
    </svg>
  );
}

export const KalshiDetailModal = memo(function KalshiDetailModal({ market, onClose }: Props) {
  const [activeRange, setActiveRange] = useState<(typeof DATE_RANGES)[number]>('ALL');
  const [tradeMode, setTradeMode] = useState<'Buy' | 'Sell'>('Buy');
  const [selectedOutcomeIdx, setSelectedOutcomeIdx] = useState(0);
  const [history, setHistory] = useState<Array<{ ts: number; pct: number }> | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Fetch real price history for primary outcome
  useEffect(() => {
    if (!market.ticker) return;
    const ctrl = new AbortController();
    fetch(`/api/kalshi?ticker=${encodeURIComponent(market.ticker)}&include=history`, {
      signal: ctrl.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.history?.length) setHistory(d.history); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [market.ticker]);

  // Enrich outcomes with fetched history
  const enrichedOutcomes = useMemo(() => {
    return market.outcomes.map((o, i) => ({
      ...o,
      priceHistory: i === 0 && history ? history : o.priceHistory,
    }));
  }, [market.outcomes, history]);

  const selectedOutcome = enrichedOutcomes[selectedOutcomeIdx] ?? enrichedOutcomes[0];
  const tradeUrl = buildTradeUrl(market.ticker, market.eventTicker);

  const displayedOutcomes = showAll ? enrichedOutcomes : enrichedOutcomes.slice(0, 4);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#141620] border border-[#2a2d3e] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#2a2d3e] sticky top-0 bg-[#141620] z-10">
          <div className="flex-1 mr-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1 block">
              {market.categoryChip}
            </span>
            <h2 className="text-white font-bold text-base leading-snug">{market.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={tradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Open on Kalshi"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Bookmark className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col lg:flex-row gap-0">
          {/* Left: chart + outcomes */}
          <div className="flex-1 p-5">
            {/* Chart */}
            <div className="bg-[#1a1c24] rounded-xl p-4 mb-4">
              <ProbabilityChart outcomes={enrichedOutcomes} range={activeRange} />

              {/* Legend dots */}
              <div className="flex flex-wrap gap-3 mt-2">
                {enrichedOutcomes.slice(0, 5).map((o, i) => (
                  <span key={i} className="flex items-center gap-1 text-[11px] text-gray-400">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i] }} />
                    {o.label} {o.yesPct}%
                  </span>
                ))}
              </div>

              {/* Date range + volume */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1">
                  {DATE_RANGES.map(r => (
                    <button
                      key={r}
                      onClick={() => setActiveRange(r)}
                      className={`text-[11px] px-2 py-1 rounded transition-colors ${
                        activeRange === r
                          ? 'bg-[#2a2d3e] text-white'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-gray-500">{market.volume} vol</span>
              </div>
            </div>

            {/* Outcomes table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-300">Chance</span>
              </div>

              <div className="space-y-3">
                {displayedOutcomes.map((o, i) => {
                  const delta = o.priceHistory.length >= 2
                    ? o.yesPct - o.priceHistory[0].pct
                    : 0;
                  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
                  const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500';

                  return (
                    <div key={i}
                      className="cursor-pointer"
                      onClick={() => setSelectedOutcomeIdx(i)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white font-medium truncate mr-2">{o.label}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold text-white">{o.yesPct}%</span>
                          {delta !== 0 && (
                            <span className={`flex items-center gap-0.5 text-[11px] ${deltaColor}`}>
                              <DeltaIcon className="w-3 h-3" />
                              {Math.abs(delta)}
                            </span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); window.open(tradeUrl, '_blank'); }}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1a3a2e] text-[#0e9f6e] hover:bg-[#0e9f6e] hover:text-white transition-colors font-medium"
                          >
                            Yes {o.yesPrice}¢
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); window.open(tradeUrl, '_blank'); }}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-[#3a1a1e] text-red-400 hover:bg-red-600 hover:text-white transition-colors font-medium"
                          >
                            No {o.noPrice}¢
                          </button>
                        </div>
                      </div>
                      <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#0e9f6e] transition-all duration-500"
                          style={{ width: `${Math.max(2, o.yesPct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {enrichedOutcomes.length > 4 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="mt-3 text-[12px] text-teal-400 hover:text-teal-300 transition-colors"
                >
                  {showAll ? 'Show less' : `${enrichedOutcomes.length - 4} more`}
                </button>
              )}
            </div>
          </div>

          {/* Right: Buy/Sell panel */}
          <div className="lg:w-72 p-5 lg:border-l border-t lg:border-t-0 border-[#2a2d3e] flex-shrink-0">
            <div className="sticky top-20">
              {/* Market mini header */}
              <div className="mb-4 p-3 bg-[#1a1c24] rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{market.categoryChip}</p>
                <p className="text-xs text-white font-semibold line-clamp-2">{market.title}</p>
              </div>

              {/* Buy/Sell tabs */}
              <div className="flex rounded-lg bg-[#1a1c24] p-1 mb-4">
                {(['Buy', 'Sell'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setTradeMode(mode)}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                      tradeMode === mode
                        ? 'bg-[#0e9f6e] text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Outcome selector if multiple outcomes */}
              {enrichedOutcomes.length > 1 && (
                <div className="mb-4">
                  <select
                    value={selectedOutcomeIdx}
                    onChange={e => setSelectedOutcomeIdx(Number(e.target.value))}
                    className="w-full bg-[#1a1c24] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {enrichedOutcomes.map((o, i) => (
                      <option key={i} value={i}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Price tiles */}
              {selectedOutcome && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-[#1a3a2e] border border-[#0e9f6e]/30 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">Yes</p>
                    <p className="text-lg font-bold text-[#0e9f6e]">{selectedOutcome.yesPrice}¢</p>
                  </div>
                  <div className="bg-[#3a1a1e] border border-red-500/30 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">No</p>
                    <p className="text-lg font-bold text-red-400">{selectedOutcome.noPrice}¢</p>
                  </div>
                </div>
              )}

              {/* Amount display */}
              <div className="mb-4 p-3 bg-[#1a1c24] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Dollars</p>
                  <p className="text-[10px] text-teal-500">Earn 3.25% Interest</p>
                </div>
                <p className="text-xl font-bold text-gray-300">$0</p>
              </div>

              {/* Buy CTA */}
              <a
                href={tradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-[#0e9f6e] hover:bg-[#0b8a5e] text-white font-bold text-center rounded-xl transition-colors"
              >
                {tradeMode} on Kalshi ↗
              </a>

              {/* Disclaimer */}
              <p className="text-[10px] text-gray-600 text-center mt-3">
                Opens Kalshi.com to place order
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
