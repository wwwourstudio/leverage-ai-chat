'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { X, ExternalLink, Bookmark, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KalshiTileOutcome, KalshiTileData } from './KalshiMarketTile';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KalshiDetailOutcome extends KalshiTileOutcome {
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

interface OrderLevel {
  price: number;
  quantity: number;
}

interface Orderbook {
  yesBids: OrderLevel[];
  yesAsks: OrderLevel[];
  noBids: OrderLevel[];
  noAsks: OrderLevel[];
}

interface Props {
  market: KalshiDetailData;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#16a34a', '#ea580c', '#3b82f6', '#a855f7', '#ec4899'];
type DateRange = '1D' | '1W' | '1M' | 'ALL';
type ViewTab = 'graph' | 'tradeYes' | 'tradeNo';
const DATE_RANGES: DateRange[] = ['1D', '1W', '1M', 'ALL'];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fmtDollar(price: number, qty: number): string {
  const total = (price * qty) / 100;
  return `$${total.toFixed(2)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
        const windowMs =
          range === '1D' ? 86400000 :
          range === '1W' ? 7 * 86400000 :
          range === '1M' ? 30 * 86400000 : 90 * 86400000;
        const prev = Math.max(1, Math.min(99, o.yesPct - (o.isLeading ? 5 : -3)));
        pts = [
          { ts: now - windowMs, pct: prev },
          { ts: now - windowMs / 2, pct: Math.round((prev + o.yesPct) / 2) },
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

      return { svgPts, color: CHART_COLORS[oi] ?? CHART_COLORS[0], outcome: o };
    });
  }, [outcomes, range, chartW, chartH]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
      <defs>
        {allSeries.map((s, i) => (
          <linearGradient key={i} id={`kgmd-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
          </linearGradient>
        ))}
      </defs>
      {[0, 25, 50, 75, 100].map(pct => {
        const y = PAD.t + (1 - pct / 100) * chartH;
        return (
          <g key={pct}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
              stroke="#2a2d3e" strokeWidth="1"
              strokeDasharray={pct === 50 ? '4 3' : undefined} />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fill="#4b5563" fontSize="10">{pct}</text>
          </g>
        );
      })}
      {allSeries.map((s, i) => {
        const path = smoothCurve(s.svgPts);
        if (!path) return null;
        const firstPt = s.svgPts[0];
        const lastPt = s.svgPts[s.svgPts.length - 1];
        const fillPath = `${path} L ${lastPt.x} ${H - PAD.b} L ${firstPt.x} ${H - PAD.b} Z`;
        return (
          <g key={i}>
            <path d={fillPath} fill={`url(#kgmd-${i})`} />
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastPt.x} cy={lastPt.y} r="4" fill={s.color}
              stroke="#141620" strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

function OrderbookView({
  orderbook,
  side,
  ticker,
}: {
  orderbook: Orderbook | null;
  side: 'yes' | 'no';
  ticker: string;
}) {
  const rows = useMemo(() => {
    if (!orderbook) return [];
    const levels = side === 'yes' ? orderbook.yesBids : orderbook.noBids;
    return [...levels]
      .sort((a, b) => b.price - a.price)
      .slice(0, 12);
  }, [orderbook, side]);

  const maxQty = Math.max(...rows.map(r => r.quantity), 1);

  if (!orderbook) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
        Loading order book…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
        No orders in book
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[#2a2d3e]">
      {/* Header */}
      <div className="grid grid-cols-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 px-4 py-2 bg-[#1a1c24] border-b border-[#2a2d3e]">
        <span className={side === 'yes' ? 'text-green-500' : 'text-red-400'}>Price</span>
        <span className="text-center">Contracts</span>
        <span className="text-right">Total</span>
      </div>
      {rows.map((row, i) => {
        const fillPct = (row.quantity / maxQty) * 100;
        const isYes = side === 'yes';
        return (
          <div key={i} className="relative grid grid-cols-3 text-xs px-4 py-1.5 hover:bg-[#1e2030] transition-colors">
            {/* Fill bar */}
            <div
              className={`absolute right-0 top-0 h-full ${isYes ? 'bg-red-900/40' : 'bg-green-900/30'}`}
              style={{ width: `${fillPct}%` }}
            />
            <span className={`font-mono font-bold relative z-10 ${isYes ? 'text-red-400' : 'text-green-400'}`}>
              {row.price}¢
            </span>
            <span className="text-center text-gray-300 font-mono relative z-10">
              {row.quantity.toLocaleString()}
            </span>
            <span className="text-right text-gray-400 font-mono relative z-10">
              {fmtDollar(row.price, row.quantity)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export const KalshiDetailModal = memo(function KalshiDetailModal({ market, onClose }: Props) {
  const [activeRange, setActiveRange] = useState<DateRange>('ALL');
  const [activeView, setActiveView] = useState<ViewTab>('graph');
  const [tradeMode, setTradeMode] = useState<'Buy' | 'Sell'>('Buy');
  const [selectedOutcomeIdx, setSelectedOutcomeIdx] = useState(0);
  const [history, setHistory] = useState<Array<{ ts: number; pct: number }> | null>(null);
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Fetch price history + orderbook in parallel on open
  useEffect(() => {
    if (!market.ticker) return;
    const ctrl = new AbortController();

    fetch(`/api/kalshi?ticker=${encodeURIComponent(market.ticker)}&include=history,orderbook`, {
      signal: ctrl.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.history?.length) setHistory(d.history);
        if (d.orderbook) setOrderbook(d.orderbook);
      })
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
  const displayedOutcomes = showAll ? enrichedOutcomes : enrichedOutcomes.slice(0, 6);

  const obSide = activeView === 'tradeYes' ? 'yes' : 'no';

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={market.title}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-[#0d0f18] border border-[#2a2d3e] rounded-2xl shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#2a2d3e] sticky top-0 bg-[#0d0f18] z-10">
          <div className="flex-1 mr-4 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {market.categoryChip}
              </span>
              {market.isLive && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE{market.liveStatus ? ` ${market.liveStatus}` : ''}
                </span>
              )}
            </div>
            <h2 className="text-white font-bold text-sm sm:text-base leading-snug">
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

          {/* ── Left: Chart / Orderbook + Outcomes ── */}
          <div className="flex-1 min-w-0 p-4 sm:p-5">

            {/* ── Spread and Total header (sports style) ── */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-200">
                {market.subcategoryLabel || 'Prediction Market'}
              </h3>
              <span className="text-[11px] text-gray-500">{market.volume} vol</span>
            </div>

            {/* ── Outcomes table ── */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Chance</span>
              <span className="text-[11px] text-gray-600">{market.closeTimeIso ? `Closes ${new Date(market.closeTimeIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</span>
            </div>
            <div className="space-y-2 mb-5">
              {displayedOutcomes.map((o, i) => {
                const delta = o.priceHistory.length >= 2
                  ? o.yesPct - o.priceHistory[0].pct
                  : 0;
                const DeltaIcon = delta > 1 ? TrendingUp : delta < -1 ? TrendingDown : Minus;
                const deltaColor = delta > 1 ? 'text-green-400' : delta < -1 ? 'text-red-400' : 'text-gray-600';

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedOutcomeIdx(i)}
                    className={`cursor-pointer rounded-xl transition-colors px-3 py-2 ${
                      selectedOutcomeIdx === i ? 'bg-[#1a2030]' : 'hover:bg-[#1a1c24]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-white font-semibold flex-1 truncate">{o.label}</span>
                      {delta !== 0 && (
                        <span className={`flex items-center gap-0.5 text-[10px] font-medium flex-shrink-0 ${deltaColor}`}>
                          <DeltaIcon className="w-2.5 h-2.5" />
                          {Math.abs(Math.round(delta))}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-500 flex-shrink-0 tabular-nums">
                        {o.multiplier.toFixed(2)}x
                      </span>
                      <span className="text-sm font-bold text-white flex-shrink-0 min-w-[44px] text-right">
                        {o.yesPct}%
                      </span>
                      {/* Yes / No price buttons */}
                      <a
                        href={tradeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[11px] px-3 py-1 rounded-lg bg-[#1a3a2e] text-[#16a34a] hover:bg-[#16a34a] hover:text-white transition-colors font-semibold border border-[#16a34a]/30 flex-shrink-0"
                      >
                        Yes {o.yesPrice}¢
                      </a>
                      <a
                        href={tradeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[11px] px-3 py-1 rounded-lg bg-red-950/50 text-red-400 hover:bg-red-600 hover:text-white transition-colors font-semibold border border-red-500/20 flex-shrink-0"
                      >
                        No {o.noPrice}¢
                      </a>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-px rounded-full bg-[#2a2d3e] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(1, o.yesPct)}%`,
                          backgroundColor: CHART_COLORS[i] ?? CHART_COLORS[0],
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {enrichedOutcomes.length > 6 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="text-xs text-teal-400 hover:text-teal-300 transition-colors px-3 py-1"
                >
                  {showAll ? '↑ Show less' : `↓ Show ${enrichedOutcomes.length - 6} more`}
                </button>
              )}
            </div>

            {/* ── Trade Yes | Trade No | Graph tabs ── */}
            <div className="flex items-center gap-0 border-b border-[#2a2d3e] mb-4">
              {([
                { id: 'tradeYes', label: 'Trade Yes' },
                { id: 'tradeNo',  label: 'Trade No' },
                { id: 'graph',    label: 'Graph' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                    activeView === tab.id
                      ? tab.id === 'tradeYes' ? 'border-green-500 text-green-400'
                        : tab.id === 'tradeNo' ? 'border-red-500 text-red-400'
                        : 'border-teal-500 text-teal-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── View content ── */}
            {activeView === 'graph' ? (
              <div className="bg-[#141620] rounded-xl p-3">
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
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                      <span className="text-gray-300">{o.label}</span>
                      <span className="font-bold" style={{ color: CHART_COLORS[i] }}>{o.yesPct}%</span>
                    </button>
                  ))}
                </div>

                {/* Date range */}
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
                  {market.isLive && (
                    <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                      LIVE
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <OrderbookView
                orderbook={orderbook}
                side={obSide}
                ticker={market.ticker}
              />
            )}
          </div>

          {/* ── Right: Trade Panel ── */}
          <div className="lg:w-72 xl:w-80 p-4 sm:p-5 lg:border-l border-t lg:border-t-0 border-[#2a2d3e] flex-shrink-0">
            <div className="lg:sticky lg:top-24 space-y-4">

              {/* Mini header */}
              <div className="p-3 bg-[#141620] rounded-xl border border-[#2a2d3e]">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5 font-bold">
                  {market.categoryChip}
                </p>
                <p className="text-xs text-white font-semibold leading-snug line-clamp-2">{market.title}</p>
                {market.closeTimeIso && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    Closes {new Date(market.closeTimeIso).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                )}
              </div>

              {/* Buy/Sell */}
              <div className="flex rounded-xl bg-[#141620] border border-[#2a2d3e] p-1">
                {(['Buy', 'Sell'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setTradeMode(mode)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                      tradeMode === mode
                        ? mode === 'Buy' ? 'bg-[#16a34a] text-white' : 'bg-red-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
                <span className="ml-auto flex items-center px-2 text-xs text-gray-500">Limit ▾</span>
              </div>

              {/* Outcome selector */}
              {enrichedOutcomes.length > 1 && (
                <select
                  value={selectedOutcomeIdx}
                  onChange={e => setSelectedOutcomeIdx(Number(e.target.value))}
                  className="w-full bg-[#141620] border border-[#2a2d3e] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {enrichedOutcomes.map((o, i) => (
                    <option key={i} value={i}>{o.label}</option>
                  ))}
                </select>
              )}

              {/* Yes / No price tiles — matching Kalshi.com */}
              {selectedOutcome && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#16a34a] rounded-xl p-3 text-center cursor-pointer hover:bg-[#15803d] transition-colors">
                    <p className="text-[10px] text-green-200 mb-1 font-semibold">Yes</p>
                    <p className="text-xl font-black text-white">{selectedOutcome.yesPrice}¢</p>
                  </div>
                  <div className="bg-[#2a2d3e] rounded-xl p-3 text-center cursor-pointer hover:bg-[#3a3d4e] transition-colors">
                    <p className="text-[10px] text-gray-400 mb-1 font-semibold">No</p>
                    <p className="text-xl font-black text-gray-200">{selectedOutcome.noPrice}¢</p>
                  </div>
                </div>
              )}

              {/* Contracts field */}
              <div className="p-3.5 bg-[#141620] rounded-xl border border-[#2a2d3e] flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Contracts</p>
                  <p className="text-[10px] text-teal-500 mt-0.5">Earn 3.25% Interest</p>
                </div>
                <p className="text-2xl font-black text-gray-500">0</p>
              </div>

              {/* Limit price */}
              <div className="p-3.5 bg-[#141620] rounded-xl border border-[#2a2d3e] flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Limit price (¢)</p>
                </div>
                <p className="text-xl font-black text-gray-300">
                  {selectedOutcome?.yesPrice ?? 50}
                </p>
              </div>

              {/* Expiration */}
              <div>
                <div className="flex rounded-xl overflow-hidden border border-[#2a2d3e]">
                  {['GTC', '12AM EDT', 'IOC'].map(exp => (
                    <button
                      key={exp}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        exp === 'GTC'
                          ? 'bg-white text-black'
                          : 'bg-[#141620] text-gray-400 hover:text-white'
                      }`}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buy CTA */}
              <a
                href={tradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-4 font-bold text-base text-white rounded-xl transition-all ${
                  tradeMode === 'Buy'
                    ? 'bg-[#16a34a] hover:bg-[#15803d] shadow-lg shadow-green-900/30'
                    : 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-900/30'
                }`}
              >
                {tradeMode}
              </a>

              <p className="text-[10px] text-gray-600 text-center">Opens Kalshi.com to place order</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
