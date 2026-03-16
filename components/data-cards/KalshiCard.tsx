'use client';

import React, { memo, useState, useEffect, useCallback, useId } from 'react';
import {
  TrendingUp, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock,
  Bitcoin, ArrowUp, ArrowDown, ExternalLink,
  Flame, BarChart3, ChevronRight, Layers,
  Activity,
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

// ── Brand colors ───────────────────────────────────────────────────────────────
const YES_COLOR = '#00d15d';
const NO_COLOR  = '#f63d58';

// ── Category accent colors (top border) ───────────────────────────────────────
const CATEGORY_ACCENT: Record<string, string> = {
  election:     '#3b82f6',
  politics:     '#3b82f6',
  sports:       '#10b981',
  weather:      '#22d3ee',
  finance:      '#f59e0b',
  crypto:       '#8b5cf6',
  tech:         '#7c3aed',
  entertainment:'#ec4899',
};
function getCategoryAccent(label?: string): string {
  return CATEGORY_ACCENT[(label || '').toLowerCase()] ?? '#6366f1';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function shortenTitle(title: string, maxLen = 80): string {
  if (title.length <= maxLen) return title;
  if (title.includes('·')) {
    const parts = title.split('·').map(p => p.trim());
    const remaining = parts.length - 2;
    if (remaining > 0) return `${parts[0]} · ${parts[1]} +${remaining} more`;
    return `${parts[0]} · ${parts[1]}`;
  }
  return title.slice(0, maxLen - 1) + '\u2026';
}

function CategoryIcon({ label, className, style }: { label?: string; className?: string; style?: React.CSSProperties }) {
  const cls = cn('w-3.5 h-3.5', className);
  switch ((label || '').toLowerCase()) {
    case 'election':
    case 'politics':     return <Vote className={cls} style={style} />;
    case 'sports':       return <Trophy className={cls} style={style} />;
    case 'weather':      return <CloudRain className={cls} style={style} />;
    case 'finance':      return <TrendingUp className={cls} style={style} />;
    case 'crypto':       return <Bitcoin className={cls} style={style} />;
    case 'tech':         return <Cpu className={cls} style={style} />;
    case 'entertainment':return <Film className={cls} style={style} />;
    default:             return <Globe className={cls} style={style} />;
  }
}

/** Format a raw contract count as "1.2M contracts" / "340K contracts" */
function fmtContracts(n?: number): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M contracts`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K contracts`;
  return `${n.toLocaleString()} contracts`;
}

/** Compute days-remaining and progress pct for time bar */
function timeRemaining(closeTimeIso?: string | null): {
  label: string;
  pctElapsed: number;
  urgency: 'critical' | 'urgent' | 'soon' | 'normal' | 'closed';
} {
  if (!closeTimeIso) return { label: 'TBD', pctElapsed: 0, urgency: 'normal' };
  const closeMs = new Date(closeTimeIso).getTime();
  const nowMs   = Date.now();
  const msLeft  = closeMs - nowMs;
  if (msLeft <= 0) return { label: 'Closed', pctElapsed: 100, urgency: 'closed' };

  const daysLeft = msLeft / 86_400_000;
  const label =
    daysLeft < 1  ? `< 1 day`  :
    daysLeft < 2  ? `1 day`    :
    daysLeft < 30 ? `${Math.round(daysLeft)} days` :
    daysLeft < 365 ? `${Math.round(daysLeft / 30)} mo` :
    `${(daysLeft / 365).toFixed(1)} yr`;

  const urgency: 'critical' | 'urgent' | 'soon' | 'normal' =
    daysLeft < 1 ? 'critical' : daysLeft < 3 ? 'urgent' : daysLeft < 7 ? 'soon' : 'normal';

  // Assume typical Kalshi market lifespan of ~90 days for progress bar
  const assumedLifespanMs = 90 * 86_400_000;
  const pctElapsed = Math.min(100, Math.max(0, 100 - (msLeft / assumedLifespanMs) * 100));

  return { label, pctElapsed, urgency };
}

// ── Sparkline ──────────────────────────────────────────────────────────────────
function Sparkline({
  trades,
  width = 100,
  height = 28,
}: {
  trades: Array<{ price: number }>;
  width?: number;
  height?: number;
}) {
  const uid = useId();
  if (trades.length < 2) return null;
  const prices  = trades.map(t => t.price);
  const min     = Math.min(...prices);
  const max     = Math.max(...prices);
  const range   = max - min || 1;
  const pad     = 3;
  const innerH  = height - pad * 2;

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = pad + innerH - ((p - min) / range) * innerH;
    return [x, y] as [number, number];
  });

  // Smooth cubic bezier path
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L ${width},${height} L 0,${height} Z`;

  const isUp    = prices[prices.length - 1] >= prices[0];
  const color   = isUp ? YES_COLOR : NO_COLOR;
  const gradId  = `spark-${uid.replace(/:/g, '')}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
      {/* Last price dot */}
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

// ── Probability Hero ───────────────────────────────────────────────────────────
function ProbabilityHero({
  yesPct,
  lastPrice,
  priceDir,
  priceChange,
  trades,
  isHero,
  animated,
}: {
  yesPct: number;
  lastPrice?: number;
  priceDir?: string;
  priceChange?: number;
  trades: Array<{ price: number }> | null;
  isHero?: boolean;
  animated: boolean;
}) {
  const noPct    = 100 - yesPct;
  const yesLeads = yesPct >= 50;

  return (
    <div className="w-full">
      {/* YES / NO numbers + sparkline */}
      <div className="flex items-start justify-between mb-3 gap-2">
        {/* YES side */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: YES_COLOR + 'bb' }}>Yes</span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn('tabular-nums font-black leading-none',
                isHero ? 'text-5xl' : 'text-4xl')}
              style={{ color: yesLeads ? YES_COLOR : 'oklch(0.48 0.01 280)' }}
            >
              {yesPct}
            </span>
            <span className="text-base font-bold"
                  style={{ color: yesLeads ? YES_COLOR + 'bb' : 'oklch(0.33 0.01 280)' }}>¢</span>
            {/* Δ arrow */}
            {priceDir && priceDir !== 'flat' && !!priceChange && Math.abs(priceChange) > 0 && (
              <span className={cn('flex items-center gap-0.5 text-[11px] font-bold ml-0.5 mb-0.5',
                priceDir === 'up' ? 'text-[#00d15d]' : 'text-[#f63d58]')}>
                {priceDir === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(priceChange)}¢
              </span>
            )}
          </div>
          {/* Implied prob */}
          <span className="text-[10px] font-medium tabular-nums"
                style={{ color: yesLeads ? YES_COLOR + '88' : 'oklch(0.32 0.01 280)' }}>
            {yesPct}% implied
          </span>
          {lastPrice != null && lastPrice > 0 && lastPrice !== yesPct && (
            <span className="text-[9px] text-[oklch(0.32_0.01_280)] tabular-nums">
              Last {lastPrice}¢
            </span>
          )}
        </div>

        {/* Sparkline — right-aligned */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {trades && trades.length >= 2 ? (
            <>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-[oklch(0.30_0.02_260)]" />
                <span className="text-[8px] text-[oklch(0.30_0.02_260)] font-semibold uppercase tracking-wider">
                  24h
                </span>
              </div>
              <Sparkline trades={trades} width={90} height={30} />
            </>
          ) : (
            <div className="w-[90px] h-[30px] flex items-center justify-center opacity-20">
              <Activity className="w-4 h-4 text-[oklch(0.35_0.01_280)]" />
            </div>
          )}
        </div>

        {/* NO side */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: NO_COLOR + 'bb' }}>No</span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn('tabular-nums font-black leading-none',
                isHero ? 'text-5xl' : 'text-4xl')}
              style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.48 0.01 280)' }}
            >
              {noPct}
            </span>
            <span className="text-base font-bold"
                  style={{ color: !yesLeads ? NO_COLOR + 'bb' : 'oklch(0.33 0.01 280)' }}>¢</span>
          </div>
          <span className="text-[10px] font-medium tabular-nums"
                style={{ color: !yesLeads ? NO_COLOR + '88' : 'oklch(0.32 0.01 280)' }}>
            {noPct}% implied
          </span>
        </div>
      </div>

      {/* Animated probability bar */}
      <div className="relative h-2 rounded-full overflow-hidden"
           style={{ backgroundColor: 'oklch(0.13 0.01 280)' }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: animated ? `${yesPct}%` : '0%',
            backgroundColor: YES_COLOR,
            opacity: 0.85,
            transition: animated ? 'width 800ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        />
        {/* NO fill from right */}
        <div
          className="absolute right-0 top-0 h-full rounded-full"
          style={{
            width: animated ? `${noPct}%` : '0%',
            backgroundColor: NO_COLOR,
            opacity: 0.45,
            transition: animated ? 'width 800ms cubic-bezier(0.4, 0, 0.2, 1) 100ms' : 'none',
          }}
        />
        <div className="absolute left-1/2 top-0 h-full w-px bg-[oklch(0.08_0.01_280)]" />
      </div>
      <div className="flex justify-between mt-1 text-[8px] font-semibold">
        <span style={{ color: YES_COLOR + '88' }}>0¢</span>
        <span className="text-[oklch(0.25_0.01_280)]">50¢</span>
        <span style={{ color: NO_COLOR + '88' }}>100¢</span>
      </div>
    </div>
  );
}

// ── Price Chips + Spread ───────────────────────────────────────────────────────
function PriceChips({
  yesBid, yesAsk, noBid, noAsk, spread,
}: {
  yesBid: number | null; yesAsk: number | null;
  noBid: number | null;  noAsk: number | null;
  spread?: number;
}) {
  const yesBuy = yesAsk ?? yesBid;
  const noBuy  = noAsk  ?? noBid;
  if (!yesBuy && !noBuy) return null;

  const spreadLabel =
    spread == null ? null :
    spread <= 1    ? { text: '1¢ spread', cls: 'text-[#00d15d] bg-[#00d15d0e] border-[#00d15d22]' } :
    spread <= 4    ? { text: `${spread}¢ spread`, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' } :
    { text: `${spread}¢ spread`, cls: 'text-[#f63d58] bg-[#f63d580e] border-[#f63d5822]' };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.30_0.02_260)]">
          Buy price
        </span>
        {spreadLabel && (
          <span className={cn(
            'text-[9px] font-semibold px-2 py-0.5 rounded-full border',
            spreadLabel.cls,
          )}>
            {spreadLabel.text}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {yesBuy != null && yesBuy > 0 && (
          <div
            className="flex-1 flex items-center justify-center py-2 rounded-lg text-[13px] font-black tabular-nums border"
            style={{ color: YES_COLOR, backgroundColor: YES_COLOR + '12', borderColor: YES_COLOR + '2e' }}
          >
            YES&nbsp;&nbsp;{yesBuy}¢
          </div>
        )}
        {noBuy != null && noBuy > 0 && (
          <div
            className="flex-1 flex items-center justify-center py-2 rounded-lg text-[13px] font-black tabular-nums border"
            style={{ color: NO_COLOR, backgroundColor: NO_COLOR + '0e', borderColor: NO_COLOR + '28' }}
          >
            NO&nbsp;&nbsp;{noBuy}¢
          </div>
        )}
      </div>
    </div>
  );
}

// ── Market Stats Row ───────────────────────────────────────────────────────────
function StatsRow({
  volume24hRaw, volumeRaw, openInterestRaw,
}: {
  volume24hRaw?: number; volumeRaw?: number; openInterestRaw?: number;
}) {
  const vol24h   = fmtContracts(volume24hRaw);
  const volTotal = fmtContracts(volumeRaw);
  const oi       = openInterestRaw && openInterestRaw > 0
    ? (openInterestRaw >= 1_000_000
        ? `${(openInterestRaw / 1_000_000).toFixed(1)}M`
        : openInterestRaw >= 1_000
        ? `${(openInterestRaw / 1_000).toFixed(0)}K`
        : `${openInterestRaw}`)
    : null;

  if (!vol24h && !volTotal && !oi) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.28_0.02_260)]">24h Vol</span>
        <span className="text-[11px] font-bold text-white/75 tabular-nums">{vol24h ?? '—'}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.28_0.02_260)]">Total Vol</span>
        <span className="text-[11px] font-bold text-white/75 tabular-nums">{volTotal ?? '—'}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-[oklch(0.28_0.02_260)]">Open Int</span>
        <span className="text-[11px] font-bold text-[oklch(0.55_0.01_280)] tabular-nums">{oi ?? '—'}</span>
      </div>
    </div>
  );
}

// ── Time Remaining Bar ─────────────────────────────────────────────────────────
function TimeBar({ closeTimeIso }: { closeTimeIso?: string | null }) {
  const { label, pctElapsed, urgency } = timeRemaining(closeTimeIso);
  if (urgency === 'closed') return null;

  const barColor =
    urgency === 'critical' ? '#f63d58' :
    urgency === 'urgent'   ? '#f97316' :
    urgency === 'soon'     ? '#f59e0b' :
    '#6366f1';

  const textColor =
    urgency === 'critical' ? 'text-[#f63d58]' :
    urgency === 'urgent'   ? 'text-orange-400' :
    urgency === 'soon'     ? 'text-amber-400' :
    'text-[oklch(0.40_0.01_280)]';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.28_0.02_260)]">
          Closes in
        </span>
        <span className={cn('flex items-center gap-1 text-[10px] font-semibold', textColor)}>
          <Clock className={cn('w-3 h-3', urgency === 'critical' && 'animate-pulse')} />
          {label}
        </span>
      </div>
      {/* Progress bar — left = elapsed, right = remaining */}
      <div className="relative h-1.5 rounded-full overflow-hidden bg-[oklch(0.13_0.01_280)]">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
          style={{ width: `${pctElapsed}%`, backgroundColor: barColor, opacity: 0.75 }}
        />
      </div>
    </div>
  );
}

// ── Related Markets Link ───────────────────────────────────────────────────────
function RelatedMarketsLink({ seriesTicker, eventTicker }: { seriesTicker?: string; eventTicker?: string }) {
  // Prefer eventTicker for the link since it maps to a real Kalshi page (/markets/{event})
  const linkTarget = eventTicker || seriesTicker;
  if (!linkTarget) return null;
  const label = seriesTicker || eventTicker || '';
  return (
    <a
      href={`https://kalshi.com/markets/${linkTarget.toLowerCase()}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-[10px] text-[oklch(0.38_0.02_260)] hover:text-[oklch(0.55_0.02_260)] transition-colors duration-150 font-medium"
    >
      <Layers className="w-3 h-3 shrink-0" />
      More markets in {label}
      <ChevronRight className="w-3 h-3" />
    </a>
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
  const [animated, setAnimated] = useState(false);
  const [trades, setTrades]     = useState<Array<{ price: number }> | null>(null);

  // Trigger bar animation on mount
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Fetch trade history for sparkline (staggered to avoid rate-limit spikes)
  const fetchTrades = useCallback(() => {
    if (!d.ticker) return;
    const delay = Math.random() * 600; // 0–600ms stagger across multiple cards
    const tid = setTimeout(() => {
      fetch(`/api/kalshi?ticker=${encodeURIComponent(d.ticker)}&include=trades`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.trades?.length >= 2) {
            setTrades(data.trades.slice(-24).map((t: any) => ({ price: t.price })));
          }
        })
        .catch(() => null);
    }, delay);
    return () => clearTimeout(tid);
  }, [d.ticker]);

  useEffect(() => {
    const cleanup = fetchTrades();
    return cleanup;
  }, [fetchTrades]);

  // Derived values
  const yesPct: number = (() => {
    if (typeof d.yesPct === 'number') return Math.min(100, Math.max(0, d.yesPct));
    if (typeof d.yesPrice === 'string') {
      const p = parseFloat(d.yesPrice);
      return Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 50;
    }
    return 50;
  })();

  const isActive   = status === 'active' || status === 'open' || status === 'live';
  const marketCat  = (d.subcategory || subcategory || category || 'Prediction').toUpperCase();
  const accentColor = getCategoryAccent(d.iconLabel);

  const yesBid: number | null = typeof d.yesBid === 'number' && d.yesBid > 0 ? d.yesBid : null;
  const yesAsk: number | null = typeof d.yesAsk === 'number' && d.yesAsk > 0 ? d.yesAsk : null;
  const noBid:  number | null = typeof d.noBid  === 'number' && d.noBid  > 0 ? d.noBid  : null;
  const noAsk:  number | null = typeof d.noAsk  === 'number' && d.noAsk  > 0 ? d.noAsk  : null;
  const hasPrices = yesBid !== null || yesAsk !== null || noBid !== null || noAsk !== null;

  const rawChange  = typeof d.priceChange === 'number' ? d.priceChange : 0;
  const safeChange = Math.abs(rawChange) <= 99 ? rawChange : 0;
  const priceDir   = d.priceDirection || (safeChange > 0 ? 'up' : safeChange < 0 ? 'down' : 'flat');

  const displayTitle = shortenTitle(title);

  // Deep link — Kalshi URL format: /markets/{event_ticker}/{market_ticker} (lowercase)
  // seriesTicker is a category grouping (e.g. "KXBTC"), NOT a valid URL path segment
  // eventTicker is the parent event (e.g. "KXBTCD-25MAR14") used as the first path segment
  const evt = (d.eventTicker || '').toLowerCase();
  const mkt = (d.ticker      || '').toLowerCase();
  const tradeBase = evt && mkt
    ? `https://kalshi.com/markets/${evt}/${mkt}`
    : evt
    ? `https://kalshi.com/markets/${evt}`
    : mkt
    ? `https://kalshi.com/markets/${mkt}`
    : null;

  // YES/NO buy deep links — Kalshi doesn't have a ?side= param, both link to the same market
  const yesTradeUrl = tradeBase;
  const noTradeUrl  = tradeBase;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden transition-all duration-300',
        isHero
          ? 'border shadow-[0_0_48px_#00d15d06]'
          : 'border hover:shadow-[0_6px_32px_#00000050]',
      )}
      style={{
        backgroundColor: '#07090f',
        borderColor: isHero ? '#1e2840' : '#111827',
        borderTopColor: accentColor,
        borderTopWidth: '2px',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: '1px solid #0c0f18' }}>
        {/* Breadcrumb + status */}
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="flex items-center justify-center w-5 h-5 rounded"
              style={{ backgroundColor: accentColor + '18', border: `1px solid ${accentColor}30` }}
            >
              <CategoryIcon label={d.iconLabel} style={{ color: accentColor }} className="" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[oklch(0.30_0.025_260)] shrink-0">
              Kalshi
            </span>
            <span className="text-[oklch(0.18_0.01_280)] text-[9px]">/</span>
            <span className="text-[9px] font-semibold truncate" style={{ color: accentColor + 'cc' }}>
              {marketCat}
            </span>
            {d.isHot && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0 text-orange-400 bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-2.5 h-2.5" /> Hot
              </span>
            )}
          </div>

          {isActive ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full shrink-0 bg-[#00d15d0d] border border-[#00d15d20]">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#00d15d]" />
              <span className="text-[8px] font-black uppercase tracking-widest text-[#00d15d]">Live</span>
            </div>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[oklch(0.10_0.01_280)] border border-[oklch(0.16_0.01_280)] text-[oklch(0.28_0.01_280)] shrink-0">
              Closed
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className={cn('font-bold text-white leading-snug', isHero ? 'text-base' : 'text-[13px]')}
          title={title}
        >
          {displayTitle}
        </h3>

        {/* Subtitle / resolution condition */}
        {d.subtitle && d.subtitle !== title && d.subtitle.length > 0 && (
          <p className="text-[11px] text-[oklch(0.38_0.01_280)] mt-1 line-clamp-2 leading-relaxed">
            {d.subtitle}
          </p>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-4">

        {/* Probability hero + sparkline */}
        <ProbabilityHero
          yesPct={yesPct}
          lastPrice={typeof d.lastPrice === 'number' ? d.lastPrice : undefined}
          priceDir={priceDir}
          priceChange={safeChange}
          trades={trades}
          isHero={isHero}
          animated={animated}
        />

        <div className="h-px bg-[#0c0f18]" />

        {/* Buy prices + spread */}
        {hasPrices && (
          <PriceChips
            yesBid={yesBid}
            yesAsk={yesAsk}
            noBid={noBid}
            noAsk={noAsk}
            spread={typeof d.spread === 'number' ? d.spread : undefined}
          />
        )}

        {/* Stats: 24h vol, total vol, OI */}
        <StatsRow
          volume24hRaw={d.volume24hRaw}
          volumeRaw={d.volumeRaw}
          openInterestRaw={d.openInterestRaw}
        />

        {/* Time remaining bar */}
        <TimeBar closeTimeIso={d.closeTimeIso} />

        {/* Related markets */}
        {(d.seriesTicker || d.eventTicker) && d.seriesTicker !== d.ticker && (
          <RelatedMarketsLink seriesTicker={d.seriesTicker} eventTicker={d.eventTicker} />
        )}

        {/* ── CTAs ──────────────────────────────────────────────────────────── */}
        <div className="space-y-2 pt-1" style={{ borderTop: '1px solid #0c0f18' }}>

          {/* Analyze */}
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d15d]/30 bg-[oklch(0.11_0.018_260)] border border-[oklch(0.17_0.022_260)] text-[oklch(0.48_0.015_260)] hover:bg-[oklch(0.16_0.022_260)] hover:text-white hover:border-[oklch(0.24_0.028_260)]"
              aria-label={`Analyze ${title}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              AI Analysis
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Split YES / NO trade buttons */}
          {tradeBase && (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={yesTradeUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-black tracking-wide transition-all duration-150 border"
                style={{
                  color: YES_COLOR,
                  backgroundColor: YES_COLOR + '14',
                  borderColor: YES_COLOR + '30',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = YES_COLOR + '26';
                  (e.currentTarget as HTMLElement).style.borderColor = YES_COLOR + '55';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = YES_COLOR + '14';
                  (e.currentTarget as HTMLElement).style.borderColor = YES_COLOR + '30';
                }}
              >
                Buy YES
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
              <a
                href={noTradeUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-black tracking-wide transition-all duration-150 border"
                style={{
                  color: NO_COLOR,
                  backgroundColor: NO_COLOR + '10',
                  borderColor: NO_COLOR + '28',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = NO_COLOR + '22';
                  (e.currentTarget as HTMLElement).style.borderColor = NO_COLOR + '50';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = NO_COLOR + '10';
                  (e.currentTarget as HTMLElement).style.borderColor = NO_COLOR + '28';
                }}
              >
                Buy NO
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});
