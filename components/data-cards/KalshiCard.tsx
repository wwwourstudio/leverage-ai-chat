'use client';

import { memo } from 'react';
import {
  TrendingUp, TrendingDown, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock, ChevronRight, Flame,
  BarChart3, ArrowUp, ArrowDown, ExternalLink, Zap,
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

function CategoryIcon({ label, className }: { label?: string; className?: string }) {
  const cls = cn('w-3.5 h-3.5', className);
  switch (label) {
    case 'election':      return <Vote className={cls} />;
    case 'sports':        return <Trophy className={cls} />;
    case 'weather':       return <CloudRain className={cls} />;
    case 'finance':       return <TrendingDown className={cls} />;
    case 'tech':          return <Cpu className={cls} />;
    case 'entertainment': return <Film className={cls} />;
    default:              return <Globe className={cls} />;
  }
}

/** Kalshi-style horizontal probability bar — no SVG arc */
function ProbabilityBar({ yesPct, isHero }: { yesPct: number; isHero?: boolean }) {
  const YES_COLOR = '#00c47c'; // Kalshi teal
  const NO_COLOR  = '#f43f5e'; // Kalshi red

  const yesDisplay = yesPct;
  const noDisplay  = 100 - yesPct;

  // Dominant side
  const yesLeads = yesPct >= 50;

  return (
    <div className="w-full">
      {/* Large probability display — Kalshi style */}
      <div className="flex items-end justify-between mb-3">
        {/* YES side */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: YES_COLOR }}>
            Yes
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn('tabular-nums font-black leading-none', isHero ? 'text-5xl' : 'text-4xl')}
              style={{ color: yesLeads ? YES_COLOR : 'oklch(0.55 0.01 280)' }}
            >
              {yesDisplay}
            </span>
            <span
              className={cn('font-bold', isHero ? 'text-xl' : 'text-base')}
              style={{ color: yesLeads ? YES_COLOR : 'oklch(0.40 0.01 280)' }}
            >
              ¢
            </span>
          </div>
        </div>

        {/* Center divider label */}
        <div className="flex flex-col items-center gap-1 pb-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.35_0.01_280)]">
            Market Probability
          </span>
          <div className="w-px h-4 bg-[oklch(0.22_0.01_280)]" />
        </div>

        {/* NO side */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: NO_COLOR }}>
            No
          </span>
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

      {/* Horizontal probability bar — flat Kalshi style */}
      <div className="relative h-2.5 rounded-full overflow-hidden bg-[oklch(0.14_0.01_280)]">
        {/* YES fill */}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${yesPct}%`, backgroundColor: YES_COLOR, opacity: 0.85 }}
        />
        {/* NO fill */}
        <div
          className="absolute right-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${noDisplay}%`, backgroundColor: NO_COLOR, opacity: 0.6 }}
        />
        {/* Center gap pixel */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-px bg-[oklch(0.08_0.01_280)]" />
      </div>

      {/* Bar labels */}
      <div className="flex justify-between mt-1 text-[9px] font-semibold text-[oklch(0.30_0.01_280)]">
        <span>0¢</span>
        <span>50¢</span>
        <span>100¢</span>
      </div>
    </div>
  );
}

/** Edge signal bar — replaces old "Market Edge" nested box */
function EdgeSignalBar({ edgeScore, isHero }: { edgeScore: number; isHero?: boolean }) {
  const color =
    edgeScore >= 60 ? '#00c47c' :
    edgeScore >= 30 ? '#f59e0b' :
    'oklch(0.55 0.01 280)';

  const label =
    edgeScore >= 70 ? 'Strong Edge' :
    edgeScore >= 50 ? 'Moderate Edge' :
    edgeScore >= 25 ? 'Slight Edge' :
    'Efficient Market';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[oklch(0.40_0.01_280)]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.40_0.01_280)]">
            Edge Signal
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color }}
          >
            {label}
          </span>
          <span className="text-[11px] font-black tabular-nums" style={{ color }}>
            {edgeScore}
          </span>
          <span className="text-[9px] text-[oklch(0.30_0.01_280)]">/100</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[oklch(0.14_0.01_280)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, edgeScore)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/** Best prices section — replaces old "Order Book" nested box */
function BestPrices({
  yesBid, yesAsk, noBid, noAsk, spread, spreadLabel,
}: {
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  spread: number | null;
  spreadLabel?: string;
}) {
  const hasBidAsk =
    (yesBid !== null && yesBid > 0) ||
    (yesAsk !== null && yesAsk > 0) ||
    (noBid !== null && noBid > 0) ||
    (noAsk !== null && noAsk > 0);

  if (!hasBidAsk) return null;

  const spreadColor =
    spread !== null && spread <= 2 ? '#00c47c' :
    spread !== null && spread <= 5 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.40_0.01_280)]">
          Best Prices
        </span>
        {spread !== null && spread > 0 && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ color: spreadColor, backgroundColor: `${spreadColor}18` }}
          >
            {spreadLabel || (spread <= 2 ? 'Tight' : spread <= 5 ? 'Normal' : 'Wide')} spread
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* YES column */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[oklch(0.11_0.012_160)] border border-[oklch(0.20_0.025_160)]">
            <span className="text-[9px] font-bold text-[#00c47c]/70">YES Bid</span>
            <span className="text-xs font-black tabular-nums text-[#00c47c]">
              {yesBid !== null && yesBid > 0 ? `${yesBid}¢` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[oklch(0.11_0.012_160)] border border-[oklch(0.18_0.018_160)]">
            <span className="text-[9px] font-bold text-[#00c47c]/50">YES Ask</span>
            <span className="text-xs font-black tabular-nums text-[#00c47c]/80">
              {yesAsk !== null && yesAsk > 0 ? `${yesAsk}¢` : '—'}
            </span>
          </div>
        </div>
        {/* NO column */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[oklch(0.11_0.012_15)] border border-[oklch(0.20_0.025_15)]">
            <span className="text-[9px] font-bold text-[#f43f5e]/70">NO Bid</span>
            <span className="text-xs font-black tabular-nums text-[#f43f5e]">
              {noBid !== null && noBid > 0 ? `${noBid}¢` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[oklch(0.11_0.012_15)] border border-[oklch(0.18_0.018_15)]">
            <span className="text-[9px] font-bold text-[#f43f5e]/50">NO Ask</span>
            <span className="text-xs font-black tabular-nums text-[#f43f5e]/80">
              {noAsk !== null && noAsk > 0 ? `${noAsk}¢` : '—'}
            </span>
          </div>
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

export const KalshiCard = memo(function KalshiCard({
  title,
  category,
  subcategory,
  data: d,
  status,
  onAnalyze,
  isHero,
}: KalshiCardProps) {
  // yesPct: use explicit null-check so a genuine 0% market is honoured, not coerced to 50.
  // The || 50 pattern treats 0 as falsy and replaces a legitimately resolved market with 50/50.
  const yesPct: number = (() => {
    if (typeof d.yesPct === 'number') return d.yesPct;
    if (typeof d.yesPrice === 'string') {
      const parsed = parseFloat(d.yesPrice);
      return Number.isFinite(parsed) ? parsed : 50;
    }
    return 50;
  })();
  const isActive = status === 'active' || status === 'open' || status === 'live';
  const edgeScore: number = typeof d.edgeScore === 'number' ? d.edgeScore : Math.round(Math.abs(yesPct - 50) * 2);

  const urgency  = urgencyStyles(d.expiresLabel);
  const volStyle = volTierStyles(d.volumeTier);

  const yesBid: number | null = typeof d.yesBid === 'number' ? d.yesBid : null;
  const yesAsk: number | null = typeof d.yesAsk === 'number' ? d.yesAsk : null;
  const noBid:  number | null = typeof d.noBid  === 'number' ? d.noBid  : null;
  const noAsk:  number | null = typeof d.noAsk  === 'number' ? d.noAsk  : null;
  const spread = yesAsk !== null && yesBid !== null ? yesAsk - yesBid : null;

  const rawChange = d.priceChange ?? 0;
  // Guard against corrupted deltas (e.g. full-scale bid value when prevBid was 0 on the server).
  // A real intra-day price move on Kalshi is always ≤99¢, so clamp the display range.
  const safeChange = Math.abs(rawChange) <= 99 ? rawChange : 0;
  const priceDir: 'up' | 'down' | 'flat' =
    d.priceDirection || (safeChange > 0 ? 'up' : safeChange < 0 ? 'down' : 'flat');

  // Subcategory label: prefer normalised category from data
  const marketCategory = d.subcategory || subcategory || category || 'Prediction Market';

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden transition-all duration-300',
        'bg-[#0f0f11] border',
        isHero
          ? 'border-[oklch(0.24_0.02_260)] shadow-[0_0_40px_oklch(0.18_0.04_260/0.20)]'
          : 'border-[oklch(0.17_0.015_280)] hover:border-[oklch(0.26_0.02_280)]',
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-[oklch(0.14_0.012_280)]">
        {/* Top row: breadcrumb + live status + price change */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            {/* Kalshi K logo replacement */}
            <div className="flex items-center justify-center w-5 h-5 rounded bg-[oklch(0.16_0.02_280)] border border-[oklch(0.22_0.02_280)]">
              <CategoryIcon label={d.iconLabel} className="text-[oklch(0.55_0.015_280)]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.38_0.01_280)]">
              KALSHI
            </span>
            <span className="text-[oklch(0.22_0.01_280)] text-[9px]">/</span>
            <span className="text-[9px] font-semibold text-[oklch(0.45_0.01_280)] truncate max-w-[120px]">
              {marketCategory}
            </span>
            {d.isHot && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 text-[8px] font-black text-rose-400 uppercase tracking-wider">
                <Flame className="w-2.5 h-2.5" /> Hot
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Price change delta — only shown when within valid ≤99¢ range */}
            {priceDir !== 'flat' && (
              <span className={cn('flex items-center gap-0.5 text-[10px] font-bold',
                priceDir === 'up' ? 'text-[#00c47c]' : 'text-[#f43f5e]',
              )}>
                {priceDir === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(safeChange)}¢
              </span>
            )}
            {/* Live dot */}
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

        {/* Market title */}
        <h3
          className={cn(
            'font-black text-white leading-snug line-clamp-2',
            isHero ? 'text-base' : 'text-sm',
          )}
          title={title}
        >
          {title}
        </h3>

        {d.subtitle && d.subtitle !== title && (
          <p className="text-[11px] text-[oklch(0.45_0.01_280)] mt-1 line-clamp-1 leading-relaxed">
            {d.subtitle}
          </p>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-4">

        {/* Probability display + bar */}
        <ProbabilityBar yesPct={yesPct} isHero={isHero} />

        {/* Divider */}
        <div className="h-px bg-[oklch(0.13_0.01_280)]" />

        {/* Edge signal */}
        <EdgeSignalBar edgeScore={edgeScore} isHero={isHero} />

        {/* Best prices (bid/ask) — only when data available */}
        {(yesBid !== null || yesAsk !== null || noBid !== null || noAsk !== null) && (
          <>
            <div className="h-px bg-[oklch(0.13_0.01_280)]" />
            <BestPrices
              yesBid={yesBid}
              yesAsk={yesAsk}
              noBid={noBid}
              noAsk={noAsk}
              spread={spread}
              spreadLabel={d.spreadLabel}
            />
          </>
        )}

        {/* ── Stats strip ──────────────────────────────────────────────��─ */}
        <div className="h-px bg-[oklch(0.13_0.01_280)]" />
        <div className="flex flex-wrap items-center gap-2">
          {/* Volume tier badge */}
          {d.volumeTier && (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold', volStyle)}>
              {d.volumeTier === 'Deep' && <Flame className="w-2.5 h-2.5" />}
              {d.volumeTier}
            </span>
          )}

          {/* Volume 24h */}
          {d.volume24h && d.volume24h !== '' ? (
            <span className="text-[10px] text-[oklch(0.45_0.01_280)] font-medium">
              Vol <span className="text-white font-bold">{d.volume24h}</span>
            </span>
          ) : d.volume && d.volume !== '—' ? (
            <span className="text-[10px] text-[oklch(0.45_0.01_280)] font-medium">
              Vol <span className="text-white font-bold">{d.volume}</span>
            </span>
          ) : null}

          {/* Open Interest */}
          {d.openInterest && d.openInterest !== '—' && (
            <span className="text-[10px] text-[oklch(0.45_0.01_280)] font-medium">
              OI <span className="text-[oklch(0.70_0.01_280)] font-bold">{d.openInterest}</span>
            </span>
          )}

          {/* Expiry */}
          {d.expiresLabel && d.expiresLabel !== 'Closed' && (
            <span className={cn('ml-auto flex items-center gap-1 text-[10px] font-semibold', urgency.text)}>
              <Clock className={cn('w-3 h-3', urgency.pulse && 'animate-pulse')} />
              {d.expiresLabel}
            </span>
          )}
        </div>

        {/* ── Recommendation pill ──────────────────────────────────────── */}
        {d.recommendation && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold',
            yesPct >= 60
              ? 'bg-[#00c47c10] border-[#00c47c30] text-[#00c47c]'
              : yesPct <= 40
              ? 'bg-[#f43f5e10] border-[#f43f5e30] text-[#f43f5e]'
              : 'bg-[oklch(0.11_0.012_280)] border-[oklch(0.18_0.015_280)] text-[oklch(0.50_0.01_280)]',
          )}>
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            {d.recommendation}
          </div>
        )}

        {/* ── Footer: ticker + close date ──────────────────────────────── */}
        {(d.ticker || d.closeTime) && (
          <div className="flex items-center justify-between text-[9px] text-[oklch(0.28_0.01_280)] pt-1 border-t border-[oklch(0.12_0.01_280)]">
            {d.ticker && (
              <span className="font-mono font-semibold text-[oklch(0.35_0.01_280)]">{d.ticker}</span>
            )}
            {d.closeTime && d.closeTime !== 'TBD' && (
              <span>Closes {d.closeTime}</span>
            )}
          </div>
        )}

        {/* ── Analyze CTA ──────────────────────────────────────────────── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[oklch(0.13_0.015_280)] border border-[oklch(0.20_0.018_280)] text-xs font-semibold text-[oklch(0.55_0.01_280)] hover:text-white hover:bg-[oklch(0.18_0.018_280)] hover:border-[oklch(0.28_0.022_280)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c47c]/50"
            aria-label={`Analyze ${title}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* ── Kalshi link ──────────────────────────────────────────────── */}
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
