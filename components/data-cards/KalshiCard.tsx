'use client';

import { memo } from 'react';
import {
  TrendingUp, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock, ChevronRight, Flame,
  BarChart3, ArrowUp, ArrowDown, ExternalLink,
  Zap, Bitcoin, BookOpen,
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

// ── Helpers ────────────────────────────────────────────────────────────────

/** Shorten very long market titles that list many teams/options separated by · */
function shortenTitle(title: string, maxLen = 72): string {
  if (title.length <= maxLen) return title;
  if (title.includes('·')) {
    const parts = title.split('·').map(p => p.trim());
    const header = parts[0];
    const colonIdx = header.indexOf(':');
    if (colonIdx > -1) {
      const prefix = header.slice(0, colonIdx + 1).trim();
      const firstOption = header.slice(colonIdx + 1).trim();
      const second = parts[1] ?? '';
      const remaining = parts.length - 2;
      if (remaining > 0) return `${prefix} ${firstOption} · ${second} +${remaining} more`;
      return `${prefix} ${firstOption} · ${second}`;
    }
    const first = parts[0];
    const second = parts[1] ?? '';
    const remaining = parts.length - 2;
    if (remaining > 0) return `${first} · ${second} +${remaining} more`;
    return `${first} · ${second}`;
  }
  return title.slice(0, maxLen - 1) + '\u2026';
}

/** Clean up ticker: hide random hex hashes, show only readable event tickers */
function cleanTicker(ticker: string): string | null {
  if (!ticker) return null;
  if (/[0-9A-F]{8,}/i.test(ticker) && ticker.length > 20) return null;
  if (ticker.length > 30) return null;
  return ticker;
}

/** Map expiryUrgency from API to text/pulse styles */
function urgencyFromLevel(level?: string) {
  switch (level) {
    case 'critical': return { text: 'text-red-400', pulse: true };
    case 'urgent':   return { text: 'text-red-400',   pulse: false };
    case 'soon':     return { text: 'text-amber-400', pulse: false };
    default:         return { text: 'text-[oklch(0.42_0.01_280)]', pulse: false };
  }
}

/** Volume tier badge colors */
function volTierStyles(tier?: string): string {
  switch (tier) {
    case 'Deep':     return 'text-[#00c47c] bg-[#00c47c10] border-[#00c47c28]';
    case 'Active':   return 'text-blue-400 bg-blue-500/10 border-blue-500/25';
    case 'Moderate': return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    default:         return 'text-[oklch(0.38_0.01_280)] bg-[oklch(0.12_0.01_280)] border-[oklch(0.19_0.015_280)]';
  }
}

/** Spread quality badge colors */
function spreadStyles(label?: string): string {
  switch (label) {
    case 'Tight':  return 'text-[#00c47c] bg-[#00c47c10] border-[#00c47c28]';
    case 'Normal': return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    case 'Wide':   return 'text-red-400 bg-red-500/10 border-red-500/25';
    default:       return 'text-[oklch(0.38_0.01_280)] bg-[oklch(0.12_0.01_280)] border-[oklch(0.19_0.015_280)]';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryIcon({ label, className }: { label?: string; className?: string }) {
  const cls = cn('w-3.5 h-3.5', className);
  switch (label) {
    case 'election':      return <Vote className={cls} />;
    case 'politics':      return <Vote className={cls} />;
    case 'sports':        return <Trophy className={cls} />;
    case 'weather':       return <CloudRain className={cls} />;
    case 'finance':       return <TrendingUp className={cls} />;
    case 'crypto':        return <Bitcoin className={cls} />;
    case 'tech':          return <Cpu className={cls} />;
    case 'entertainment': return <Film className={cls} />;
    default:              return <Globe className={cls} />;
  }
}

/** Redesigned probability bar with gradient, implied probability and last price */
function ProbabilityBar({
  yesPct,
  lastPrice,
  impliedProbability,
  isHero,
}: {
  yesPct: number;
  lastPrice?: number;
  impliedProbability?: string;
  isHero?: boolean;
}) {
  const YES_COLOR = '#00c47c';
  const NO_COLOR  = '#f43f5e';
  const noPct     = 100 - yesPct;
  const yesLeads  = yesPct >= 50;

  return (
    <div className="w-full">
      {/* YES / NO numbers */}
      <div className="flex items-end justify-between mb-3">
        {/* YES side */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: YES_COLOR }}>Yes</span>
          <div className="flex items-baseline gap-0.5">
            <span
              className={cn('tabular-nums font-black leading-none', isHero ? 'text-4xl' : 'text-3xl')}
              style={{ color: yesLeads ? YES_COLOR : 'oklch(0.48 0.01 280)' }}
            >
              {yesPct}
            </span>
            <span className="text-sm font-bold" style={{ color: yesLeads ? YES_COLOR : 'oklch(0.35 0.01 280)' }}>¢</span>
          </div>
        </div>

        {/* Center: implied probability + last price */}
        <div className="flex flex-col items-center gap-0.5">
          {impliedProbability && (
            <span className="text-[9px] font-semibold text-[oklch(0.42_0.01_280)]">
              {impliedProbability} implied
            </span>
          )}
          {lastPrice != null && lastPrice > 0 && (
            <span className="text-[9px] text-[oklch(0.30_0.01_280)] font-medium tabular-nums">
              Last {lastPrice}¢
            </span>
          )}
        </div>

        {/* NO side */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: NO_COLOR }}>No</span>
          <div className="flex items-baseline gap-0.5">
            <span
              className={cn('tabular-nums font-black leading-none', isHero ? 'text-4xl' : 'text-3xl')}
              style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.48 0.01 280)' }}
            >
              {noPct}
            </span>
            <span className="text-sm font-bold" style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.35 0.01 280)' }}>¢</span>
          </div>
        </div>
      </div>

      {/* Gradient bar */}
      <div className="relative h-2.5 rounded-full overflow-hidden bg-[oklch(0.12_0.01_280)]">
        {/* YES fill */}
        <div
          className="absolute left-0 top-0 h-full rounded-l-full transition-all duration-700"
          style={{ width: `${yesPct}%`, backgroundColor: YES_COLOR, opacity: 0.85 }}
        />
        {/* NO fill */}
        <div
          className="absolute right-0 top-0 h-full rounded-r-full transition-all duration-700"
          style={{ width: `${noPct}%`, backgroundColor: NO_COLOR, opacity: 0.6 }}
        />
        {/* center marker */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-[oklch(0.08_0.01_280)]" />
      </div>

      {/* Scale */}
      <div className="flex justify-between mt-1 text-[8px] font-semibold">
        <span style={{ color: YES_COLOR + 'aa' }}>0¢</span>
        <span className="text-[oklch(0.28_0.01_280)]">50¢</span>
        <span style={{ color: NO_COLOR + 'aa' }}>100¢</span>
      </div>
    </div>
  );
}

/** 2-column YES/NO bid-ask grid with spread quality badge */
function BestPrices({
  yesBid,
  yesAsk,
  noBid,
  noAsk,
  spreadLabel,
}: {
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  spreadLabel?: string;
}) {
  const YES_COLOR = '#00c47c';
  const NO_COLOR  = '#f43f5e';

  const hasYes = (yesBid !== null && yesBid > 0) || (yesAsk !== null && yesAsk > 0);
  const hasNo  = (noBid  !== null && noBid  > 0) || (noAsk  !== null && noAsk  > 0);

  if (!hasYes && !hasNo) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.32_0.02_260)]">
          Best Prices
        </span>
        {spreadLabel && (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold',
            spreadStyles(spreadLabel),
          )}>
            {spreadLabel} spread
          </span>
        )}
      </div>

      {/* Prices grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* YES column */}
        {hasYes && (
          <div className="space-y-1">
            <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: YES_COLOR + '99' }}>Yes</div>
            <div className="flex gap-1.5 flex-wrap">
              {yesBid !== null && yesBid > 0 && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-black tabular-nums border"
                  style={{ color: YES_COLOR, backgroundColor: YES_COLOR + '12', borderColor: YES_COLOR + '28' }}
                >
                  {yesBid}¢ <span className="font-normal opacity-60">bid</span>
                </span>
              )}
              {yesAsk !== null && yesAsk > 0 && (
                <span className="px-2 py-0.5 rounded bg-[oklch(0.13_0.01_280)] border border-[oklch(0.19_0.01_280)] text-[oklch(0.55_0.01_280)] text-[10px] font-black tabular-nums">
                  {yesAsk}¢ <span className="font-normal opacity-60">ask</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* NO column */}
        {hasNo && (
          <div className="space-y-1">
            <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: NO_COLOR + '99' }}>No</div>
            <div className="flex gap-1.5 flex-wrap">
              {noBid !== null && noBid > 0 && (
                <span className="px-2 py-0.5 rounded bg-[oklch(0.13_0.01_280)] border border-[oklch(0.19_0.01_280)] text-[oklch(0.55_0.01_280)] text-[10px] font-black tabular-nums">
                  {noBid}¢ <span className="font-normal opacity-60">bid</span>
                </span>
              )}
              {noAsk !== null && noAsk > 0 && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-black tabular-nums border"
                  style={{ color: NO_COLOR, backgroundColor: NO_COLOR + '10', borderColor: NO_COLOR + '28' }}
                >
                  {noAsk}¢ <span className="font-normal opacity-60">ask</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Mini orderbook depth chart — shown when Level 2 data is available */
function MiniOrderbook({
  bids,
  asks,
}: {
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
}) {
  if (!bids?.length && !asks?.length) return null;

  const maxQty = Math.max(
    ...bids.map(b => b.quantity),
    ...asks.map(a => a.quantity),
    1,
  );

  // Take top 4 levels each side
  const topBids = bids.slice(0, 4);
  const topAsks = asks.slice(0, 4);
  const levels  = Math.max(topBids.length, topAsks.length);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3 h-3 text-[oklch(0.35_0.02_260)]" />
        <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.32_0.02_260)]">Order Depth</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-x-1 mb-1 text-[8px] font-bold uppercase tracking-widest">
        <div className="text-right text-[#00c47c99]">Qty</div>
        <div className="text-right text-[#00c47c99]">Bid</div>
        <div className="text-left text-[#f43f5e99] pl-2">Ask</div>
        <div className="text-left text-[#f43f5e99]">Qty</div>
      </div>

      {/* Rows */}
      <div className="space-y-0.5">
        {Array.from({ length: levels }, (_, i) => {
          const bid = topBids[i];
          const ask = topAsks[i];
          const bidPct = bid ? (bid.quantity / maxQty) * 100 : 0;
          const askPct = ask ? (ask.quantity / maxQty) * 100 : 0;

          return (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_1fr] gap-x-1 items-center h-5">
              {/* Bid bar + price */}
              {bid ? (
                <>
                  <div className="relative h-full flex items-center justify-end pr-1 overflow-hidden">
                    <div
                      className="absolute right-0 top-0 h-full rounded-l-sm opacity-25"
                      style={{ width: `${bidPct}%`, backgroundColor: '#00c47c' }}
                    />
                    <span className="relative text-[9px] font-semibold text-[oklch(0.55_0.01_280)] tabular-nums z-10">
                      {bid.quantity.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[10px] font-black tabular-nums text-[#00c47c] text-right">{bid.price}¢</span>
                </>
              ) : (
                <>
                  <div />
                  <div />
                </>
              )}

              {/* Ask price + bar */}
              {ask ? (
                <>
                  <span className="text-[10px] font-black tabular-nums text-[#f43f5e] text-left pl-2">{ask.price}¢</span>
                  <div className="relative h-full flex items-center justify-start pl-1 overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-r-sm opacity-25"
                      style={{ width: `${askPct}%`, backgroundColor: '#f43f5e' }}
                    />
                    <span className="relative text-[9px] font-semibold text-[oklch(0.55_0.01_280)] tabular-nums z-10">
                      {ask.quantity.toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div />
                  <div />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Edge score pill + recommendation signal */
function EdgeBadge({
  edgeScore,
  yesPct,
  recommendation,
}: {
  edgeScore: number;
  yesPct: number;
  recommendation?: string;
}) {
  const edgeColor =
    edgeScore >= 60 ? '#00c47c' :
    edgeScore >= 30 ? '#f59e0b' :
    'oklch(0.40 0.01 280)';

  const signalStyle =
    yesPct >= 60 ? 'bg-[#00c47c10] border-[#00c47c28] text-[#00c47c]' :
    yesPct <= 40 ? 'bg-[#f43f5e10] border-[#f43f5e28] text-[#f43f5e]' :
    'bg-[oklch(0.11_0.01_280)] border-[oklch(0.17_0.01_280)] text-[oklch(0.45_0.01_280)]';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold"
        style={{ color: edgeColor, backgroundColor: `${edgeColor}12`, borderColor: `${edgeColor}28` }}
      >
        <Zap className="w-3 h-3" />
        Edge {edgeScore}
        <span className="text-[8px] opacity-60 font-normal">/100</span>
      </div>

      {recommendation && (
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold',
          signalStyle,
        )}>
          <TrendingUp className="w-2.5 h-2.5" />
          {recommendation.length > 28 ? recommendation.slice(0, 28) + '\u2026' : recommendation}
        </span>
      )}
    </div>
  );
}

/** Stats strip: volume tier, volume, OI, expiry */
function StatsStrip({
  volumeTier,
  volume24h,
  volume,
  openInterest,
  expiresLabel,
  expiryUrgency,
}: {
  volumeTier?: string;
  volume24h?: string;
  volume?: string;
  openInterest?: string;
  expiresLabel?: string;
  expiryUrgency?: string;
}) {
  const urgency = urgencyFromLevel(expiryUrgency);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {volumeTier && (
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold',
          volTierStyles(volumeTier),
        )}>
          {volumeTier === 'Deep' && <Flame className="w-2.5 h-2.5" />}
          {volumeTier}
        </span>
      )}

      {volume24h && volume24h !== '' ? (
        <span className="text-[10px] text-[oklch(0.42_0.01_280)]">
          24h <span className="text-white/80 font-bold">{volume24h}</span>
        </span>
      ) : volume && volume !== '—' ? (
        <span className="text-[10px] text-[oklch(0.42_0.01_280)]">
          Vol <span className="text-white/80 font-bold">{volume}</span>
        </span>
      ) : null}

      {openInterest && openInterest !== '—' && (
        <span className="text-[10px] text-[oklch(0.42_0.01_280)]">
          OI <span className="text-[oklch(0.65_0.01_280)] font-bold">{openInterest}</span>
        </span>
      )}

      {expiresLabel && expiresLabel !== 'Closed' && (
        <span className={cn('ml-auto flex items-center gap-1 text-[10px] font-semibold', urgency.text)}>
          <Clock className={cn('w-3 h-3', urgency.pulse && 'animate-pulse')} />
          {expiresLabel}
        </span>
      )}
    </div>
  );
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

  const isActive   = status === 'active' || status === 'open' || status === 'live';
  const edgeScore  = typeof d.edgeScore === 'number' ? d.edgeScore : Math.round(Math.abs(yesPct - 50) * 2);
  const marketCat  = d.subcategory || subcategory || category || 'Prediction';

  const yesBid: number | null = typeof d.yesBid === 'number' ? d.yesBid : null;
  const yesAsk: number | null = typeof d.yesAsk === 'number' ? d.yesAsk : null;
  const noBid:  number | null = typeof d.noBid  === 'number' ? d.noBid  : null;
  const noAsk:  number | null = typeof d.noAsk  === 'number' ? d.noAsk  : null;

  const hasPrices = (yesBid !== null && yesBid > 0) || (yesAsk !== null && yesAsk > 0)
                 || (noBid  !== null && noBid  > 0) || (noAsk  !== null && noAsk  > 0);

  const rawChange  = d.priceChange ?? 0;
  const safeChange = Math.abs(rawChange) <= 99 ? rawChange : 0;
  const priceDir: 'up' | 'down' | 'flat' =
    d.priceDirection || (safeChange > 0 ? 'up' : safeChange < 0 ? 'down' : 'flat');

  const displayTitle  = shortenTitle(title);
  const displayTicker = d.ticker ? cleanTicker(d.ticker) : null;

  // Orderbook Level 2 data
  const obBids: Array<{ price: number; quantity: number }> | null = Array.isArray(d.orderbookBids) ? d.orderbookBids : null;
  const obAsks: Array<{ price: number; quantity: number }> | null = Array.isArray(d.orderbookAsks) ? d.orderbookAsks : null;
  const hasOrderbook = (obBids && obBids.length > 0) || (obAsks && obAsks.length > 0);

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden transition-all duration-300',
        'bg-[#090c14] border',
        isHero
          ? 'border-[#252f4a] shadow-[0_0_40px_#161c2e44]'
          : 'border-[#161c2e] hover:border-[#1e2a44]',
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-[#0d1118]">
        {/* Top row: breadcrumb + badges */}
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-[oklch(0.13_0.025_260)] border border-[oklch(0.19_0.025_260)] shrink-0">
              <CategoryIcon label={d.iconLabel} className="text-[oklch(0.50_0.02_260)]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.35_0.025_260)] shrink-0">
              KALSHI
            </span>
            <span className="text-[oklch(0.20_0.01_280)] text-[9px]">/</span>
            <span className="text-[9px] font-semibold text-[oklch(0.45_0.015_270)] truncate">
              {marketCat}
            </span>
            {d.isHot && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-500/12 border border-rose-500/22 text-[8px] font-black text-rose-400 uppercase tracking-wider shrink-0">
                <Flame className="w-2.5 h-2.5" /> Hot
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Price delta */}
            {priceDir !== 'flat' && safeChange > 0 && (
              <span className={cn(
                'flex items-center gap-0.5 text-[10px] font-bold',
                priceDir === 'up' ? 'text-[#00c47c]' : 'text-[#f43f5e]',
              )}>
                {priceDir === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {safeChange}¢
              </span>
            )}
            {/* Status badge */}
            {isActive ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00c47c0e] border border-[#00c47c22]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00c47c] animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-widest text-[#00c47c]/80">Live</span>
              </div>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.28_0.01_280)] px-1.5 py-0.5 rounded-full bg-[oklch(0.12_0.01_280)] border border-[oklch(0.17_0.01_280)]">
                Closed
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          className={cn('font-black text-white leading-snug', isHero ? 'text-base' : 'text-sm')}
          title={title}
        >
          {displayTitle}
        </h3>

        {d.subtitle && d.subtitle !== title && (
          <p className="text-[11px] text-[oklch(0.42_0.01_280)] mt-1 line-clamp-1 leading-relaxed">
            {d.subtitle}
          </p>
        )}

        {displayTicker && (
          <span className="mt-1.5 inline-block font-mono text-[9px] text-[oklch(0.28_0.02_260)] tracking-wider bg-[oklch(0.11_0.01_280)] px-1.5 py-0.5 rounded">
            {displayTicker}
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-4">

        {/* Probability bar */}
        <ProbabilityBar
          yesPct={yesPct}
          lastPrice={typeof d.lastPrice === 'number' ? d.lastPrice : undefined}
          impliedProbability={d.impliedProbability}
          isHero={isHero}
        />

        <div className="h-px bg-[#0d1118]" />

        {/* Edge score + signal */}
        <EdgeBadge edgeScore={edgeScore} yesPct={yesPct} recommendation={d.recommendation} />

        {/* Bid/ask prices (YES + NO sides) */}
        {hasPrices && (
          <>
            <div className="h-px bg-[#0d1118]" />
            <BestPrices
              yesBid={yesBid}
              yesAsk={yesAsk}
              noBid={noBid}
              noAsk={noAsk}
              spreadLabel={d.spreadLabel}
            />
          </>
        )}

        {/* Mini orderbook depth chart */}
        {hasOrderbook && (
          <>
            <div className="h-px bg-[#0d1118]" />
            <MiniOrderbook bids={obBids ?? []} asks={obAsks ?? []} />
          </>
        )}

        <div className="h-px bg-[#0d1118]" />

        {/* Stats strip */}
        <StatsStrip
          volumeTier={d.volumeTier}
          volume24h={d.volume24h}
          volume={d.volume}
          openInterest={d.openInterest}
          expiresLabel={d.expiresLabel}
          expiryUrgency={d.expiryUrgency}
        />

        {/* Close date */}
        {d.closeTime && d.closeTime !== 'TBD' && (
          <div className="flex items-center justify-end text-[9px] text-[oklch(0.26_0.01_280)] pt-1 border-t border-[#0d1118]">
            <span>Closes {d.closeTime}</span>
          </div>
        )}

        {/* Analyze CTA */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[oklch(0.11_0.018_260)] border border-[oklch(0.18_0.022_260)] text-xs font-semibold text-[oklch(0.52_0.015_260)] hover:text-white hover:bg-[oklch(0.16_0.022_260)] hover:border-[oklch(0.26_0.028_260)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c47c]/40"
            aria-label={`Analyze ${title}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Trade on Kalshi link */}
        {(d.ticker || d.eventTicker) && (
          <a
            href={`https://kalshi.com/markets/${d.eventTicker || d.ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] font-semibold text-[oklch(0.35_0.01_280)] hover:text-[oklch(0.55_0.01_280)] transition-colors duration-150"
          >
            <ExternalLink className="w-3 h-3" />
            Trade on Kalshi
          </a>
        )}
      </div>
    </article>
  );
});
