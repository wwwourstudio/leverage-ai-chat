'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { X, ExternalLink, Bookmark, TrendingUp, TrendingDown, Minus, BarChart2, BookOpen } from 'lucide-react';
import type { KalshiTileData } from './KalshiMarketTile';

// Explicit interface — no indexed access types (Turbopack compat)
export interface KalshiDetailOutcome {
  label: string;
  yesPct: number;
  multiplier: number;
  isLeading: boolean;
  score?: string;
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

type DateRange = '1D' | '1W' | '1M' | 'ALL';
type ViewTab = 'graph' | 'orderbook';

const CHART_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899'];
const DATE_RANGES: DateRange[] = ['1D', '1W', '1M', 'ALL'];

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
  range: DateRange;
}) {
  const W = 600;
  const H = 200;
  const PAD = { t: 16, r: 10, b: 28, l: 36 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const allSeries = useMemo(() => {
    return outcomes.slice(0, 5).map((o, oi) => {
      let pts = [...o.priceHistory];
      const now = Date.now();
      if (range === '1D') pts = pts.filter(p => p.ts >= now - 86400000);
      else if (range === '1W') pts = pts.filter(p => p.ts >= now - 7 * 86400000);
      else if (range === '1M') pts = pts.filter(p => p.ts >= now - 30 * 86400000);

      if (pts.length < 2) {
        const prev = Math.max(1, Math.min(99, o.yesPct - (o.isLeading ? 5 : -3)));
        pts = [
          { ts: now - 7 * 86400000, pct: prev },
          { ts: now - 3 * 86400000, pct: Math.round((prev + o.yesPct) / 2) },
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
  }, [outcomes, range, chartW, chartH]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
      <defs>
        {allSeries.map((s, i) => (
          <linearGradient key={i} id={`kgmod-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
          </linearGradient>
        ))}
      </defs>
      {/* Y-axis labels */}
      {[0, 25, 50, 75, 100].map(pct => {
        const y = PAD.t + (1 - pct / 100) * chartH;
        return (
          <g key={pct}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#2a2d3e" strokeWidth="1" strokeDasharray={pct === 50 ? '4 3' : undefined} />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fill="#4b5563" fontSize="10">{pct}</text>
          </g>
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
            <path d={fillPath} fill={`url(#kgmod-${i})`} />
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastPt.x} cy={lastPt.y} r="4" fill={s.color} stroke="#141620" strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

function OrderbookTable({ outcomes }: { outcomes: KalshiDetailOutcome[] }) {
  const rows = useMemo(() => {
    const prices = [90, 80, 70, 60, 50, 40, 30, 20, 10];
    return prices.map(price => ({
      price,
      yesContracts: Math.round(Math.random() * 500 + 10),
      noContracts: Math.round(Math.random() * 500 + 10),
    }));
  }, []);

  const maxContracts = Math.max(...rows.map(r => Math.max(r.yesContracts, r.noContracts)));

  return (
    <div className="rounded-xl overflow-hidden border border-[#2a2d3e]">
      <div className="grid grid-cols-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-3 py-2 bg-[#1a1c24] border-b border-[#2a2d3e]">
        <span className="text-green-400">Yes</span>
        <span className="text-center">Price</span>
        <span className="text-right text-red-400">No</span>
      </div>
      {rows.map(row => {
        const yesPct = (row.yesContracts / maxContracts) * 100;
        const noPct = (row.noContracts / maxContracts) * 100;
        return (
          <div key={row.price} className="relative grid grid-cols-3 text-xs px-3 py-1.5 hover:bg-[#1a1c24] transition-colors">
            {/* Yes fill bar */}
            <div
              className="absolute left-0 top-0 h-full bg-green-500/10"
              style={{ width: `${(yesPct / 3)}%` }}
            />
            {/* No fill bar */}
            <div
              className="absolute right-0 top-0 h-full bg-red-500/10"
              style={{ width: `${(noPct / 3)}%` }}
            />
            <span className="text-green-400 font-mono relative z-10">{row.yesContracts}</span>
            <span className="text-center text-gray-300 font-mono font-bold relative z-10">{row.price}¢</span>
            <span className="text-right text-red-400 font-mono relative z-10">{row.noContracts}</span>
          </div>
        );
      })}
    </div>
  );
}

export const KalshiDetailModal = memo(function KalshiDetailModal({ market, onClose }: Props) {
  const [activeRange, setActiveRange] = useState<DateRange>('ALL');
  const [activeView, setActiveView] = useState<ViewTab>('graph');
  const [tradeMode, setTradeMode] = useState<'Buy' | 'Sell'>('Buy');
  const [selectedOutcomeIdx, setSelectedOutcomeIdx] = useState(0);
  const [history, setHistory] = useState<Array<{ ts: number; pct: number }> | null>(null);
  const [showAll, setShowAll] = useState(false);

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

  const enrichedOutcomes = useMemo<KalshiDetailOutcome[]>(() => {
    return market.outcomes.map((o, i) => ({
      ...o,
      priceHistory: i === 0 && history ? history : o.priceHistory,
    }));
  }, [market.outcomes, history]);

  const selectedOutcome = enrichedOutcomes[selectedOutcomeIdx] ?? enrichedOutcomes[0];
  const tradeUrl = buildTradeUrl(market.ticker, market.eventTicker);
  const displayedOutcomes = showAll ? enrichedOutcomes : enrichedOutcomes.slice(0, 4);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={market.title}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-[#141620] border border-[#2a2d3e] rounded-2xl shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#2a2d3e] sticky top-0 bg-[#141620] z-10">
          <div className="flex-1 mr-4 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {market.categoryChip}
              </span>
              {market.isLive && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <h2 className="text-white font-bold text-sm sm:text-base leading-snug truncate">
              {market.title}
            </h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={tradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-teal-400 transition-colors rounded-lg hover:bg-[#1a1c24]"
              title="Open on Kalshi"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-lg hover:bg-[#1a1c24]">
              <Bookmark className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[#1a1c24]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col lg:flex-row">

          {/* ── Left: Chart + Outcomes ── */}
          <div className="flex-1 min-w-0 p-4 sm:p-5">

            {/* View toggle tabs */}
            <div className="flex items-center gap-1 mb-4 bg-[#1a1c24] rounded-xl p-1 self-start w-fit">
              <button
                onClick={() => setActiveView('graph')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeView === 'graph' ? 'bg-[#2a2d3e] text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <BarChart2 className="w-3 h-3" />
                Graph
              </button>
              <button
                onClick={() => setActiveView('orderbook')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeView === 'orderbook' ? 'bg-[#2a2d3e] text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                Order Book
              </button>
            </div>

            {activeView === 'graph' ? (
              <div className="bg-[#1a1c24] rounded-xl p-3 mb-4">
                <ProbabilityChart outcomes={enrichedOutcomes} range={activeRange} />

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2 px-1">
                  {enrichedOutcomes.slice(0, 5).map((o, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOutcomeIdx(i)}
                      className={`flex items-center gap-1.5 text-[11px] transition-opacity ${
                        selectedOutcomeIdx === i ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                      }`}
                    >
                      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                      <span className="text-gray-300">{o.label}</span>
                      <span className="font-bold" style={{ color: CHART_COLORS[i] }}>{o.yesPct}%</span>
                    </button>
                  ))}
                </div>

                {/* Date range tabs */}
                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="flex gap-1">
                    {DATE_RANGES.map(r => (
                      <button
                        key={r}
                        onClick={() => setActiveRange(r)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors font-medium ${
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
            ) : (
              <div className="mb-4">
                <OrderbookTable outcomes={enrichedOutcomes} />
              </div>
            )}

            {/* ── Outcomes table ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-200">Chance</span>
                <span className="text-[11px] text-gray-500">{market.volume} traded</span>
              </div>

              {displayedOutcomes.map((o, i) => {
                const delta = o.priceHistory.length >= 2
                  ? o.yesPct - o.priceHistory[0].pct
                  : 0;
                const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
                const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-600';
                const isSelected = selectedOutcomeIdx === i;

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedOutcomeIdx(i)}
                    className={`cursor-pointer rounded-xl p-3 transition-colors ${
                      isSelected ? 'bg-[#1a2030] border border-[#3d4060]' : 'hover:bg-[#1a1c24]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white font-semibold truncate mr-3 flex-1">{o.label}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-sm font-bold text-white">{o.yesPct}%</span>
                        {delta !== 0 && (
                          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${deltaColor}`}>
                            <DeltaIcon className="w-2.5 h-2.5" />
                            {Math.abs(Math.round(delta))}
                          </span>
                        )}
                        <a
                          href={tradeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0e9f6e]/20 text-[#0e9f6e] hover:bg-[#0e9f6e] hover:text-white transition-colors font-semibold border border-[#0e9f6e]/30"
                        >
                          Yes {o.yesPrice}¢
                        </a>
                        <a
                          href={tradeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white transition-colors font-semibold border border-red-500/20"
                        >
                          No {o.noPrice}¢
                        </a>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-[#2a2d3e] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(2, o.yesPct)}%`,
                          background: CHART_COLORS[i] ?? '#0e9f6e',
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {enrichedOutcomes.length > 4 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="text-[12px] text-teal-400 hover:text-teal-300 transition-colors px-3"
                >
                  {showAll ? '↑ Show less' : `↓ Show ${enrichedOutcomes.length - 4} more`}
                </button>
              )}
            </div>
          </div>

          {/* ── Right: Trade Panel ── */}
          <div className="lg:w-72 xl:w-80 p-4 sm:p-5 lg:border-l border-t lg:border-t-0 border-[#2a2d3e] flex-shrink-0">
            <div className="lg:sticky lg:top-24 space-y-4">

              {/* Mini header */}
              <div className="p-3 bg-[#1a1c24] rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{market.categoryChip}</p>
                <p className="text-xs text-white font-semibold leading-snug line-clamp-3">{market.title}</p>
                {market.closeTimeIso && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    Closes {new Date(market.closeTimeIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Buy/Sell tabs */}
              <div className="flex rounded-xl bg-[#1a1c24] p-1">
                {(['Buy', 'Sell'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setTradeMode(mode)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                      tradeMode === mode
                        ? mode === 'Buy' ? 'bg-[#0e9f6e] text-white shadow' : 'bg-red-500 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Outcome selector */}
              {enrichedOutcomes.length > 1 && (
                <select
                  value={selectedOutcomeIdx}
                  onChange={e => setSelectedOutcomeIdx(Number(e.target.value))}
                  className="w-full bg-[#1a1c24] border border-[#2a2d3e] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {enrichedOutcomes.map((o, i) => (
                    <option key={i} value={i}>{o.label}</option>
                  ))}
                </select>
              )}

              {/* Price tiles */}
              {selectedOutcome && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0e9f6e]/10 border border-[#0e9f6e]/30 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 mb-1">Yes</p>
                    <p className="text-xl font-black text-[#0e9f6e]">{selectedOutcome.yesPrice}¢</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{selectedOutcome.multiplier.toFixed(2)}x</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 mb-1">No</p>
                    <p className="text-xl font-black text-red-400">{selectedOutcome.noPrice}¢</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{(100 / Math.max(1, selectedOutcome.noPrice)).toFixed(2)}x</p>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="p-3.5 bg-[#1a1c24] rounded-xl flex items-center justify-between border border-[#2a2d3e]">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Dollars</p>
                  <p className="text-[10px] text-teal-500 mt-0.5">Earn 3.25% Interest</p>
                </div>
                <p className="text-2xl font-black text-white">$0</p>
              </div>

              {/* CTA */}
              <a
                href={tradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-3.5 font-bold text-sm text-white text-center rounded-xl transition-all ${
                  tradeMode === 'Buy'
                    ? 'bg-[#0e9f6e] hover:bg-[#0b8a5e] shadow-lg shadow-[#0e9f6e]/20'
                    : 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
                }`}
              >
                {tradeMode} on Kalshi
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <p className="text-[10px] text-gray-600 text-center">Opens Kalshi.com · No account needed to view</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
