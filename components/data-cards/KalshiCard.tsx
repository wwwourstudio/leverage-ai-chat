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

const CATEGORY_HEADER_GRAD: Record<string, string> = {
  election:      'from-blue-500/25 via-blue-500/10 to-transparent',
  politics:      'from-blue-500/25 via-blue-500/10 to-transparent',
  sports:        'from-emerald-500/25 via-emerald-500/10 to-transparent',
  weather:       'from-cyan-400/25 via-cyan-400/10 to-transparent',
  finance:       'from-amber-500/25 via-amber-500/10 to-transparent',
  crypto:        'from-violet-500/25 via-violet-500/10 to-transparent',
  tech:          'from-violet-600/25 via-violet-600/10 to-transparent',
  entertainment: 'from-pink-500/25 via-pink-500/10 to-transparent',
  market:        'from-indigo-500/25 via-indigo-500/10 to-transparent',
};

function getCategoryHeaderGrad(label?: string): string {
  return CATEGORY_HEADER_GRAD[(label || '').toLowerCase()] ?? 'from-indigo-500/25 via-indigo-500/10 to-transparent';
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
  trades, width = 200, height = 48, fullWidth = false,
}: { trades: Array<{ price: number }>; width?: number; height?: number; fullWidth?: boolean }) {
  const uid = useId();
  if (trades.length < 2) return null;
  const prices = trades.map(t => t.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 2;
  const pad = 3, innerH = height - pad * 2;
  const w = width;
  const pts = prices.map((p, i) => [
    (i / (prices.length - 1)) * w,
    pad + innerH - ((p - min) / range) * innerH,
  ] as [number, number]);
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L ${w},${height} L 0,${height} Z`;
  const isUp  = prices[prices.length - 1] >= prices[0];
  const color = isUp ? YES_COLOR : NO_COLOR;
  const gid   = `spark-${uid.replace(/:/g, '')}`;
  // 50¢ midline Y position
  const midY = range > 0 ? pad + innerH - ((50 - min) / range) * innerH : pad + innerH / 2;
  const showMidLine = midY > pad && midY < height - pad;
  return (
    <svg
      width={fullWidth ? '100%' : w}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* 50¢ midpoint reference line */}
      {showMidLine && (
        <line
          x1="0" y1={midY} x2={w} y2={midY}
          stroke="currentColor" strokeWidth="0.6"
          strokeDasharray="4,4" opacity="0.18"
        />
      )}
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]}
              r="3" fill={color} />
    </svg>
  );
}

// ── Inactive Price State ───────────────────────────────────────────────────────

function InactivePriceState() {
  return (
    <div className="w-full rounded-xl py-5 flex flex-col items-center gap-2 text-center bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
      <Activity className="w-5 h-5 text-[var(--text-faint)]" />
      <span className="text-[11px] font-semibold text-[var(--text-muted)]">
        Awaiting First Trade
      </span>
      <span className="text-[10px] leading-relaxed max-w-[200px] text-[var(--text-faint)]">
        No bids or asks placed yet. Price will discover near 50¢ once trading opens.
      </span>
    </div>
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
      {/* YES / NO price row — no sparkline in the middle */}
      <div className="flex items-end justify-between gap-3">

        {/* YES block */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.14em]"
                style={{ color: YES_COLOR + '99' }}>Yes</span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn('tabular-nums font-black leading-none tracking-tight',
                isHero ? 'text-[44px]' : 'text-[32px]')}
              style={{ color: yesLeads ? YES_COLOR : 'var(--text-muted)' }}
            >
              {yesPct}
            </span>
            <span className="text-sm font-bold mb-0.5"
                  style={{ color: yesLeads ? YES_COLOR + 'aa' : 'var(--text-faint)' }}>¢</span>
          </div>
          <span className="text-[9px] font-medium tabular-nums"
                style={{ color: yesLeads ? YES_COLOR + '70' : 'var(--text-faint)' }}>
            {yesPct}% implied
          </span>
          {lastPrice != null && lastPrice > 0 && lastPrice !== yesPct && (
            <span className="text-[9px] text-[var(--text-faint)] tabular-nums">
              last {lastPrice}¢
            </span>
          )}
        </div>

        {/* Center: efficiency tag */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          {Math.abs(yesPct - 50) <= 5 && (
            <span className="text-[8px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: '#6366f1', backgroundColor: '#6366f112', border: '1px solid #6366f128' }}>
              near 50/50
            </span>
          )}
        </div>

        {/* NO block */}
        <div className="flex flex-col items-end gap-0.5 min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.14em]"
                style={{ color: NO_COLOR + '99' }}>No</span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn('tabular-nums font-black leading-none tracking-tight',
                isHero ? 'text-[44px]' : 'text-[32px]')}
              style={{ color: !yesLeads ? NO_COLOR : 'var(--text-muted)' }}
            >
              {noPct}
            </span>
            <span className="text-sm font-bold mb-0.5"
                  style={{ color: !yesLeads ? NO_COLOR + 'aa' : 'var(--text-faint)' }}>¢</span>
          </div>
          <span className="text-[9px] font-medium tabular-nums"
                style={{ color: !yesLeads ? NO_COLOR + '70' : 'var(--text-faint)' }}>
            {noPct}% implied
          </span>
        </div>
      </div>

      {/* Full-width sparkline row */}
      {trades && trades.length >= 2 ? (
        <div className="w-full rounded-xl overflow-hidden bg-[var(--bg-overlay)] px-2 pt-2 pb-1">
          <Sparkline trades={trades} fullWidth height={48} />
          <div className="flex items-center justify-between mt-1 px-1">
            <span className="text-[8px] font-semibold text-[var(--text-faint)]">Price history</span>
            <span className="text-[8px] font-semibold text-[var(--text-faint)]">24h</span>
          </div>
        </div>
      ) : null}

      {/* Probability bar */}
      <div className="space-y-1">
        <div className="relative h-2.5 rounded-full overflow-hidden bg-[var(--bg-surface)]">
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
          <div className="absolute left-1/2 -translate-x-px top-0 h-full w-0.5 bg-[var(--bg-overlay)]" />
        </div>
        <div className="flex justify-between text-[8px] font-semibold">
          <span style={{ color: YES_COLOR + '66' }}>0¢</span>
          <span className="text-[var(--text-faint)]">50¢</span>
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
    <div className="rounded-xl overflow-hidden bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
      <div className="grid grid-cols-2">
        {/* Bids (YES) */}
        <div className="p-2.5 space-y-1 border-r border-r-[var(--border-subtle)]">
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: YES_COLOR + '88' }}>Bids</span>
          {top3Bids.map((row, i) => (
            <div key={i} className="relative flex items-center justify-between text-[10px] tabular-nums rounded overflow-hidden px-1.5 py-0.5">
              <div className="absolute inset-0 rounded"
                   style={{ backgroundColor: YES_COLOR + '0f', width: `${(row.quantity / maxQty) * 100}%`, transition: 'width 600ms' }} />
              <span className="relative font-bold z-10" style={{ color: YES_COLOR + 'cc' }}>{row.price}¢</span>
              <span className="relative text-[9px] z-10 text-[var(--text-muted)]">{row.quantity.toLocaleString()}</span>
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
              <span className="relative text-[9px] z-10 text-[var(--text-muted)]">{row.quantity.toLocaleString()}</span>
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
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Best price to buy</span>
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
    volumeTier === 'Moderate' ? '#6366f1'    : 'var(--text-faint)';

  return (
    <div className="rounded-xl px-3 py-2.5 space-y-2 bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-faint)]">Market Depth</span>
        {volumeTier && (
          <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ color: tierColor, backgroundColor: tierColor + '15', border: `1px solid ${tierColor}28` }}>
            {volumeTier}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">24h Vol</span>
          <span className="text-[12px] font-black tabular-nums text-foreground/80">{vol24h ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Total</span>
          <span className="text-[12px] font-black tabular-nums text-foreground/80">{volAll ?? '—'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Open Int</span>
          <span className="text-[12px] font-black tabular-nums" style={{ color: '#6366f1' }}>{oi ?? '—'}</span>
        </div>
      </div>
      <VolumeBar volume24hRaw={volume24hRaw} volumeRaw={volumeRaw} />
    </div>
  );
}

// ── Time Bar ───────────────────────────────────────────────────────────────────

function TimeBar({ closeTimeIso }: { closeTimeIso?: string | null }) {
  const { label, pctElapsed, urgency } = timeRemaining(closeTimeIso);
  const closeDateStr = closeTimeIso
    ? new Date(closeTimeIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  if (urgency === 'closed') {
    return (
      <div className="flex items-center justify-between text-[9px]">
        <span className="font-black uppercase tracking-widest text-[var(--text-faint)]">Settled</span>
        {closeDateStr && <span className="text-[var(--text-faint)]">{closeDateStr}</span>}
      </div>
    );
  }

  const barColor  =
    urgency === 'critical' ? NO_COLOR  :
    urgency === 'urgent'   ? '#f97316' :
    urgency === 'soon'     ? '#f59e0b' : '#6366f1';
  const textStyle: React.CSSProperties =
    urgency === 'critical' ? { color: NO_COLOR }   :
    urgency === 'urgent'   ? { color: '#fb923c' }  :
    urgency === 'soon'     ? { color: '#fbbf24' }  :
    {};

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Closes in</span>
        <div className="flex items-center gap-1.5">
          <span className={cn('flex items-center gap-1 text-[10px] font-bold', !textStyle.color && 'text-[var(--text-muted)]')} style={textStyle}>
            <Clock className={cn('w-3 h-3', urgency === 'critical' && 'animate-pulse')} />
            {label}
          </span>
          {closeDateStr && (
            <span className="text-[9px] text-[var(--text-faint)]">· {closeDateStr}</span>
          )}
        </div>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden bg-[var(--bg-surface)]">
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
      className="flex items-center gap-1.5 text-[10px] font-medium transition-colors duration-150 group/rel text-[var(--text-muted)] hover:text-foreground"
    >
      <Layers className="w-3 h-3 shrink-0" />
      <span className="group-hover/rel:underline">More in {linkTarget}</span>
      <ChevronRight className="w-3 h-3 opacity-60" />
    </a>
  );
}

// ── Price Movement Chip ────────────────────────────────────────────────────────

function PriceMovementChip({ priceChange, priceDir }: { priceChange: number; priceDir: string }) {
  if (!priceChange || Math.abs(priceChange) < 1 || priceDir === 'flat') return null;
  const isUp = priceDir === 'up';
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full w-fit text-[11px] font-black"
      style={{
        color: isUp ? YES_COLOR : NO_COLOR,
        backgroundColor: (isUp ? YES_COLOR : NO_COLOR) + '15',
        border: `1px solid ${isUp ? YES_COLOR : NO_COLOR}30`,
      }}
    >
      {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {isUp ? '+' : ''}{priceChange}¢ today
    </div>
  );
}

// ── Volume Bar ─────────────────────────────────────────────────────────────────

function VolumeBar({ volume24hRaw, volumeRaw }: { volume24hRaw?: number; volumeRaw?: number }) {
  if (!volume24hRaw || !volumeRaw || volumeRaw <= 0) return null;
  const pct = Math.min(100, Math.round((volume24hRaw / volumeRaw) * 100));
  return (
    <div className="space-y-1 pt-1">
      <div className="flex justify-between text-[8px] font-semibold text-[var(--text-faint)]">
        <span>24h Activity</span>
        <span>{pct}% of total vol</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden bg-[var(--bg-surface)]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: pct > 30 ? YES_COLOR + '99' : '#6366f188',
          }}
        />
      </div>
    </div>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="h-px bg-[var(--border-subtle)]" />;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const KalshiCard = memo(function KalshiCard({
  title, category, subcategory, data: d, status, onAnalyze, isHero,
}: KalshiCardProps) {
  const [animated, setAnimated] = useState(false);
  // Seed from synthetic trades bundled in card data; real API trades override when fetched
  const [trades, setTrades] = useState<Array<{ price: number }> | null>(
    Array.isArray(d.trades) && (d.trades as Array<{ price: number }>).length >= 2
      ? (d.trades as Array<{ price: number }>)
      : null
  );

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

  // Fetch trade sparkline (staggered to avoid rate-limit spikes on multi-card grids).
  // Skip fetch when priceIsReal is false — inactive markets have no trades to show.
  const fetchTrades = useCallback(() => {
    if (!d.ticker || !d.priceIsReal) return;
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
  const headerGrad  = getCategoryHeaderGrad(d.iconLabel);

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
        'group relative w-full rounded-2xl overflow-hidden bg-background border transition-all duration-300',
        isHero
          ? 'border-[var(--border-hover)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.12)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.08)]',
      )}
      style={{ borderTopColor: accentColor, borderTopWidth: '2px' }}
    >

      {/* ── Gradient header ─────────────────────────────────────────────────── */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', headerGrad)}>

        {/* Status badge — top right */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {!isActive ? (
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
              Closed
            </span>
          ) : !d.priceIsReal ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <span className="text-[8px] font-black uppercase tracking-widest text-white/50">
                Pending
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                 style={{ backgroundColor: YES_COLOR + '0d', border: `1px solid ${livePrice ? YES_COLOR + '55' : YES_COLOR + '22'}` }}>
              <span className={cn('w-1.5 h-1.5 rounded-full', livePrice ? 'animate-pulse' : '')}
                    style={{ backgroundColor: YES_COLOR }} />
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: YES_COLOR }}>
                {livePrice ? 'WS Live' : 'Live'}
              </span>
            </div>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div
            className="flex items-center justify-center w-4 h-4 rounded shrink-0"
            style={{ backgroundColor: accentColor + '28' }}
          >
            <CategoryIcon label={d.iconLabel} size={10} style={{ color: accentColor }} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Kalshi</span>
          <span className="text-white/30">·</span>
          <span className="text-[9px] text-white/50 truncate">{marketCat}</span>
          {d.isHot && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0 text-orange-400 bg-orange-500/10 border border-orange-500/20">
              <Flame className="w-2.5 h-2.5" /> Hot
            </span>
          )}
        </div>

        {/* Title — full exact text from Kalshi API */}
        <h3
          className={cn('font-black text-white leading-snug pr-20', isHero ? 'text-[15px]' : 'text-sm', 'line-clamp-4')}
          title={title}
        >
          {title}
        </h3>

        {/* Subtitle */}
        {d.subtitle && d.subtitle !== title && d.subtitle.length > 0 && (
          <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed text-white/50">
            {d.subtitle}
          </p>
        )}

        {/* Ticker badge — exact Kalshi market ID */}
        {d.ticker && (
          <span className="inline-block mt-1.5 font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/30 select-all tracking-wider">
            {d.ticker}
          </span>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className={cn('px-4 pb-4 space-y-3.5', isHero ? 'pt-4' : 'pt-3.5')}>

        {/* Price movement chip — prominent Δ indicator */}
        {d.priceIsReal && safeChange !== 0 && (
          <PriceMovementChip priceChange={safeChange} priceDir={priceDir} />
        )}

        {/* Signal banner — only shown when real price data exists */}
        {d.priceIsReal && (
          <SignalBanner
            recommendation={d.recommendation}
            edgeScore={typeof d.edgeScore === 'number' ? d.edgeScore : undefined}
          />
        )}

        {/* Probability hero for active markets; inactive state for dormant markets */}
        {d.priceIsReal ? (
          <ProbabilityHero
            yesPct={yesPct}
            lastPrice={typeof d.lastPrice === 'number' ? d.lastPrice : undefined}
            priceDir={priceDir}
            priceChange={safeChange}
            trades={trades}
            isHero={isHero}
            animated={animated}
          />
        ) : (
          <InactivePriceState />
        )}

        <Divider />

        {/* Order book depth — hero/full-size only */}
        {isHero && isActive && hasOrderBook && (
          <OrderBookMini bids={d.orderbookBids} asks={d.orderbookAsks} />
        )}

        {/* Buy price chips — hero/full-size only */}
        {isHero && isActive && hasPrices && !hasOrderBook && (
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

        {/* Market stats — hero/full-size only */}
        {isHero && (
          <StatsRow
            volume24hRaw={d.volume24hRaw}
            volumeRaw={d.volumeRaw}
            openInterestRaw={d.openInterestRaw}
            volumeTier={d.volumeTier}
          />
        )}

        {/* Time remaining — always shown */}
        <TimeBar closeTimeIso={d.closeTimeIso} />

        {/* Related markets link — hero/full-size only */}
        {isHero && (d.seriesTicker || d.eventTicker) && d.seriesTicker !== d.ticker && (
          <RelatedMarketsLink seriesTicker={d.seriesTicker} eventTicker={d.eventTicker} />
        )}

        <Divider />

        {/* ── CTAs ──────────────────────────────────────────────────────────── */}
        <div className="space-y-2">

          {/* Primary: Place Bet on Kalshi */}
          {hasSpecificMarket && (
            <a
              href={tradeBase}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-black tracking-wide transition-all duration-150"
              style={{
                background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}12)`,
                border: `1px solid ${accentColor}40`,
                color: accentColor,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${accentColor}35, ${accentColor}22)`;
                e.currentTarget.style.boxShadow = `0 4px 20px ${accentColor}20`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${accentColor}22, ${accentColor}12)`;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Globe className="w-4 h-4" />
              Place Bet on Kalshi
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          )}

          {/* YES / NO trade buttons — only for active (open) markets with price data */}
          {isActive && hasSpecificMarket && d.priceIsReal && (
            <div className="grid grid-cols-2 gap-2">
              {/* YES */}
              <a
                href={tradeBase}
                target="_blank"
                rel="noopener noreferrer"
                className="group/yes flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl text-[11px] font-black tracking-wide transition-all duration-150"
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
                <span>Buy YES</span>
                <span className="text-[10px] font-bold opacity-80">{yesPct}¢</span>
              </a>

              {/* NO */}
              <a
                href={tradeBase}
                target="_blank"
                rel="noopener noreferrer"
                className="group/no flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl text-[11px] font-black tracking-wide transition-all duration-150"
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
                <span>Buy NO</span>
                <span className="text-[10px] font-bold opacity-80">{100 - yesPct}¢</span>
              </a>
            </div>
          )}

          {/* AI Analysis */}
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--bg-surface)] hover:border-[var(--border-hover)] transition-all duration-150"
              aria-label={`AI analysis for ${title}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              AI Analysis
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
});
