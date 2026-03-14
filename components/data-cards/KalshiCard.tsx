'use client';

import { memo } from 'react';
import {
  TrendingUp, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock, ChevronRight, Flame,
  BarChart3, ArrowUp, ArrowDown, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KalshiCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
  isHero?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryIcon({ label, className }: { label?: string; className?: string }) {
  const cls = cn('w-3.5 h-3.5', className);
  switch (label) {
    case 'election':      return <Vote className={cls} />;
    case 'sports':        return <Trophy className={cls} />;
    case 'weather':       return <CloudRain className={cls} />;
    case 'finance':       return <TrendingUp className={cls} />;
    case 'tech':          return <Cpu className={cls} />;
    case 'entertainment': return <Film className={cls} />;
    default:              return <Globe className={cls} />;
  }
}

function ProbabilityBar({ yesPct, isHero }: { yesPct: number; isHero?: boolean }) {
  const YES_COLOR = '#00c47c';
  const NO_COLOR  = '#f43f5e';
  const noDisplay = 100 - yesPct;
  const yesLeads  = yesPct >= 50;

  return (
    <div className="w-full">
      <div className="flex items-end justify-between mb-3">
        {/* YES side */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: YES_COLOR }}>Yes</span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn('tabular-nums font-black leading-none', isHero ? 'text-5xl' : 'text-4xl')}
              style={{ color: yesLeads ? YES_COLOR : 'oklch(0.55 0.01 280)' }}
            >
              {yesPct}
            </span>
            <span
              className={cn('font-bold', isHero ? 'text-xl' : 'text-base')}
              style={{ color: yesLeads ? YES_COLOR : 'oklch(0.40 0.01 280)' }}
            >
              ¢
            </span>
          </div>
        </div>

        {/* Center label */}
        <div className="flex flex-col items-center gap-1 pb-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.35_0.01_280)]">
            Market Probability
          </span>
          <div className="w-px h-4 bg-[oklch(0.22_0.01_280)]" />
        </div>

        {/* NO side */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: NO_COLOR }}>No</span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn('tabular-nums font-black leading-none', isHero ? 'text-5xl' : 'text-4xl')}
              style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.55 0.01 280)' }}
            >
              {noDisplay}
            </span>
            <span
              className={cn('font-bold', isHero ? 'text-xl' : 'text-base')}
              style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.40 0.01 280)' }}
            >
              ¢
            </span>
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2.5 rounded-full overflow-hidden bg-[oklch(0.14_0.01_280)]">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${yesPct}%`, backgroundColor: YES_COLOR, opacity: 0.85 }}
        />
        <div
          className="absolute right-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${noDisplay}%`, backgroundColor: NO_COLOR, opacity: 0.6 }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-px bg-[oklch(0.08_0.01_280)]" />
      </div>
      <div className="flex justify-between mt-1 text-[9px] font-semibold text-[oklch(0.30_0.01_280)]">
        <span>0¢</span>
        <span>50¢</span>
        <span>100¢</span>
      </div>
    </div>
  );
}

/** Compact row: edge score dot + number, signal text tag */
function CompactMetricsRow({
  edgeScore,
  recommendation,
  yesPct,
}: {
  edgeScore: number;
  recommendation?: string;
  yesPct: number;
}) {
  const edgeColor =
    edgeScore >= 60 ? '#00c47c' :
    edgeScore >= 30 ? '#f59e0b' :
    'oklch(0.50 0.01 280)';

  const signalBg =
    yesPct >= 60 ? 'bg-[#00c47c12] border-[#00c47c28] text-[#00c47c]' :
    yesPct <= 40 ? 'bg-[#f43f5e12] border-[#f43f5e28] text-[#f43f5e]' :
    'bg-[oklch(0.12_0.01_280)] border-[oklch(0.18_0.01_280)] text-[oklch(0.50_0.01_280)]';

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Edge score */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: edgeColor }} />
        <span className="text-[10px] text-[oklch(0.42_0.02_260)] font-medium">Edge</span>
        <span className="text-[11px] font-black tabular-nums" style={{ color: edgeColor }}>
          {edgeScore}
        </span>
        <span className="text-[9px] text-[oklch(0.30_0.01_280)]">/100</span>
      </div>

      {/* Recommendation tag */}
      {recommendation && (
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold truncate max-w-[160px]',
          signalBg,
        )}>
          <TrendingUp className="w-2.5 h-2.5 shrink-0" />
          {recommendation}
        </span>
      )}
    </div>
  );
}

/** Level-2 order book ladder — falls back to single-level when bids/asks are null */
function OrderBookDepth({
  bids,
  asks,
  yesBid,
  yesAsk,
}: {
  bids: Array<{ price: number; quantity: number }> | null;
  asks: Array<{ price: number; quantity: number }> | null;
  yesBid: number | null;
  yesAsk: number | null;
}) {
  const YES_COLOR = '#00c47c';
  const NO_COLOR  = '#f43f5e';

  const hasDepth = bids && bids.length > 0 && asks && asks.length > 0;

  // Compute spread
  const spread: number | null = (() => {
    if (hasDepth) {
      const bestBid = bids[0].price;
      const bestAsk = asks[0].price;
      return Math.round((bestAsk - bestBid) * 100) / 100;
    }
    if (yesAsk !== null && yesBid !== null) return yesAsk - yesBid;
    return null;
  })();

  const spreadColor =
    spread !== null && spread <= 2 ? YES_COLOR :
    spread !== null && spread <= 5 ? '#f59e0b' : NO_COLOR;

  if (hasDepth) {
    // Full ladder view
    const allQty = [...bids.map(b => b.quantity), ...asks.map(a => a.quantity)];
    const maxQty = Math.max(...allQty, 1);

    return (
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.40_0.02_260)]">
            Market Depth
          </span>
          {spread !== null && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: spreadColor, backgroundColor: `${spreadColor}18` }}
            >
              Spread: {spread}¢
            </span>
          )}
        </div>

        {/* Column labels */}
        <div className="grid grid-cols-[1fr_auto_1px_auto_1fr] gap-x-1 mb-1">
          <span className="text-right text-[8px] font-bold uppercase tracking-widest text-[oklch(0.35_0.01_280)]">qty</span>
          <span className="text-right text-[8px] font-bold uppercase tracking-widest pr-2" style={{ color: YES_COLOR }}>BID</span>
          <span />
          <span className="text-left text-[8px] font-bold uppercase tracking-widest pl-2" style={{ color: NO_COLOR }}>ASK</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-[oklch(0.35_0.01_280)]">qty</span>
        </div>

        {/* Ladder rows — zip bids and asks */}
        {Array.from({ length: Math.max(bids.length, asks.length) }).map((_, i) => {
          const bid = bids[i];
          const ask = asks[i];
          const bidBarPct = bid ? Math.round((bid.quantity / maxQty) * 100) : 0;
          const askBarPct = ask ? Math.round((ask.quantity / maxQty) * 100) : 0;

          return (
            <div key={i} className="grid grid-cols-[1fr_auto_1px_auto_1fr] gap-x-1 mb-0.5 items-center">
              {/* BID bar (right-aligned, grows left) */}
              <div className="flex justify-end items-center h-3.5">
                {bid && (
                  <div
                    className="h-2 rounded-sm"
                    style={{ width: `${bidBarPct}%`, backgroundColor: YES_COLOR, opacity: 0.7 }}
                  />
                )}
              </div>
              {/* BID price */}
              <span className="text-right text-[10px] font-black tabular-nums pr-2" style={{ color: YES_COLOR }}>
                {bid ? `${bid.price}¢` : '—'}
              </span>
              {/* Center divider */}
              <div className="self-stretch bg-[oklch(0.18_0.01_280)] w-px mx-px" />
              {/* ASK price */}
              <span className="text-left text-[10px] font-black tabular-nums pl-2" style={{ color: NO_COLOR }}>
                {ask ? `${ask.price}¢` : '—'}
              </span>
              {/* ASK bar (left-aligned, grows right) */}
              <div className="flex justify-start items-center h-3.5">
                {ask && (
                  <div
                    className="h-2 rounded-sm"
                    style={{ width: `${askBarPct}%`, backgroundColor: NO_COLOR, opacity: 0.7 }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: single-level summary
  const hasSingle = (yesBid !== null && yesBid > 0) || (yesAsk !== null && yesAsk > 0);
  if (!hasSingle) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.40_0.02_260)]">
          Best Prices
        </span>
        {spread !== null && spread > 0 && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ color: spreadColor, backgroundColor: `${spreadColor}18` }}
          >
            Spread: {spread}¢
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1px_1fr] gap-x-3 items-center">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[oklch(0.10_0.012_160)] border border-[oklch(0.18_0.020_160)]">
          <span className="text-[9px] font-bold text-[#00c47c]/70">Bid</span>
          <span className="text-xs font-black tabular-nums text-[#00c47c]">
            {yesBid !== null && yesBid > 0 ? `${yesBid}¢` : '—'}
          </span>
        </div>
        <div className="self-stretch bg-[oklch(0.18_0.01_280)] w-px" />
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[oklch(0.10_0.012_15)] border border-[oklch(0.18_0.020_15)]">
          <span className="text-[9px] font-bold text-[#f43f5e]/70">Ask</span>
          <span className="text-xs font-black tabular-nums text-[#f43f5e]">
            {yesAsk !== null && yesAsk > 0 ? `${yesAsk}¢` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function urgencyStyles(label?: string) {
  if (!label || label === 'Closed') return { text: 'text-[oklch(0.35_0.01_280)]', pulse: false };
  if (label === '<24h') return { text: 'text-red-400', pulse: true };
  const d = parseInt(label);
  if (!isNaN(d) && d <= 3) return { text: 'text-red-400', pulse: false };
  if (!isNaN(d) && d <= 7) return { text: 'text-amber-400', pulse: false };
  return { text: 'text-[oklch(0.45_0.01_280)]', pulse: false };
}

function volTierStyles(tier?: string): string {
  switch (tier) {
    case 'Deep':     return 'text-[#00c47c] bg-[#00c47c18] border-[#00c47c30]';
    case 'Active':   return 'text-blue-400 bg-blue-500/10 border-blue-500/25';
    case 'Moderate': return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    default:         return 'text-[oklch(0.40_0.01_280)] bg-[oklch(0.13_0.01_280)] border-[oklch(0.20_0.015_280)]';
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export const KalshiCard = memo(function KalshiCard({
  title,
  category,
  subcategory,
  data: d,
  status,
  onAnalyze,
  isHero,
}: KalshiCardProps) {
  const yesPct: number = (() => {
    if (typeof d.yesPct === 'number') return d.yesPct;
    if (typeof d.yesPrice === 'string') {
      const parsed = parseFloat(d.yesPrice);
      return Number.isFinite(parsed) ? parsed : 50;
    }
    return 50;
  })();

  const isActive    = status === 'active' || status === 'open' || status === 'live';
  const edgeScore   = typeof d.edgeScore === 'number' ? d.edgeScore : Math.round(Math.abs(yesPct - 50) * 2);
  const urgency     = urgencyStyles(d.expiresLabel);
  const volStyle    = volTierStyles(d.volumeTier);
  const marketCat   = d.subcategory || subcategory || category || 'Prediction Market';

  const yesBid: number | null = typeof d.yesBid === 'number' ? d.yesBid : null;
  const yesAsk: number | null = typeof d.yesAsk === 'number' ? d.yesAsk : null;

  const rawChange = d.priceChange ?? 0;
  const safeChange = Math.abs(rawChange) <= 99 ? rawChange : 0;
  const priceDir: 'up' | 'down' | 'flat' =
    d.priceDirection || (safeChange > 0 ? 'up' : safeChange < 0 ? 'down' : 'flat');

  const orderbookBids: Array<{ price: number; quantity: number }> | null = Array.isArray(d.orderbookBids) ? d.orderbookBids : null;
  const orderbookAsks: Array<{ price: number; quantity: number }> | null = Array.isArray(d.orderbookAsks) ? d.orderbookAsks : null;

  const hasOrderbookOrPrices =
    (orderbookBids && orderbookBids.length > 0) ||
    (orderbookAsks && orderbookAsks.length > 0) ||
    (yesBid !== null && yesBid > 0) ||
    (yesAsk !== null && yesAsk > 0);

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden transition-all duration-300',
        'bg-[#090c14] border',
        isHero
          ? 'border-[#252f4a] shadow-[0_0_40px_#161c2e44]'
          : 'border-[#161c2e] hover:border-[#252f4a]',
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-[#101520]">
        {/* Top row: breadcrumb | delta + live */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-[oklch(0.14_0.02_260)] border border-[oklch(0.20_0.02_260)]">
              <CategoryIcon label={d.iconLabel} className="text-[oklch(0.52_0.015_260)]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.38_0.02_260)]">KALSHI</span>
            <span className="text-[oklch(0.22_0.01_280)] text-[9px]">/</span>
            <span className="text-[9px] font-semibold text-[oklch(0.45_0.01_280)] truncate max-w-[120px]">
              {marketCat}
            </span>
            {d.isHot && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 text-[8px] font-black text-rose-400 uppercase tracking-wider">
                <Flame className="w-2.5 h-2.5" /> Hot
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {priceDir !== 'flat' && (
              <span className={cn('flex items-center gap-0.5 text-[10px] font-bold',
                priceDir === 'up' ? 'text-[#00c47c]' : 'text-[#f43f5e]',
              )}>
                {priceDir === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(safeChange)}¢
              </span>
            )}
            {isActive ? (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00c47c] animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-[#00c47c]/80">Live</span>
              </div>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.30_0.01_280)]">Closed</span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          className={cn('font-black text-white leading-snug line-clamp-2', isHero ? 'text-base' : 'text-sm')}
          title={title}
        >
          {title}
        </h3>

        {d.subtitle && d.subtitle !== title && (
          <p className="text-[11px] text-[oklch(0.45_0.01_280)] mt-1 line-clamp-1 leading-relaxed">
            {d.subtitle}
          </p>
        )}

        {/* Ticker */}
        {d.ticker && (
          <span className="mt-1.5 inline-block font-mono text-[9px] text-[oklch(0.30_0.02_260)] tracking-wider">
            {d.ticker}
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-4">

        {/* Probability bar */}
        <ProbabilityBar yesPct={yesPct} isHero={isHero} />

        {/* Divider */}
        <div className="h-px bg-[#101520]" />

        {/* Compact metrics: edge + recommendation */}
        <CompactMetricsRow
          edgeScore={edgeScore}
          recommendation={d.recommendation}
          yesPct={yesPct}
        />

        {/* Divider */}
        <div className="h-px bg-[#101520]" />

        {/* Order book depth (or best-price fallback) */}
        {hasOrderbookOrPrices && (
          <>
            <OrderBookDepth
              bids={orderbookBids}
              asks={orderbookAsks}
              yesBid={yesBid}
              yesAsk={yesAsk}
            />
            <div className="h-px bg-[#101520]" />
          </>
        )}

        {/* Stats strip */}
        <div className="flex flex-wrap items-center gap-2">
          {d.volumeTier && (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold', volStyle)}>
              {d.volumeTier === 'Deep' && <Flame className="w-2.5 h-2.5" />}
              {d.volumeTier}
            </span>
          )}

          {d.volume24h && d.volume24h !== '' ? (
            <span className="text-[10px] text-[oklch(0.45_0.01_280)] font-medium">
              Vol <span className="text-white font-bold">{d.volume24h}</span>
            </span>
          ) : d.volume && d.volume !== '—' ? (
            <span className="text-[10px] text-[oklch(0.45_0.01_280)] font-medium">
              Vol <span className="text-white font-bold">{d.volume}</span>
            </span>
          ) : null}

          {d.openInterest && d.openInterest !== '—' && (
            <span className="text-[10px] text-[oklch(0.45_0.01_280)] font-medium">
              OI <span className="text-[oklch(0.70_0.01_280)] font-bold">{d.openInterest}</span>
            </span>
          )}

          {d.expiresLabel && d.expiresLabel !== 'Closed' && (
            <span className={cn('ml-auto flex items-center gap-1 text-[10px] font-semibold', urgency.text)}>
              <Clock className={cn('w-3 h-3', urgency.pulse && 'animate-pulse')} />
              {d.expiresLabel}
            </span>
          )}
        </div>

        {/* Footer: close date */}
        {d.closeTime && d.closeTime !== 'TBD' && (
          <div className="flex items-center justify-end text-[9px] text-[oklch(0.28_0.01_280)] pt-1 border-t border-[#101520]">
            <span>Closes {d.closeTime}</span>
          </div>
        )}

        {/* Analyze CTA */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[oklch(0.12_0.015_260)] border border-[oklch(0.19_0.018_260)] text-xs font-semibold text-[oklch(0.55_0.01_280)] hover:text-white hover:bg-[oklch(0.17_0.018_260)] hover:border-[oklch(0.27_0.022_260)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c47c]/50"
            aria-label={`Analyze ${title}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Kalshi link */}
        {d.ticker && (
          <a
            href={`https://kalshi.com/markets/${d.eventTicker || d.ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] font-semibold text-[oklch(0.38_0.01_280)] hover:text-[oklch(0.60_0.01_280)] transition-colors duration-150"
          >
            <ExternalLink className="w-3 h-3" />
            Trade on Kalshi
          </a>
        )}
      </div>
    </article>
  );
});
