'use client';

import { memo } from 'react';
import {
  TrendingUp, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock, ChevronRight, Flame,
  BarChart3, ArrowUp, ArrowDown, ExternalLink,
  Zap,
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
  // If title has · separators (many-option markets), keep first 2 options + ellipsis
  if (title.includes('·')) {
    const parts = title.split('·').map(p => p.trim());
    const header = parts[0];
    // Check if it's a "Will X win? Header: A · B · C" style
    const colonIdx = header.indexOf(':');
    if (colonIdx > -1) {
      const prefix = header.slice(0, colonIdx + 1).trim();
      const firstOption = header.slice(colonIdx + 1).trim();
      const second = parts[1] ?? '';
      const remaining = parts.length - 2;
      if (remaining > 0) {
        return `${prefix} ${firstOption} · ${second} +${remaining} more`;
      }
      return `${prefix} ${firstOption} · ${second}`;
    }
    // Simple list: keep first 2 + count
    const first = parts[0];
    const second = parts[1] ?? '';
    const remaining = parts.length - 2;
    if (remaining > 0) {
      return `${first} · ${second} +${remaining} more`;
    }
    return `${first} · ${second}`;
  }
  // Plain long title — hard truncate
  return title.slice(0, maxLen - 1) + '\u2026';
}

/** Clean up ticker: hide random hex hashes, show only readable event tickers */
function cleanTicker(ticker: string): string | null {
  if (!ticker) return null;
  // Drop if it looks like a UUID/hex hash (long random string)
  if (/[0-9A-F]{8,}/i.test(ticker) && ticker.length > 20) return null;
  // Drop if all caps + very long (internal Kalshi ID)
  if (ticker.length > 30) return null;
  return ticker;
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
      {/* Percentage display */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: YES_COLOR }}>Yes</span>
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

        {/* VS divider */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-[oklch(0.28_0.01_280)]">vs</span>
          <span className="text-[8px] text-[oklch(0.25_0.01_280)] font-medium">probability</span>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: NO_COLOR }}>No</span>
          <div className="flex items-baseline gap-0.5">
            <span
              className={cn('tabular-nums font-black leading-none', isHero ? 'text-4xl' : 'text-3xl')}
              style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.48 0.01 280)' }}
            >
              {noDisplay}
            </span>
            <span className="text-sm font-bold" style={{ color: !yesLeads ? NO_COLOR : 'oklch(0.35 0.01 280)' }}>¢</span>
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2 rounded-full overflow-hidden bg-[oklch(0.12_0.01_280)]">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${yesPct}%`, backgroundColor: YES_COLOR, opacity: 0.9 }}
        />
        <div
          className="absolute right-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${noDisplay}%`, backgroundColor: NO_COLOR, opacity: 0.65 }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1 text-[8px] font-semibold text-[oklch(0.25_0.01_280)]">
        <span style={{ color: YES_COLOR + 'aa' }}>0¢</span>
        <span>50¢</span>
        <span style={{ color: NO_COLOR + 'aa' }}>100¢</span>
      </div>
    </div>
  );
}

function EdgeBadge({ edgeScore, yesPct, recommendation }: {
  edgeScore: number;
  yesPct: number;
  recommendation?: string;
}) {
  const edgeColor =
    edgeScore >= 60 ? '#00c47c' :
    edgeScore >= 30 ? '#f59e0b' :
    'oklch(0.40 0.01 280)';

  const signalStyle =
    yesPct >= 60 ? { bg: 'bg-[#00c47c10] border-[#00c47c28] text-[#00c47c]' } :
    yesPct <= 40 ? { bg: 'bg-[#f43f5e10] border-[#f43f5e28] text-[#f43f5e]' } :
    { bg: 'bg-[oklch(0.11_0.01_280)] border-[oklch(0.17_0.01_280)] text-[oklch(0.45_0.01_280)]' };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Edge pill */}
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold"
        style={{ color: edgeColor, backgroundColor: `${edgeColor}12`, borderColor: `${edgeColor}28` }}
      >
        <Zap className="w-3 h-3" />
        Edge {edgeScore}
        <span className="text-[8px] opacity-60 font-normal">/100</span>
      </div>

      {recommendation && (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold', signalStyle.bg)}>
          <TrendingUp className="w-2.5 h-2.5" />
          {recommendation.length > 24 ? recommendation.slice(0, 24) + '\u2026' : recommendation}
        </span>
      )}
    </div>
  );
}

/** Best-price row (bid/ask) — compact horizontal layout */
function BestPrices({ yesBid, yesAsk }: { yesBid: number | null; yesAsk: number | null }) {
  const spread = yesBid !== null && yesAsk !== null ? yesAsk - yesBid : null;
  const spreadColor = spread !== null && spread <= 2 ? '#00c47c' : spread !== null && spread <= 5 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.35_0.02_260)]">Prices</span>
      <div className="flex items-center gap-1.5 ml-auto">
        {yesBid !== null && yesBid > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#00c47c10] border border-[#00c47c28] text-[#00c47c] text-[10px] font-black tabular-nums">
            {yesBid}¢ bid
          </span>
        )}
        {yesAsk !== null && yesAsk > 0 && (
          <span className="px-2 py-0.5 rounded bg-[#f43f5e10] border border-[#f43f5e28] text-[#f43f5e] text-[10px] font-black tabular-nums">
            {yesAsk}¢ ask
          </span>
        )}
        {spread !== null && spread > 0 && (
          <span className="text-[9px] font-bold" style={{ color: spreadColor }}>
            {spread}¢ spread
          </span>
        )}
      </div>
    </div>
  );
}

function urgencyStyles(label?: string) {
  if (!label || label === 'Closed') return { text: 'text-[oklch(0.32_0.01_280)]', pulse: false };
  if (label === '<24h') return { text: 'text-red-400', pulse: true };
  const d = parseInt(label);
  if (!isNaN(d) && d <= 3) return { text: 'text-red-400', pulse: false };
  if (!isNaN(d) && d <= 7) return { text: 'text-amber-400', pulse: false };
  return { text: 'text-[oklch(0.42_0.01_280)]', pulse: false };
}

function volTierStyles(tier?: string): string {
  switch (tier) {
    case 'Deep':     return 'text-[#00c47c] bg-[#00c47c10] border-[#00c47c28]';
    case 'Active':   return 'text-blue-400 bg-blue-500/10 border-blue-500/25';
    case 'Moderate': return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    default:         return 'text-[oklch(0.38_0.01_280)] bg-[oklch(0.12_0.01_280)] border-[oklch(0.19_0.015_280)]';
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
  const marketCat   = d.subcategory || subcategory || category || 'Prediction';

  const yesBid: number | null = typeof d.yesBid === 'number' ? d.yesBid : null;
  const yesAsk: number | null = typeof d.yesAsk === 'number' ? d.yesAsk : null;

  const rawChange = d.priceChange ?? 0;
  const safeChange = Math.abs(rawChange) <= 99 ? rawChange : 0;
  const priceDir: 'up' | 'down' | 'flat' =
    d.priceDirection || (safeChange > 0 ? 'up' : safeChange < 0 ? 'down' : 'flat');

  const hasPrices = (yesBid !== null && yesBid > 0) || (yesAsk !== null && yesAsk > 0);

  const displayTitle = shortenTitle(title);
  const displayTicker = d.ticker ? cleanTicker(d.ticker) : null;

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
            <span className="text-[9px] font-black uppercase tracking-widest text-[oklch(0.35_0.025_260)] shrink-0">KALSHI</span>
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
            {priceDir !== 'flat' && safeChange > 0 && (
              <span className={cn('flex items-center gap-0.5 text-[10px] font-bold',
                priceDir === 'up' ? 'text-[#00c47c]' : 'text-[#f43f5e]',
              )}>
                {priceDir === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {safeChange}¢
              </span>
            )}
            {isActive ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00c47c0e] border border-[#00c47c22]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00c47c] animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-widest text-[#00c47c]/80">Live</span>
              </div>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.28_0.01_280)] px-1.5 py-0.5 rounded-full bg-[oklch(0.12_0.01_280)] border border-[oklch(0.17_0.01_280)]">Closed</span>
            )}
          </div>
        </div>

        {/* Title — smart truncation for long multi-option markets */}
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

        {/* Ticker — only shown if it's readable (not a hex hash) */}
        {displayTicker && (
          <span className="mt-1.5 inline-block font-mono text-[9px] text-[oklch(0.28_0.02_260)] tracking-wider bg-[oklch(0.11_0.01_280)] px-1.5 py-0.5 rounded">
            {displayTicker}
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-4">

        {/* Probability bar */}
        <ProbabilityBar yesPct={yesPct} isHero={isHero} />

        <div className="h-px bg-[#0d1118]" />

        {/* Edge score + recommendation */}
        <EdgeBadge edgeScore={edgeScore} yesPct={yesPct} recommendation={d.recommendation} />

        {/* Best prices (compact, only if available) */}
        {hasPrices && (
          <>
            <div className="h-px bg-[#0d1118]" />
            <BestPrices yesBid={yesBid} yesAsk={yesAsk} />
          </>
        )}

        <div className="h-px bg-[#0d1118]" />

        {/* Stats strip */}
        <div className="flex flex-wrap items-center gap-2">
          {d.volumeTier && (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold', volStyle)}>
              {d.volumeTier === 'Deep' && <Flame className="w-2.5 h-2.5" />}
              {d.volumeTier}
            </span>
          )}

          {d.volume24h && d.volume24h !== '' ? (
            <span className="text-[10px] text-[oklch(0.42_0.01_280)]">
              Vol <span className="text-white/80 font-bold">{d.volume24h}</span>
            </span>
          ) : d.volume && d.volume !== '—' ? (
            <span className="text-[10px] text-[oklch(0.42_0.01_280)]">
              Vol <span className="text-white/80 font-bold">{d.volume}</span>
            </span>
          ) : null}

          {d.openInterest && d.openInterest !== '—' && (
            <span className="text-[10px] text-[oklch(0.42_0.01_280)]">
              OI <span className="text-[oklch(0.65_0.01_280)] font-bold">{d.openInterest}</span>
            </span>
          )}

          {d.expiresLabel && d.expiresLabel !== 'Closed' && (
            <span className={cn('ml-auto flex items-center gap-1 text-[10px] font-semibold', urgency.text)}>
              <Clock className={cn('w-3 h-3', urgency.pulse && 'animate-pulse')} />
              {d.expiresLabel}
            </span>
          )}
        </div>

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

        {/* Kalshi link */}
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
