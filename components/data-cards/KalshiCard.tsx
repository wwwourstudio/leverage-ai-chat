'use client';

import React, { memo, useState, useEffect, useCallback, useId, useRef } from 'react';
import {
  TrendingUp, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock,
  Bitcoin, ArrowUp, ArrowDown, ExternalLink,
  Flame, BarChart3, ChevronRight, Layers,
  Activity, Zap, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKalshiStore } from '@/lib/store/kalshi-store';

// ── Props ──────────────────────────────────────────────────────────────────────

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

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY_ACCENT: Record<string, string> = {
  election:     '#3b82f6',
  politics:     '#3b82f6',
  sports:       '#10b981',
  weather:      '#22d3ee',
  finance:      '#f59e0b',
  crypto:       '#8b5cf6',
  tech:         '#7c3aed',
  entertainment:'#ec4899',
  market:       '#6366f1',
};

function getCategoryAccent(label?: string): string {
  return CATEGORY_ACCENT[(label || '').toLowerCase()] ?? '#6366f1';
}

function CategoryIcon({ label, size = 14, style }: { label?: string; size?: number; style?: React.CSSProperties }) {
  const cls = `shrink-0`;
  const s = { width: size, height: size, ...style };
  switch ((label || '').toLowerCase()) {
    case 'election':
    case 'politics':     return <Vote className={cls} style={s} />;
    case 'sports':       return <Trophy className={cls} style={s} />;
    case 'weather':      return <CloudRain className={cls} style={s} />;
    case 'finance':      return <TrendingUp className={cls} style={s} />;
    case 'crypto':       return <Bitcoin className={cls} style={s} />;
    case 'tech':         return <Cpu className={cls} style={s} />;
    case 'entertainment':return <Film className={cls} style={s} />;
    default:             return <Globe className={cls} style={s} />;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function shortenTitle(title: string, maxLen = 72): string {
  if (title.length <= maxLen) return title;
  if (title.includes('·')) {
    const parts = title.split('·').map(p => p.trim());
    const extra = parts.length - 2;
    return extra > 0
      ? `${parts[0]} · ${parts[1]} +${extra}`
      : `${parts[0]} · ${parts[1]}`;
  }
  return title.slice(0, maxLen - 1) + '…';
}

function fmtVol(n?: number): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function timeRemaining(iso?: string | null): {
  label: string; pctElapsed: number;
  urgency: 'critical' | 'urgent' | 'soon' | 'normal' | 'closed';
} {
  if (!iso) return { label: 'TBD', pctElapsed: 0, urgency: 'normal' };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: 'Closed', pctElapsed: 100, urgency: 'closed' };
  const days = ms / 86_400_000;
  const label =
    days < 1   ? '< 1 day'   :
    days < 2   ? '1 day'     :
    days < 30  ? `${Math.round(days)} days` :
    days < 365 ? `${Math.round(days / 30)} mo` :
                 `${(days / 365).toFixed(1)} yr`;
  const urgency =
    days < 1 ? 'critical' : days < 3 ? 'urgent' : days < 7 ? 'soon' : 'normal';
  const pctElapsed = Math.min(100, Math.max(0, 100 - (ms / (90 * 86_400_000)) * 100));
  return { label, pctElapsed, urgency };
}

/** True when the ticker is a real public Kalshi identifier (no UUID/hex segments) */
const isPublicTicker = (t?: string) =>
  Boolean(t) && (t as string).length <= 35 && !/-[0-9a-f]{8,}/i.test(t as string);

// ── Sparkline ──────────────────────────────────────────────────────────────────

function Sparkline({
  trades, width = 80, height = 24,
}: { trades: Array<{ price: number }>; width?: number; height?: number }) {
  const uid = useId();
  if (trades.length < 2) return null;
  const prices = trades.map(t => t.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 2, innerH = height - pad * 2;
  const pts = prices.map((p, i) => [
    (i / (prices.length - 1)) * width,
    pad + innerH - ((p - min) / range) * innerH,
  ] as [number, number]);
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L ${width},${height} L 0,${height} Z`;
  const isUp  = prices[prices.length - 1] >= prices[0];
  const color = isUp ? YES_COLOR : NO_COLOR;
  const gid   = `spark-${uid.replace(/:/g, '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
         className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]}
              r="2.5" fill={color} />
    </svg>
  );
}

// ── Signal Banner ──────────────────────────────────────────────────────────────

function SignalBanner({ recommendation, edgeScore }: { recommendation?: string; edgeScore?: number }) {
  if (!recommendation) return null;

  const isStrongYes = recommendation.toLowerCase().includes('strong yes');
  const isLeanYes   = recommendation.toLowerCase().includes('lean yes');
  const isStrongNo  = recommendation.toLowerCase().includes('strong no');
  const isLeanNo    = recommendation.toLowerCase().includes('lean no');
  const isEfficient = recommendation.toLowerCase().includes('efficient');

  const config =
    isStrongYes ? { icon: <Zap className="w-3 h-3 shrink-0" />,        color: YES_COLOR, bg: YES_COLOR + '14', border: YES_COLOR + '35' } :
    isLeanYes   ? { icon: <TrendingUp className="w-3 h-3 shrink-0" />, color: YES_COLOR + 'cc', bg: YES_COLOR + '0a', border: YES_COLOR + '25' } :
    isStrongNo  ? { icon: <Zap className="w-3 h-3 shrink-0" />,        color: NO_COLOR,  bg: NO_COLOR  + '14', border: NO_COLOR  + '35' } :
    isLeanNo    ? { icon: <TrendingDown className="w-3 h-3 shrink-0" />, color: NO_COLOR + 'cc', bg: NO_COLOR + '0a', border: NO_COLOR + '25' } :
    { icon: <Activity className="w-3 h-3 shrink-0" />, color: '#6366f1cc', bg: '#6366f10e', border: '#6366f130' };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold"
      style={{ color: config.color, backgroundColor: config.bg, border: `1px solid ${config.border}` }}
    >
      {config.icon}
      <span className="flex-1 leading-snug">{recommendation}</span>
      {typeof edgeScore === 'number' && edgeScore > 0 && !isEfficient && (
        <span className="tabular-nums font-black text-[10px] shrink-0 opacity-80">
          {edgeScore}% edge
        </span>
      )}
    </div>
  );
}

// ── Probability Hero ───────────────────────────────────────────────────────────

function ProbabilityHero({
  yesPct, lastPrice, priceDir, priceChange, trades, isHero, animated,
}: {
  yesPct: number; lastPrice?: number; priceDir?: string; priceChange?: number;
  trades: Array<{ price: number }> | null; isHero?: boolean; animated: boolean;
}) {
  const noPct    = 100 - yesPct;
  const yesLeads = yesPct >= 50;

  return (
    <div className="w-full space-y-3">
      {/* YES / NO price row */}
      <div className="flex items-end justify-between gap-3">

        {/* YES block */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.14em]"
                style={{ color: YES_COLOR + '99' }}>Yes</span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn('tabular-nums font-black leading-none tracking-tight',
                isHero ? 'text-[44px]' : 'text-[38px]')}
              style={{ color: yesLeads ? YES_COLOR : 'oklch(0.42 0.01 280)' }}
            >
              {yesPct}
            </span>
            <span className="text-sm font-bold mb-0.5"
                  style={{ color: yesLeads ? YES_COLOR + 'aa' : 'oklch(0.28 0.01 280)' }}>¢</span>
            {/* Δ indicator */}
            {priceDir && priceDir !== 'flat' && !!priceChange && Math.abs(priceChange) > 0 && (
              <span className={cn('flex items-center gap-0.5 text-[10px] font-bold mb-1',
                priceDir === 'up' ? 'text-[#00d15d]' : 'text-[#f63d58]')}>
                {priceDir === 'up'
                  ? <ArrowUp className="w-2.5 h-2.5" />
                  : <ArrowDown className="w-2.5 h-2.5" />}
                {Math.abs(priceChange)}¢
              </span>
            )}
          </div>
          <span className="text-[9px] font-medium tabular-nums"
                style={{ color: yesLeads ? YES_COLOR + '70' : 'oklch(0.28 0.01 280)' }}>
            {yesPct}% implied
          </span>
          {lastPrice != null && lastPrice > 0 && lastPrice !== yesPct && (
            <span className="text-[9px] text-[oklch(0.28_0.01_280)] tabular-nums">
              last {lastPrice}¢
            </span>
          )}
        </div>

        {/* Sparkline — center */}
        <div className="flex flex-col items-center gap-1 flex-1 pb-1">
          {trades && trades.length >= 2 ? (
            <>
              <Sparkline trades={trades} width={80} height={24} />
              <span className="text-[8px] font-semibold uppercase tracking-wider"
                    style={{ color: 'oklch(0.28 0.02 260)' }}>24h</span>
            </>
          ) : (
            <div className="w-20 h-6 rounded-lg flex items-center justify-center opacity-15"
                 style={{ backgroundColor: 'oklch(0.14 0.01 280)' }}>
              <Activity className="w-3.5 h-3.5" style={{ color: 'oklch(0.35 0.01 280)' }} />
            </div>
          )}
        </div>

        {/* NO block */}
        <div className="flex flex-col items-end gap-0.5 min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.14em]"
                style={{ color: NO_COLOR + '99' }}>No</span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn('tabular-nums font-black leading-none tracking-tight',
                isHero ? 'text-[44px]' : 'text-[38px]')}
              style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.42 0.01 280)' }}
            >
              {noPct}
            </span>
            <span className="text-sm font-bold mb-0.5"
                  style={{ color: !yesLeads ? NO_COLOR + 'aa' : 'oklch(0.28 0.01 280)' }}>¢</span>
          </div>
          <span className="text-[9px] font-medium tabular-nums"
                style={{ color: !yesLeads ? NO_COLOR + '70' : 'oklch(0.28 0.01 280)' }}>
            {noPct}% implied
          </span>
        </div>
      </div>

      {/* Probability bar */}
      <div className="space-y-1">
        <div className="relative h-2.5 rounded-full overflow-hidden"
             style={{ backgroundColor: 'oklch(0.12 0.01 280)' }}>
          {/* YES fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: animated ? `${yesPct}%` : '0%',
              background: `linear-gradient(90deg, ${YES_COLOR}dd, ${YES_COLOR}88)`,
              transition: animated ? 'width 900ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            }}
          />
          {/* NO fill from right */}
          <div
            className="absolute right-0 top-0 h-full rounded-full"
            style={{
              width: animated ? `${noPct}%` : '0%',
              background: `linear-gradient(270deg, ${NO_COLOR}cc, ${NO_COLOR}55)`,
              transition: animated ? 'width 900ms cubic-bezier(0.4, 0, 0.2, 1) 80ms' : 'none',
            }}
          />
          {/* 50¢ center notch */}
          <div className="absolute left-1/2 -translate-x-px top-0 h-full w-0.5"
               style={{ backgroundColor: 'oklch(0.07 0.01 280)' }} />
        </div>
        <div className="flex justify-between text-[8px] font-semibold">
          <span style={{ color: YES_COLOR + '66' }}>0¢</span>
          <span style={{ color: 'oklch(0.22 0.01 280)' }}>50¢</span>
          <span style={{ color: NO_COLOR + '66' }}>100¢</span>
        </div>
      </div>
    </div>
  );
}

// ── Order Book Mini ────────────────────────────────────────────────────────────

function OrderBookMini({
  bids, asks,
}: {
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
}) {
  if ((!bids?.length && !asks?.length)) return null;
  const top3Bids = (bids ?? []).slice(0, 3);
  const top3Asks = (asks ?? []).slice(0, 3);
  const maxQty   = Math.max(...[...top3Bids, ...top3Asks].map(r => r.quantity), 1);

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'oklch(0.09 0.01 280)', border: '1px solid oklch(0.14 0.01 280)' }}>
      <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'oklch(0.12 0.01 280)' }}>
        {/* Bids (YES) */}
        <div className="p-2.5 space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: YES_COLOR + '88' }}>Bids</span>
          {top3Bids.map((row, i) => (
            <div key={i} className="relative flex items-center justify-between text-[10px] tabular-nums rounded overflow-hidden px-1.5 py-0.5">
              <div className="absolute inset-0 rounded"
                   style={{ backgroundColor: YES_COLOR + '0f', width: `${(row.quantity / maxQty) * 100}%`, transition: 'width 600ms' }} />
              <span className="relative font-bold z-10" style={{ color: YES_COLOR + 'cc' }}>{row.price}¢</span>
              <span className="relative text-[9px] z-10" style={{ color: 'oklch(0.38 0.01 280)' }}>{row.quantity.toLocaleString()}</span>
            </div>
          ))}
        </div>
        {/* Asks (NO) */}
        <div className="p-2.5 space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: NO_COLOR + '88' }}>Asks</span>
          {top3Asks.map((row, i) => (
            <div key={i} className="relative flex items-center justify-between text-[10px] tabular-nums rounded overflow-hidden px-1.5 py-0.5">
              <div className="absolute right-0 inset-y-0 rounded"
                   style={{ backgroundColor: NO_COLOR + '0f', width: `${(row.quantity / maxQty) * 100}%`, transition: 'width 600ms' }} />
              <span className="relative font-bold z-10" style={{ color: NO_COLOR + 'cc' }}>{row.price}¢</span>
              <span className="relative text-[9px] z-10" style={{ color: 'oklch(0.38 0.01 280)' }}>{row.quantity.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Buy Price Chips ────────────────────────────────────────────────────────────

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

  const spreadConf =
    spread == null ? null :
    spread <= 1 ? { text: '1¢ spread', style: { color: YES_COLOR, backgroundColor: YES_COLOR + '10', border: `1px solid ${YES_COLOR}28` } } :
    spread <= 4 ? { text: `${spread}¢ spread`, style: { color: '#f59e0b', backgroundColor: '#f59e0b10', border: '1px solid #f59e0b28' } } :
    { text: `${spread}¢ spread`, style: { color: NO_COLOR, backgroundColor: NO_COLOR + '0e', border: `1px solid ${NO_COLOR}28` } };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: 'oklch(0.28 0.02 260)' }}>Best price to buy</span>
        {spreadConf && (
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={spreadConf.style}>
            {spreadConf.text}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {yesBuy != null && yesBuy > 0 && (
          <div className="flex flex-col items-center py-2.5 px-2 rounded-xl text-[13px] font-black tabular-nums"
               style={{ color: YES_COLOR, backgroundColor: YES_COLOR + '10', border: `1px solid ${YES_COLOR}28` }}>
            <span className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: YES_COLOR + '88' }}>Yes ask</span>
            {yesBuy}¢
          </div>
        )}
        {noBuy != null && noBuy > 0 && (
          <div className="flex flex-col items-center py-2.5 px-2 rounded-xl text-[13px] font-black tabular-nums"
               style={{ color: NO_COLOR, backgroundColor: NO_COLOR + '0d', border: `1px solid ${NO_COLOR}25` }}>
            <span className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: NO_COLOR + '88' }}>No ask</span>
            {noBuy}¢
          </div>
        )}
      </div>
    </div>
  );
}

// ── Market Stats ───────────────────────────────────────────────────────────────

function StatsRow({
  volume24hRaw, volumeRaw, openInterestRaw, volumeTier,
}: {
  volume24hRaw?: number; volumeRaw?: number; openInterestRaw?: number; volumeTier?: string;
}) {
  const vol24h = fmtVol(volume24hRaw);
  const volAll = fmtVol(volumeRaw);
  const oi     = fmtVol(openInterestRaw);
  if (!vol24h && !volAll && !oi) return null;

  const tierColor =
    volumeTier === 'Deep'     ? YES_COLOR    :
    volumeTier === 'Active'   ? '#f59e0b'    :
    volumeTier === 'Moderate' ? '#6366f1'    : 'oklch(0.35 0.01 280)';

  return (
    <div className="rounded-xl px-3 py-2.5 space-y-2"
         style={{ backgroundColor: 'oklch(0.09 0.01 280)', border: '1px solid oklch(0.14 0.01 280)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-black uppercase tracking-widest"
              style={{ color: 'oklch(0.28 0.02 260)' }}>Market Depth</span>
        {volumeTier && (
          <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ color: tierColor, backgroundColor: tierColor + '15', border: `1px solid ${tierColor}28` }}>
            {volumeTier}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider"
                style={{ color: 'oklch(0.28 0.02 260)' }}>24h Vol</span>
          <span className="text-[12px] font-black tabular-nums text-white/80">{vol24h ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider"
                style={{ color: 'oklch(0.28 0.02 260)' }}>Total</span>
          <span className="text-[12px] font-black tabular-nums text-white/80">{volAll ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider"
                style={{ color: 'oklch(0.28 0.02 260)' }}>Open Int</span>
          <span className="text-[12px] font-black tabular-nums" style={{ color: '#6366f1' }}>{oi ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

// ── Time Bar ───────────────────────────────────────────────────────────────────

function TimeBar({ closeTimeIso }: { closeTimeIso?: string | null }) {
  const { label, pctElapsed, urgency } = timeRemaining(closeTimeIso);
  if (urgency === 'closed') return null;

  const barColor  =
    urgency === 'critical' ? NO_COLOR  :
    urgency === 'urgent'   ? '#f97316' :
    urgency === 'soon'     ? '#f59e0b' : '#6366f1';
  const textStyle: React.CSSProperties =
    urgency === 'critical' ? { color: NO_COLOR }   :
    urgency === 'urgent'   ? { color: '#fb923c' }  :
    urgency === 'soon'     ? { color: '#fbbf24' }  :
    { color: 'oklch(0.40 0.01 280)' };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: 'oklch(0.28 0.02 260)' }}>Closes in</span>
        <span className="flex items-center gap-1 text-[10px] font-bold" style={textStyle}>
          <Clock className={cn('w-3 h-3', urgency === 'critical' && 'animate-pulse')} />
          {label}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden"
           style={{ backgroundColor: 'oklch(0.12 0.01 280)' }}>
        <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
             style={{ width: `${pctElapsed}%`, backgroundColor: barColor, opacity: 0.8 }} />
      </div>
    </div>
  );
}

// ── Related Markets ────────────────────────────────────────────────────────────

function RelatedMarketsLink({ seriesTicker, eventTicker }: { seriesTicker?: string; eventTicker?: string }) {
  const validSeries = isPublicTicker(seriesTicker) ? seriesTicker : null;
  const validEvent  = isPublicTicker(eventTicker)  ? eventTicker  : null;
  const linkTarget  = validSeries || validEvent;
  if (!linkTarget) return null;
  return (
    <a
      href={`https://kalshi.com/markets/${linkTarget.toLowerCase()}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-[10px] font-medium transition-colors duration-150 group/rel"
      style={{ color: 'oklch(0.36 0.02 260)' }}
    >
      <Layers className="w-3 h-3 shrink-0" />
      <span className="group-hover/rel:underline">More in {linkTarget}</span>
      <ChevronRight className="w-3 h-3 opacity-60" />
    </a>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="h-px" style={{ backgroundColor: 'oklch(0.10 0.01 280)' }} />;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const KalshiCard = memo(function KalshiCard({
  title, category, subcategory, data: d, status, onAnalyze, isHero,
}: KalshiCardProps) {
  const [animated, setAnimated] = useState(false);
  const [trades, setTrades]     = useState<Array<{ price: number }> | null>(null);

  // ── Real-time WebSocket price overlay ──────────────────────────────────────
  const livePrice  = useKalshiStore(s => d.ticker ? s.getPrice(d.ticker as string) : undefined);
  const [priceFlash, setPriceFlash] = useState(false);
  const prevMid    = useRef<number | null>(null);

  // Subscribe to this ticker's real-time updates while the card is mounted
  useEffect(() => {
    if (!d.ticker) return;
    const { subscribe, unsubscribe } = useKalshiStore.getState();
    subscribe([d.ticker as string]);
    return () => unsubscribe([d.ticker as string]);
  }, [d.ticker]);

  // Brief green flash when the live price mid changes
  useEffect(() => {
    if (!livePrice) return;
    if (prevMid.current !== null && prevMid.current !== livePrice.yesMid) {
      setPriceFlash(true);
      const t = setTimeout(() => setPriceFlash(false), 700);
      return () => clearTimeout(t);
    }
    prevMid.current = livePrice.yesMid;
  }, [livePrice?.yesMid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Fetch trade sparkline (staggered to avoid rate-limit spikes on multi-card grids)
  const fetchTrades = useCallback(() => {
    if (!d.ticker) return;
    const delay = Math.random() * 500;
    const tid = setTimeout(() => {
      fetch(`/api/kalshi?ticker=${encodeURIComponent(d.ticker)}&include=trades`)
        .then(r => r.ok ? r.json() : null)
        .then(res => {
          if (res?.trades?.length >= 2) {
            setTrades(res.trades.slice(-24).map((t: any) => ({ price: t.price })));
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

  // ── Derived values ─────────────────────────────────────────────────────────

  const yesPct: number = (() => {
    if (typeof d.yesPct === 'number') return Math.min(100, Math.max(0, d.yesPct));
    if (typeof d.yesPrice === 'string') {
      const p = parseFloat(d.yesPrice);
      return Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 50;
    }
    return 50;
  })();

  const isActive    = status === 'active' || status === 'open' || status === 'live';
  const marketCat   = (d.subcategory || subcategory || category || 'Prediction').toUpperCase();
  const accentColor = getCategoryAccent(d.iconLabel);

  // Use live WebSocket prices when available; fall back to REST data from props
  const yesBid: number | null = (livePrice && livePrice.yesBid > 0) ? livePrice.yesBid
    : (typeof d.yesBid === 'number' && d.yesBid > 0 ? d.yesBid : null);
  const yesAsk: number | null = (livePrice && livePrice.yesAsk > 0) ? livePrice.yesAsk
    : (typeof d.yesAsk === 'number' && d.yesAsk > 0 ? d.yesAsk : null);
  const noBid:  number | null = (livePrice && livePrice.noBid > 0) ? livePrice.noBid
    : (typeof d.noBid  === 'number' && d.noBid  > 0 ? d.noBid  : null);
  const noAsk:  number | null = (livePrice && livePrice.noAsk > 0) ? livePrice.noAsk
    : (typeof d.noAsk  === 'number' && d.noAsk  > 0 ? d.noAsk  : null);
  const hasPrices = yesBid !== null || yesAsk !== null || noBid !== null || noAsk !== null;

  const hasOrderBook =
    Array.isArray(d.orderbookBids) && d.orderbookBids.length > 0 &&
    Array.isArray(d.orderbookAsks) && d.orderbookAsks.length > 0;

  const rawChange  = typeof d.priceChange === 'number' ? d.priceChange : 0;
  const safeChange = Math.abs(rawChange) <= 99 ? rawChange : 0;
  const priceDir   = d.priceDirection || (safeChange > 0 ? 'up' : safeChange < 0 ? 'down' : 'flat');

  // ── Deep link construction ─────────────────────────────────────────────────

  const evtLower    = isPublicTicker(d.eventTicker)  ? (d.eventTicker as string).toLowerCase()  : '';
  const mktLower    = isPublicTicker(d.ticker)        ? (d.ticker as string).toLowerCase()        : '';
  const seriesLower = isPublicTicker(d.seriesTicker) ? (d.seriesTicker as string).toLowerCase() : '';

  const hasSpecificMarket = evtLower || mktLower || seriesLower;
  const tradeBase = evtLower && mktLower
    ? `https://kalshi.com/markets/${evtLower}/${mktLower}`
    : seriesLower
    ? `https://kalshi.com/markets/${seriesLower}`
    : evtLower
    ? `https://kalshi.com/markets/${evtLower}`
    : `https://kalshi.com/markets`;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden',
        'transition-all duration-300',
        isHero
          ? 'shadow-[0_0_56px_#00d15d08]'
          : 'hover:shadow-[0_8px_40px_#00000060] hover:-translate-y-px',
      )}
      style={{
        backgroundColor: '#070a10',
        border: `1px solid ${isHero ? '#1a2236' : '#0f1624'}`,
        borderTopColor: accentColor,
        borderTopWidth: '2px',
      }}
    >

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: '1px solid #0b0f1a' }}>

        {/* Breadcrumb + badges */}
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Category icon pill */}
            <div
              className="flex items-center justify-center w-5 h-5 rounded-md shrink-0"
              style={{ backgroundColor: accentColor + '16', border: `1px solid ${accentColor}2e` }}
            >
              <CategoryIcon label={d.iconLabel} size={11} style={{ color: accentColor }} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.14em] shrink-0"
                  style={{ color: 'oklch(0.28 0.025 260)' }}>Kalshi</span>
            <span className="text-[oklch(0.16_0.01_280)] text-[9px] shrink-0">/</span>
            <span className="text-[9px] font-bold truncate" style={{ color: accentColor + 'cc' }}>
              {marketCat}
            </span>
            {d.isHot && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0 text-orange-400 bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-2.5 h-2.5" /> Hot
              </span>
            )}
          </div>

          {/* Live / Closed badge — shows WS indicator when real-time data is streaming */}
          {isActive ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
                 style={{ backgroundColor: YES_COLOR + '0d', border: `1px solid ${livePrice ? YES_COLOR + '55' : YES_COLOR + '22'}` }}>
              <span className={cn('w-1.5 h-1.5 rounded-full', livePrice ? 'animate-pulse' : '')}
                    style={{ backgroundColor: YES_COLOR }} />
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: YES_COLOR }}>
                {livePrice ? 'WS Live' : 'Live'}
              </span>
            </div>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'oklch(0.10 0.01 280)', border: '1px solid oklch(0.15 0.01 280)', color: 'oklch(0.28 0.01 280)' }}>
              Closed
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className={cn('font-bold text-white leading-snug', isHero ? 'text-[15px]' : 'text-[13px]')}
          title={title}
        >
          {shortenTitle(title)}
        </h3>

        {/* Subtitle */}
        {d.subtitle && d.subtitle !== title && d.subtitle.length > 0 && (
          <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed"
             style={{ color: 'oklch(0.36 0.01 280)' }}>
            {d.subtitle}
          </p>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className={cn('px-4 pb-4 space-y-3.5', isHero ? 'pt-4' : 'pt-3.5')}>

        {/* Signal banner */}
        <SignalBanner
          recommendation={d.recommendation}
          edgeScore={typeof d.edgeScore === 'number' ? d.edgeScore : undefined}
        />

        {/* Probability hero */}
        <ProbabilityHero
          yesPct={yesPct}
          lastPrice={typeof d.lastPrice === 'number' ? d.lastPrice : undefined}
          priceDir={priceDir}
          priceChange={safeChange}
          trades={trades}
          isHero={isHero}
          animated={animated}
        />

        <Divider />

        {/* Order book depth (when available — active markets only) */}
        {isActive && hasOrderBook && (
          <OrderBookMini bids={d.orderbookBids} asks={d.orderbookAsks} />
        )}

        {/* Buy price chips (when no order book — active markets only) */}
        {isActive && hasPrices && !hasOrderBook && (
          <div className={cn(
            'rounded-xl transition-colors duration-700',
            priceFlash ? 'bg-emerald-500/8' : 'bg-transparent',
          )}>
            <PriceChips
              yesBid={yesBid} yesAsk={yesAsk}
              noBid={noBid}   noAsk={noAsk}
              spread={typeof d.spread === 'number' ? d.spread : undefined}
            />
          </div>
        )}

        {/* Market stats */}
        <StatsRow
          volume24hRaw={d.volume24hRaw}
          volumeRaw={d.volumeRaw}
          openInterestRaw={d.openInterestRaw}
          volumeTier={d.volumeTier}
        />

        {/* Time remaining */}
        <TimeBar closeTimeIso={d.closeTimeIso} />

        {/* Related markets link */}
        {(d.seriesTicker || d.eventTicker) && d.seriesTicker !== d.ticker && (
          <RelatedMarketsLink seriesTicker={d.seriesTicker} eventTicker={d.eventTicker} />
        )}

        <Divider />

        {/* ── CTAs ──────────────────────────────────────────────────────────── */}
        <div className="space-y-2">

          {/* AI Analysis */}
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="group/btn flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[11px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2"
              style={{
                backgroundColor: 'oklch(0.11 0.018 260)',
                border: '1px solid oklch(0.17 0.022 260)',
                color: 'oklch(0.48 0.015 260)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = `${YES_COLOR}40`; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'oklch(0.17 0.022 260)'; }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'oklch(0.15 0.022 260)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = 'oklch(0.22 0.028 260)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'oklch(0.11 0.018 260)';
                e.currentTarget.style.color = 'oklch(0.48 0.015 260)';
                e.currentTarget.style.borderColor = 'oklch(0.17 0.022 260)';
              }}
              aria-label={`AI analysis for ${title}`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              AI Analysis
              <ChevronRight className="w-3.5 h-3.5 opacity-60 transition-transform duration-150 group-hover/btn:translate-x-0.5" />
            </button>
          )}

          {/* YES / NO trade buttons — only for active (open) markets */}
          {isActive && hasSpecificMarket && (
            <div className="grid grid-cols-2 gap-2">
              {/* YES */}
              <a
                href={tradeBase}
                target="_blank"
                rel="noopener noreferrer"
                className="group/yes flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-black tracking-wide transition-all duration-150"
                style={{
                  color: YES_COLOR,
                  backgroundColor: YES_COLOR + '12',
                  border: `1px solid ${YES_COLOR}28`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = YES_COLOR + '24';
                  e.currentTarget.style.borderColor = YES_COLOR + '50';
                  e.currentTarget.style.boxShadow = `0 4px 16px ${YES_COLOR}18`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = YES_COLOR + '12';
                  e.currentTarget.style.borderColor = YES_COLOR + '28';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Buy YES
                <ExternalLink className="w-3 h-3 opacity-50 transition-opacity duration-150 group-hover/yes:opacity-90" />
              </a>

              {/* NO */}
              <a
                href={tradeBase}
                target="_blank"
                rel="noopener noreferrer"
                className="group/no flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-black tracking-wide transition-all duration-150"
                style={{
                  color: NO_COLOR,
                  backgroundColor: NO_COLOR + '0e',
                  border: `1px solid ${NO_COLOR}25`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = NO_COLOR + '20';
                  e.currentTarget.style.borderColor = NO_COLOR + '48';
                  e.currentTarget.style.boxShadow = `0 4px 16px ${NO_COLOR}14`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = NO_COLOR + '0e';
                  e.currentTarget.style.borderColor = NO_COLOR + '25';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Buy NO
                <ExternalLink className="w-3 h-3 opacity-50 transition-opacity duration-150 group-hover/no:opacity-90" />
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});
