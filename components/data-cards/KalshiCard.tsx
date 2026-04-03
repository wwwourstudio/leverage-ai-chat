'use client';

import React, { memo, useState, useEffect, useCallback, useId, useRef } from 'react';
import {
  TrendingUp, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock,
  Bitcoin, ArrowUp, ArrowDown, ExternalLink,
  Flame, BarChart3, ChevronRight, Layers,
  Activity, Zap, TrendingDown, Bookmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtVol } from '@/lib/utils';
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

type RecClass = 'strong_yes' | 'lean_yes' | 'strong_no' | 'lean_no' | 'efficient' | 'unknown';

function classifyRecommendation(rec?: string): RecClass {
  if (!rec) return 'unknown';
  const s = rec.toLowerCase();
  if (s.includes('strong yes') || s.includes('strong buy yes')) return 'strong_yes';
  if (s.includes('lean yes')   || s.includes('slight yes'))     return 'lean_yes';
  if (s.includes('strong no')  || s.includes('strong buy no'))  return 'strong_no';
  if (s.includes('lean no')    || s.includes('slight no'))      return 'lean_no';
  if (s.includes('efficient')  || s.includes('50/50'))          return 'efficient';
  return 'unknown';
}

const REC_CONFIG: Record<RecClass, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  strong_yes: { icon: <Zap className="w-3 h-3 shrink-0" />,         color: YES_COLOR,       bg: YES_COLOR + '14', border: YES_COLOR + '35' },
  lean_yes:   { icon: <TrendingUp className="w-3 h-3 shrink-0" />,  color: YES_COLOR + 'cc', bg: YES_COLOR + '0a', border: YES_COLOR + '25' },
  strong_no:  { icon: <Zap className="w-3 h-3 shrink-0" />,         color: NO_COLOR,        bg: NO_COLOR  + '14', border: NO_COLOR  + '35' },
  lean_no:    { icon: <TrendingDown className="w-3 h-3 shrink-0" />, color: NO_COLOR + 'cc', bg: NO_COLOR  + '0a', border: NO_COLOR  + '25' },
  efficient:  { icon: <Activity className="w-3 h-3 shrink-0" />,    color: '#6366f1cc',     bg: '#6366f10e',      border: '#6366f130'       },
  unknown:    { icon: <Activity className="w-3 h-3 shrink-0" />,    color: '#6366f1cc',     bg: '#6366f10e',      border: '#6366f130'       },
};

function SignalBanner({ recommendation, edgeScore }: { recommendation?: string; edgeScore?: number }) {
  if (!recommendation) return null;
  const cls    = classifyRecommendation(recommendation);
  const config = REC_CONFIG[cls];
  const showEdge = typeof edgeScore === 'number' && edgeScore > 0 && cls !== 'efficient';

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold"
      style={{ color: config.color, backgroundColor: config.bg, border: `1px solid ${config.border}` }}
    >
      {config.icon}
      <span className="flex-1 leading-snug">{recommendation}</span>
      {showEdge && (
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

        {/* Center: donut gauge */}
        <ProbabilityDonut yesPct={yesPct} size={isHero ? 72 : 60} />

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

      {/* Sparkline moved to Trade tab */}

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

// ── Probability Donut Gauge ────────────────────────────────────────────────────

function ProbabilityDonut({ yesPct, size = 72 }: { yesPct: number; size?: number }) {
  const r = (size / 2) - 7;
  const circumference = 2 * Math.PI * r;
  const yesOffset = circumference * (1 - yesPct / 100);
  const cx = size / 2, cy = size / 2;
  const yesLeads = yesPct >= 50;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* NO arc — background ring */}
        <circle cx={cx} cy={cy} r={r}
          stroke={NO_COLOR + '30'} strokeWidth="6" fill="none" />
        {/* YES arc */}
        <circle cx={cx} cy={cy} r={r}
          stroke={yesLeads ? YES_COLOR : YES_COLOR + '55'}
          strokeWidth="6" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={yesOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-black tabular-nums leading-none"
              style={{ color: yesLeads ? YES_COLOR : 'var(--text-muted)' }}>
          {yesPct}
        </span>
        <span className="text-[7px] font-black uppercase tracking-wider"
              style={{ color: YES_COLOR + '70' }}>YES</span>
      </div>
    </div>
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

// ── Watchlist hook ─────────────────────────────────────────────────────────────

const WATCHLIST_KEY = 'leverage_watchlist';
interface WatchlistEntry { name: string; team?: string; position: string; addedAt: string; }

function useKalshiWatchlist(title: string, ticker?: string) {
  const name = title.slice(0, 60);
  const [watched, setWatched] = useState<boolean>(() => {
    try {
      const list: WatchlistEntry[] = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
      return list.some(e => e.name === name);
    } catch { return false; }
  });

  const toggle = useCallback(() => {
    setWatched(prev => {
      const next = !prev;
      try {
        const list: WatchlistEntry[] = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]');
        const updated = next
          ? [...list, { name, position: 'KALSHI', team: ticker, addedAt: new Date().toISOString() }]
          : list.filter(e => e.name !== name);
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: updated.length } }));
      } catch {}
      return next;
    });
  }, [name, ticker]);

  return { watched, toggle };
}

// ── Tab Bar ────────────────────────────────────────────────────────────────────

const KALSHI_TABS = ['Market', 'Depth', 'Trade', 'Watch'] as const;

function KalshiTabBar({ activeTab, onSelect, accentColor }: {
  activeTab: number; onSelect: (i: number) => void; accentColor: string;
}) {
  return (
    <div className="flex overflow-x-auto gap-1 px-4 pt-3 pb-0" style={{ scrollbarWidth: 'none' }}>
      {KALSHI_TABS.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onSelect(i)}
          className={cn(
            'px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border transition-all duration-150',
            activeTab !== i && 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-muted)]',
          )}
          style={activeTab === i ? {
            color: accentColor,
            backgroundColor: accentColor + '18',
            border: `1px solid ${accentColor}35`,
          } : undefined}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ── Tab 0 — Market ─────────────────────────────────────────────────────────────

function TabMarket({
  yesPct, lastPrice, priceDir, priceChange, isHero, animated,
  closeTimeIso, recommendation, edgeScore, priceIsReal, safeChange,
}: {
  yesPct: number; lastPrice?: number; priceDir?: string; priceChange?: number;
  isHero?: boolean; animated: boolean; closeTimeIso?: string; recommendation?: string;
  edgeScore?: number; priceIsReal?: boolean; safeChange: number;
}) {
  return (
    <div className="space-y-3.5 pt-3">
      {priceIsReal && safeChange !== 0 && (
        <PriceMovementChip priceChange={safeChange} priceDir={priceDir ?? 'flat'} />
      )}
      {priceIsReal && (
        <SignalBanner recommendation={recommendation} edgeScore={edgeScore} />
      )}
      {priceIsReal ? (
        <ProbabilityHero
          yesPct={yesPct} lastPrice={lastPrice} priceDir={priceDir}
          priceChange={priceChange} trades={null}
          isHero={isHero} animated={animated}
        />
      ) : (
        <InactivePriceState />
      )}
      <Divider />
      <TimeBar closeTimeIso={closeTimeIso} />
    </div>
  );
}

// ── Tab 1 — Depth ──────────────────────────────────────────────────────────────

function TabDepth({
  bids, asks, yesBid, yesAsk, noBid, noAsk, spread, spreadLabel,
  hasPrices, hasOrderBook, priceFlash,
  volume24hRaw, volumeRaw, openInterestRaw, volumeTier, isActive,
}: {
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  yesBid: number | null; yesAsk: number | null;
  noBid: number | null;  noAsk: number | null;
  spread?: number; spreadLabel?: string;
  hasPrices: boolean; hasOrderBook: boolean; priceFlash: boolean;
  volume24hRaw?: number; volumeRaw?: number; openInterestRaw?: number;
  volumeTier?: string; isActive: boolean;
}) {
  const spreadConf =
    typeof spread !== 'number' ? null :
    spread <= 1 ? { color: YES_COLOR } :
    spread <= 4 ? { color: '#f59e0b' } :
    { color: NO_COLOR };
  const spreadBarPct = typeof spread === 'number' ? Math.min(100, (spread / 10) * 100) : 0;

  return (
    <div className="space-y-3 pt-3">
      {hasOrderBook && (
        <OrderBookMini bids={bids} asks={asks} />
      )}

      {isActive && hasPrices && (
        <div className={cn(
          'rounded-xl transition-colors duration-700',
          priceFlash ? 'bg-emerald-500/8' : 'bg-transparent',
        )}>
          <PriceChips
            yesBid={yesBid} yesAsk={yesAsk}
            noBid={noBid}   noAsk={noAsk}
            spread={spread}
          />
        </div>
      )}

      {typeof spread === 'number' && (
        <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)]">Spread Quality</span>
            {spreadLabel && spreadConf && (
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ color: spreadConf.color, backgroundColor: spreadConf.color + '15', border: `1px solid ${spreadConf.color}28` }}
              >
                {spreadLabel}
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${spreadBarPct}%`, backgroundColor: spreadConf?.color ?? '#6366f1' }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-[var(--text-faint)]">
            <span>Tight (1¢)</span>
            <span>Wide (10¢+)</span>
          </div>
        </div>
      )}

      <StatsRow
        volume24hRaw={volume24hRaw}
        volumeRaw={volumeRaw}
        openInterestRaw={openInterestRaw}
        volumeTier={volumeTier}
      />
    </div>
  );
}

// ── Tab 2 — Trade ──────────────────────────────────────────────────────────────

function TabTrade({
  trades, priceChange, priceDir, lastPrice, volume24h, volumeTier, isHero,
}: {
  trades: Array<{ price: number }> | null;
  priceChange: number; priceDir: string; lastPrice?: number;
  volume24h?: string; volumeTier?: string; isHero?: boolean;
}) {
  const tierColor =
    volumeTier === 'Deep'     ? YES_COLOR  :
    volumeTier === 'Active'   ? '#f59e0b'  :
    volumeTier === 'Moderate' ? '#6366f1'  : 'var(--text-faint)';

  return (
    <div className="space-y-3 pt-3">
      {trades && trades.length >= 2 ? (
        <div className="w-full rounded-xl overflow-hidden bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 pt-2 pb-1.5">
          <Sparkline trades={trades} fullWidth height={isHero ? 96 : 80} />
          <div className="flex items-center justify-between mt-1 px-1">
            <span className="text-[8px] font-semibold text-[var(--text-faint)]">Entry price history</span>
            <span className="text-[8px] font-semibold text-[var(--text-faint)]">24h</span>
          </div>
        </div>
      ) : (
        <div className="w-full rounded-xl py-5 flex flex-col items-center gap-2 text-center bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
          <Activity className="w-5 h-5 text-[var(--text-faint)]" />
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">No price history</span>
          <span className="text-[10px] text-[var(--text-faint)]">Market has not traded yet</span>
        </div>
      )}

      {priceChange !== 0 && (
        <PriceMovementChip priceChange={priceChange} priceDir={priceDir} />
      )}

      {lastPrice != null && lastPrice > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
          <span className="text-[10px] font-semibold text-[var(--text-faint)]">Last trade</span>
          <div className="flex items-center gap-1.5">
            {priceDir === 'up'
              ? <ArrowUp className="w-3 h-3" style={{ color: YES_COLOR }} />
              : priceDir === 'down'
              ? <ArrowDown className="w-3 h-3" style={{ color: NO_COLOR }} />
              : null}
            <span className="text-[12px] font-black tabular-nums text-foreground">{lastPrice}¢</span>
          </div>
        </div>
      )}

      {(volume24h || volumeTier) && (
        <div className="grid grid-cols-2 gap-2">
          {volume24h && (
            <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">24h Volume</span>
              <span className="text-[13px] font-black tabular-nums text-foreground/80">{volume24h}</span>
            </div>
          )}
          {volumeTier && (
            <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-3 py-2.5">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-faint)]">Tier</span>
              <span className="text-[13px] font-black" style={{ color: tierColor }}>{volumeTier}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 3 — Watch ──────────────────────────────────────────────────────────────

function TabWatch({
  title, ticker, seriesTicker, eventTicker, closeTimeIso, tradeBase,
  accentColor, watched, toggleWatch,
}: {
  title: string; ticker?: string; seriesTicker?: string; eventTicker?: string;
  closeTimeIso?: string; tradeBase: string; accentColor: string;
  watched: boolean; toggleWatch: () => void;
}) {
  return (
    <div className="space-y-3 pt-3">
      {/* Bookmark toggle */}
      <button
        onClick={toggleWatch}
        className={cn(
          'flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[12px] font-black tracking-wide transition-all duration-150',
          !watched && 'bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-foreground',
        )}
        style={watched ? {
          color: accentColor,
          backgroundColor: accentColor + '18',
          border: `1px solid ${accentColor}35`,
        } : undefined}
      >
        <Bookmark className={cn('w-4 h-4', watched && 'fill-current')} />
        {watched ? 'Watching this market' : 'Watch this market'}
      </button>

      {/* Ticker deep link */}
      {ticker && (
        <a
          href={tradeBase}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-colors duration-150 group/ticker"
        >
          <span className="font-mono text-[11px] text-[var(--text-muted)] group-hover/ticker:text-foreground transition-colors">{ticker}</span>
          <ExternalLink className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover/ticker:text-[var(--text-muted)]" />
        </a>
      )}

      {/* Expiry */}
      <div className="px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] space-y-2">
        <TimeBar closeTimeIso={closeTimeIso} />
        {closeTimeIso && (
          <p className="text-[10px] text-[var(--text-faint)]">
            {new Date(closeTimeIso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      <Divider />
      <RelatedMarketsLink seriesTicker={seriesTicker} eventTicker={eventTicker} />

      {/* Quick trade link */}
      <a
        href={tradeBase}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground hover:border-[var(--border-hover)] transition-all duration-150"
      >
        <Globe className="w-3.5 h-3.5" />
        Open on Kalshi
        <ExternalLink className="w-3 h-3 opacity-60" />
      </a>
    </div>
  );
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

  const [activeTab, setActiveTab] = useState(0);

  const isActive    = status === 'active' || status === 'open' || status === 'live';
  const marketCat   = (d.subcategory || subcategory || category || 'Prediction').toUpperCase();
  const accentColor = getCategoryAccent(d.iconLabel);
  const headerGrad  = getCategoryHeaderGrad(d.iconLabel);

  const { watched, toggle: toggleWatch } = useKalshiWatchlist(title, d.ticker as string | undefined);

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

  // ── Unavailable state — renders before the full card when Kalshi API is down ──
  if (d.status === 'API_UNAVAILABLE' || d.ticker === 'UNAVAILABLE') {
    return (
      <article className="group relative w-full rounded-2xl overflow-hidden bg-background border border-[var(--border-subtle)] transition-all duration-300">
        <div className="px-4 pt-3.5 pb-3 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex items-center justify-center w-4 h-4 rounded shrink-0 bg-indigo-500/20">
              <TrendingUp className="w-2.5 h-2.5 text-indigo-400" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Kalshi</span>
            <span className="text-white/30">·</span>
            <span className="text-[9px] text-white/50">Prediction Markets</span>
          </div>
          <h3 className="font-black text-white text-sm leading-snug pr-4">{title}</h3>
        </div>
        <div className="px-4 py-5 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[var(--text-faint)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-muted)]">
              {d.description || 'Prediction market data is temporarily unavailable.'}
            </p>
            {d.suggestion && (
              <p className="text-xs text-[var(--text-faint)] mt-1">{d.suggestion}</p>
            )}
          </div>
          <a
            href="https://kalshi.com/markets"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground hover:border-[var(--border-hover)] transition-all duration-150"
          >
            <Globe className="w-3.5 h-3.5" />
            Browse Kalshi Markets
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </article>
    );
  }

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

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <KalshiTabBar activeTab={activeTab} onSelect={setActiveTab} accentColor={accentColor} />

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className={cn('px-4 pb-4', isHero ? 'pt-3' : 'pt-2.5')}>

        {/* Tab content */}
        {activeTab === 0 && (
          <TabMarket
            yesPct={yesPct}
            lastPrice={typeof d.lastPrice === 'number' ? d.lastPrice : undefined}
            priceDir={priceDir}
            priceChange={safeChange}
            isHero={isHero}
            animated={animated}
            closeTimeIso={d.closeTimeIso as string | undefined}
            recommendation={d.recommendation as string | undefined}
            edgeScore={typeof d.edgeScore === 'number' ? d.edgeScore : undefined}
            priceIsReal={!!d.priceIsReal}
            safeChange={safeChange}
          />
        )}
        {activeTab === 1 && (
          <TabDepth
            bids={Array.isArray(d.orderbookBids) ? d.orderbookBids as Array<{ price: number; quantity: number }> : []}
            asks={Array.isArray(d.orderbookAsks) ? d.orderbookAsks as Array<{ price: number; quantity: number }> : []}
            yesBid={yesBid} yesAsk={yesAsk}
            noBid={noBid}   noAsk={noAsk}
            spread={typeof d.spread === 'number' ? d.spread : undefined}
            spreadLabel={typeof d.spreadLabel === 'string' ? d.spreadLabel : undefined}
            hasPrices={hasPrices}
            hasOrderBook={hasOrderBook}
            priceFlash={priceFlash}
            volume24hRaw={typeof d.volume24hRaw === 'number' ? d.volume24hRaw : undefined}
            volumeRaw={typeof d.volumeRaw === 'number' ? d.volumeRaw : undefined}
            openInterestRaw={typeof d.openInterestRaw === 'number' ? d.openInterestRaw : undefined}
            volumeTier={typeof d.volumeTier === 'string' ? d.volumeTier : undefined}
            isActive={isActive}
          />
        )}
        {activeTab === 2 && (
          <TabTrade
            trades={trades}
            priceChange={safeChange}
            priceDir={priceDir}
            lastPrice={typeof d.lastPrice === 'number' ? d.lastPrice : undefined}
            volume24h={typeof d.volume24h === 'string' ? d.volume24h : undefined}
            volumeTier={typeof d.volumeTier === 'string' ? d.volumeTier : undefined}
            isHero={isHero}
          />
        )}
        {activeTab === 3 && (
          <TabWatch
            title={title}
            ticker={typeof d.ticker === 'string' ? d.ticker : undefined}
            seriesTicker={typeof d.seriesTicker === 'string' ? d.seriesTicker : undefined}
            eventTicker={typeof d.eventTicker === 'string' ? d.eventTicker : undefined}
            closeTimeIso={typeof d.closeTimeIso === 'string' ? d.closeTimeIso : undefined}
            tradeBase={tradeBase}
            accentColor={accentColor}
            watched={watched}
            toggleWatch={toggleWatch}
          />
        )}

        <Divider />

        {/* ── CTAs — always visible ──────────────────────────────────────────── */}
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
