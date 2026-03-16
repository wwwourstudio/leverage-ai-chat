'use client';

import { memo } from 'react';
import {
  TrendingUp, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock,
  Bitcoin, ArrowUp, ArrowDown, ExternalLink,
  Flame, BarChart3, ChevronRight,
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

// ── Kalshi brand colors ────────────────────────────────────────────────────────
const YES_COLOR = '#00d15d';
const NO_COLOR  = '#f63d58';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Shorten very long market titles */
function shortenTitle(title: string, maxLen = 80): string {
  if (title.length <= maxLen) return title;
  if (title.includes('·')) {
    const parts = title.split('·').map(p => p.trim());
    const first = parts[0];
    const second = parts[1] ?? '';
    const remaining = parts.length - 2;
    if (remaining > 0) return `${first} · ${second} +${remaining} more`;
    return `${first} · ${second}`;
  }
  return title.slice(0, maxLen - 1) + '\u2026';
}

/** Map category to icon */
function CategoryIcon({ label, className }: { label?: string; className?: string }) {
  const cls = cn('w-3.5 h-3.5', className);
  switch ((label || '').toLowerCase()) {
    case 'election':
    case 'politics': return <Vote className={cls} />;
    case 'sports':   return <Trophy className={cls} />;
    case 'weather':  return <CloudRain className={cls} />;
    case 'finance':  return <TrendingUp className={cls} />;
    case 'crypto':   return <Bitcoin className={cls} />;
    case 'tech':     return <Cpu className={cls} />;
    case 'entertainment': return <Film className={cls} />;
    default:         return <Globe className={cls} />;
  }
}

// ── Probability Hero ───────────────────────────────────────────────────────────
function ProbabilityHero({
  yesPct,
  lastPrice,
  priceDir,
  priceChange,
  isHero,
}: {
  yesPct: number;
  lastPrice?: number;
  priceDir?: string;
  priceChange?: number;
  isHero?: boolean;
}) {
  const noPct = 100 - yesPct;
  const yesLeads = yesPct >= 50;

  return (
    <div className="w-full">
      {/* Main probability numbers */}
      <div className="flex items-end justify-between mb-4">
        {/* YES side — dominant */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: YES_COLOR + 'bb' }}>
            Yes
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn('tabular-nums font-black leading-none', isHero ? 'text-5xl' : 'text-4xl')}
              style={{ color: yesLeads ? YES_COLOR : 'oklch(0.50 0.01 280)' }}
            >
              {yesPct}
            </span>
            <span
              className="text-lg font-bold"
              style={{ color: yesLeads ? YES_COLOR + 'cc' : 'oklch(0.35 0.01 280)' }}
            >
              ¢
            </span>
            {/* Price delta */}
            {priceDir && priceDir !== 'flat' && priceChange && Math.abs(priceChange) > 0 && (
              <span className={cn(
                'flex items-center gap-0.5 text-[11px] font-bold ml-1 mb-0.5',
                priceDir === 'up' ? 'text-[#00d15d]' : 'text-[#f63d58]',
              )}>
                {priceDir === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(priceChange)}¢
              </span>
            )}
          </div>
          {lastPrice != null && lastPrice > 0 && lastPrice !== yesPct && (
            <span className="text-[10px] text-[oklch(0.38_0.01_280)] tabular-nums">
              Last {lastPrice}¢
            </span>
          )}
        </div>

        {/* NO side */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: NO_COLOR + 'bb' }}>
            No
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn('tabular-nums font-black leading-none', isHero ? 'text-5xl' : 'text-4xl')}
              style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.50 0.01 280)' }}
            >
              {noPct}
            </span>
            <span
              className="text-lg font-bold"
              style={{ color: !yesLeads ? NO_COLOR + 'cc' : 'oklch(0.35 0.01 280)' }}
            >
              ¢
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal probability bar */}
      <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'oklch(0.14 0.01 280)' }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${yesPct}%`, backgroundColor: YES_COLOR, opacity: 0.9 }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1.5 text-[9px] font-semibold">
        <span style={{ color: YES_COLOR + '99' }}>0%</span>
        <span style={{ color: 'oklch(0.30 0.01 280)' }}>50%</span>
        <span style={{ color: NO_COLOR + '99' }}>100%</span>
      </div>
    </div>
  );
}

// ── YES / NO Price Chips ───────────────────────────────────────────────────────
function PriceChips({
  yesBid,
  yesAsk,
  noBid,
  noAsk,
}: {
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
}) {
  // Show best buy prices: yesAsk (cost to buy YES) and noAsk (cost to buy NO)
  const yesBuy = yesAsk ?? yesBid;
  const noBuy  = noAsk  ?? noBid;

  if (!yesBuy && !noBuy) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[oklch(0.38_0.01_280)] font-medium shrink-0">Buy:</span>
      <div className="flex items-center gap-2 flex-wrap">
        {yesBuy != null && yesBuy > 0 && (
          <span
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-black tabular-nums"
            style={{
              color: YES_COLOR,
              backgroundColor: YES_COLOR + '14',
              border: `1px solid ${YES_COLOR}30`,
            }}
          >
            YES {yesBuy}¢
          </span>
        )}
        {noBuy != null && noBuy > 0 && (
          <span
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-black tabular-nums"
            style={{
              color: NO_COLOR,
              backgroundColor: NO_COLOR + '12',
              border: `1px solid ${NO_COLOR}2e`,
            }}
          >
            NO {noBuy}¢
          </span>
        )}
      </div>
    </div>
  );
}

// ── Market Metadata Row ────────────────────────────────────────────────────────
function MetaRow({
  volume24h,
  volume,
  openInterest,
  expiresLabel,
  expiryUrgency,
  closeTime,
}: {
  volume24h?: string;
  volume?: string;
  openInterest?: string;
  expiresLabel?: string;
  expiryUrgency?: string;
  closeTime?: string;
}) {
  const vol = volume24h && volume24h !== '' ? volume24h : (volume && volume !== '—' ? volume : null);
  const isUrgent = expiryUrgency === 'critical' || expiryUrgency === 'urgent';
  const isSoon = expiryUrgency === 'soon';

  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <div className="flex items-center gap-3">
        {vol && (
          <span className="text-[oklch(0.42_0.01_280)]">
            Vol <span className="text-white/75 font-semibold">{vol}</span>
          </span>
        )}
        {openInterest && openInterest !== '—' && (
          <span className="text-[oklch(0.42_0.01_280)]">
            OI <span className="text-[oklch(0.60_0.01_280)] font-semibold">{openInterest}</span>
          </span>
        )}
      </div>

      {/* Closes date */}
      {closeTime && closeTime !== 'TBD' && (
        <span className={cn(
          'flex items-center gap-1 font-medium',
          isUrgent ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-[oklch(0.38_0.01_280)]',
        )}>
          <Clock className={cn('w-3 h-3 shrink-0', isUrgent && 'animate-pulse')} />
          {expiresLabel === 'Closed' ? 'Closed' : `Closes ${closeTime}`}
        </span>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

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
    if (typeof d.yesPct === 'number') return Math.min(100, Math.max(0, d.yesPct));
    if (typeof d.yesPrice === 'string') {
      const parsed = parseFloat(d.yesPrice);
      return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 50;
    }
    return 50;
  })();

  const isActive  = status === 'active' || status === 'open' || status === 'live';
  const marketCat = (d.subcategory || subcategory || category || 'Prediction').toUpperCase();

  const yesBid: number | null = typeof d.yesBid === 'number' && d.yesBid > 0 ? d.yesBid : null;
  const yesAsk: number | null = typeof d.yesAsk === 'number' && d.yesAsk > 0 ? d.yesAsk : null;
  const noBid:  number | null = typeof d.noBid  === 'number' && d.noBid  > 0 ? d.noBid  : null;
  const noAsk:  number | null = typeof d.noAsk  === 'number' && d.noAsk  > 0 ? d.noAsk  : null;

  const hasPrices = yesBid !== null || yesAsk !== null || noBid !== null || noAsk !== null;

  const rawChange  = typeof d.priceChange === 'number' ? d.priceChange : 0;
  const safeChange = Math.abs(rawChange) <= 99 ? rawChange : 0;
  const priceDir: string = d.priceDirection || (safeChange > 0 ? 'up' : safeChange < 0 ? 'down' : 'flat');

  const displayTitle  = shortenTitle(title);
  const tradeUrl = d.eventTicker
    ? `https://kalshi.com/markets/${d.eventTicker}`
    : d.ticker
    ? `https://kalshi.com/markets/${d.ticker}`
    : null;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden transition-all duration-300',
        isHero
          ? 'border shadow-[0_0_48px_#00d15d08]'
          : 'border hover:shadow-[0_4px_24px_#00000040]',
      )}
      style={{
        backgroundColor: '#07090f',
        borderColor: isHero ? '#1e2840' : '#111827',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="px-4 pt-4 pb-3.5"
        style={{ borderBottom: '1px solid #0d1017' }}
      >
        {/* Breadcrumb + status */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="flex items-center justify-center w-5 h-5 rounded"
              style={{ backgroundColor: '#0e1420', border: '1px solid #1a2035' }}
            >
              <CategoryIcon
                label={d.iconLabel}
                className="text-[oklch(0.48_0.025_260)]"
              />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[oklch(0.32_0.025_260)] shrink-0">
              Kalshi
            </span>
            <span className="text-[oklch(0.20_0.01_280)] text-[9px]">/</span>
            <span className="text-[9px] font-semibold text-[oklch(0.44_0.015_270)] truncate">
              {marketCat}
            </span>
            {d.isHot && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0"
                style={{ color: '#f97316', backgroundColor: '#f9731610', border: '1px solid #f9731628' }}
              >
                <Flame className="w-2.5 h-2.5" /> Hot
              </span>
            )}
          </div>

          {/* Status pill */}
          {isActive ? (
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full shrink-0 bg-[#00d15d0d] border border-[#00d15d20]"
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#00d15d]" />
              <span className="text-[8px] font-black uppercase tracking-widest text-[#00d15d]">
                Live
              </span>
            </div>
          ) : (
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
              style={{ color: 'oklch(0.30 0.01 280)', backgroundColor: 'oklch(0.11 0.01 280)', border: '1px solid oklch(0.17 0.01 280)' }}
            >
              Closed
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className={cn(
            'font-bold text-white leading-snug',
            isHero ? 'text-base' : 'text-[13px]',
          )}
          title={title}
        >
          {displayTitle}
        </h3>

        {d.subtitle && d.subtitle !== title && (
          <p className="text-[11px] text-[oklch(0.40_0.01_280)] mt-1 line-clamp-2 leading-relaxed">
            {d.subtitle}
          </p>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-4">

        {/* Probability hero */}
        <ProbabilityHero
          yesPct={yesPct}
          lastPrice={typeof d.lastPrice === 'number' ? d.lastPrice : undefined}
          priceDir={priceDir}
          priceChange={safeChange}
          isHero={isHero}
        />

        {/* Buy prices */}
        {hasPrices && (
          <PriceChips
            yesBid={yesBid}
            yesAsk={yesAsk}
            noBid={noBid}
            noAsk={noAsk}
          />
        )}

        {/* Volume / OI / close date */}
        <MetaRow
          volume24h={d.volume24h}
          volume={d.volume}
          openInterest={d.openInterest}
          expiresLabel={d.expiresLabel}
          expiryUrgency={d.expiryUrgency}
          closeTime={d.closeTime}
        />

        {/* ── CTAs ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 pt-1" style={{ borderTop: '1px solid #0d1017' }}>

          {/* Analyze */}
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d15d]/30 bg-[oklch(0.11_0.018_260)] border border-[oklch(0.18_0.022_260)] text-[oklch(0.52_0.015_260)] hover:bg-[oklch(0.16_0.022_260)] hover:text-white hover:border-[oklch(0.26_0.028_260)]"
              aria-label={`Analyze ${title}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analyze
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Trade on Kalshi — primary CTA */}
          {tradeUrl && (
            <a
              href={tradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[12px] font-black tracking-wide transition-all duration-150 bg-[#00d15d14] border border-[#00d15d28] text-[#00d15d] hover:bg-[#00d15d28] hover:border-[#00d15d50]"
            >
              Trade on Kalshi
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
});
