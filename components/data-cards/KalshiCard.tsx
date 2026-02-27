'use client';

import {
  TrendingUp, Vote, Trophy, CloudRain, TrendingDown,
  Cpu, Film, Globe, BarChart3, Clock, ChevronRight, Flame,
  BookOpen, Activity,
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
  const cls = cn('w-4 h-4', className);
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

/** Edge score bar fill colour */
function edgeColor(score: number): string {
  if (score >= 60) return 'from-emerald-500 to-green-400';
  if (score >= 40) return 'from-blue-500 to-cyan-400';
  if (score >= 20) return 'from-amber-500 to-yellow-400';
  return 'from-[oklch(0.35_0.01_280)] to-[oklch(0.28_0.01_280)]';
}

/** Urgency class from expiresLabel */
function urgencyClass(expiresLabel?: string): { bg: string; text: string; pulse: boolean } {
  if (!expiresLabel || expiresLabel === 'Closed') return { bg: '', text: 'text-[oklch(0.45_0.01_280)]', pulse: false };
  if (expiresLabel === '<24h') return { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', pulse: true };
  const days = parseInt(expiresLabel);
  if (!isNaN(days) && days <= 3) return { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', pulse: false };
  if (!isNaN(days) && days <= 7) return { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', pulse: false };
  return { bg: '', text: 'text-[oklch(0.45_0.01_280)]', pulse: false };
}

/** Volume tier badge colour */
function volumeTierColor(tier?: string): string {
  switch (tier) {
    case 'Deep':     return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    case 'Active':   return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
    case 'Moderate': return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    default:         return 'bg-[oklch(0.14_0.01_280)] border-[oklch(0.22_0.02_280)] text-[oklch(0.50_0.01_280)]';
  }
}

export function KalshiCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isHero,
}: KalshiCardProps) {
  const d = data;
  const yesPct: number = typeof d.yesPct === 'number' ? d.yesPct : parseFloat(d.yesPrice) || 50;
  const noPct: number = typeof d.noPct === 'number' ? d.noPct : 100 - yesPct;
  const isActive = status === 'active' || status === 'open' || status === 'live';
  const edgeScore: number = typeof d.edgeScore === 'number' ? d.edgeScore : Math.round(Math.abs(yesPct - 50) * 2);

  const yesBarColor =
    yesPct >= 70 ? 'bg-emerald-500' :
    yesPct >= 55 ? 'bg-green-400' :
    yesPct >= 45 ? 'bg-[oklch(0.50_0.01_280)]' :
    yesPct >= 30 ? 'bg-orange-400' : 'bg-red-400';

  const urgency = urgencyClass(d.expiresLabel);
  const volColor = volumeTierColor(d.volumeTier);

  // Bid/ask data (either from new fields or derived from yesPct/noPct)
  const yesBid: number | null = typeof d.yesBid === 'number' ? d.yesBid : null;
  const yesAsk: number | null = typeof d.yesAsk === 'number' ? d.yesAsk : null;
  const noBid: number | null = typeof d.noBid === 'number' ? d.noBid : null;
  const noAsk: number | null = typeof d.noAsk === 'number' ? d.noAsk : null;
  const hasBidAsk = yesBid !== null || yesAsk !== null;
  const spread: number | null = (yesAsk !== null && yesBid !== null) ? yesAsk - yesBid : null;

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.10_0.012_280)] border transition-all duration-200 animate-fade-in-up',
      isHero
        ? 'border-[oklch(0.28_0.025_260)] shadow-[0_0_24px_oklch(0.3_0.08_260/0.12)]'
        : 'border-[oklch(0.20_0.018_280)] hover:border-[oklch(0.28_0.02_280)]',
    )}>
      {/* Top gradient bar */}
      <div className={cn('absolute left-0 top-0 right-0 h-[2px] bg-gradient-to-r', gradient)} aria-hidden="true" />

      <div className={cn('px-4 py-4', isHero && 'sm:px-5 sm:py-5')}>
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <CategoryIcon label={d.iconLabel} className="text-[oklch(0.55_0.01_280)] shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.01_280)]">KALSHI</span>
            <span className="text-[oklch(0.30_0.01_280)]" aria-hidden="true">/</span>
            <span className="text-[10px] font-medium text-[oklch(0.45_0.01_280)] truncate">{subcategory || category}</span>
            {/* Context chip */}
            {d.contextChip && (
              <span className="px-1.5 py-0.5 rounded-full bg-[oklch(0.16_0.02_280)] border border-[oklch(0.24_0.02_280)] text-[9px] font-semibold text-[oklch(0.55_0.01_280)]">
                {d.contextChip}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0" role="status">
            <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-400 animate-pulse' : 'bg-[oklch(0.40_0.01_280)]')} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', isActive ? 'text-emerald-400' : 'text-[oklch(0.45_0.01_280)]')}>
              {isActive ? 'LIVE' : 'CLOSED'}
            </span>
          </div>
        </div>

        <h3 className={cn(
          'font-bold text-[oklch(0.95_0.005_85)] leading-snug text-balance mb-1',
          isHero ? 'text-lg sm:text-xl' : 'text-base sm:text-lg',
        )}>{title}</h3>

        {d.subtitle && d.subtitle !== title && (
          <p className="text-sm text-[oklch(0.48_0.01_280)] leading-relaxed mb-3 line-clamp-2">{d.subtitle}</p>
        )}

        {/* ── Market Probability Gauge ─────────────────────── */}
        <div className="mt-3 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] p-3 space-y-3">
          <div className="flex items-center justify-between text-[9px] font-bold text-[oklch(0.42_0.01_280)] uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Market Probability
            </span>
            <span className="text-[oklch(0.38_0.01_280)]">implied</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Yes */}
            <div className="flex-1 text-center">
              <div className={cn('text-3xl font-black tabular-nums leading-none', yesPct >= 50 ? 'text-[oklch(0.95_0.005_85)]' : 'text-[oklch(0.45_0.01_280)]')}>
                {yesPct}<span className="text-sm">%</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80 mt-1">YES</div>
            </div>

            {/* Gauge */}
            <div className="flex-[2] space-y-1.5">
              <div className="relative h-4 rounded-full bg-[oklch(0.13_0.01_280)] overflow-hidden">
                <div
                  className={cn('absolute left-0 top-0 h-full transition-all duration-700', yesBarColor)}
                  style={{ width: `${yesPct}%` }}
                />
                {/* 50% centre marker */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[oklch(0.28_0.01_280)]" />
              </div>
              <div className="flex justify-between text-[8px] text-[oklch(0.28_0.01_280)] tabular-nums">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>

            {/* No */}
            <div className="flex-1 text-center">
              <div className={cn('text-3xl font-black tabular-nums leading-none', noPct >= 50 ? 'text-[oklch(0.95_0.005_85)]' : 'text-[oklch(0.45_0.01_280)]')}>
                {noPct}<span className="text-sm">%</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-red-400/80 mt-1">NO</div>
            </div>
          </div>
        </div>

        {/* ── Edge Score Bar ───────────────────────────────── */}
        <div className="mt-3 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-[oklch(0.50_0.01_280)]" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.42_0.01_280)]">Market Edge Score</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tabular-nums text-[oklch(0.92_0.005_85)]">{edgeScore}</span>
              <span className="text-[9px] text-[oklch(0.38_0.01_280)]">/100</span>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-[oklch(0.13_0.01_280)] overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', edgeColor(edgeScore))}
              style={{ width: `${Math.min(100, edgeScore)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-[oklch(0.30_0.01_280)]">
            <span>Efficient (50/50)</span>
            <span>Max Edge</span>
          </div>
        </div>

        {/* ── Order Book (bid/ask) ─────────────────────────── */}
        {hasBidAsk && (
          <div className="mt-3 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen className="w-3 h-3 text-[oklch(0.50_0.01_280)]" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.42_0.01_280)]">Order Book</span>
              {spread !== null && (
                <span className="ml-auto text-[9px] text-[oklch(0.40_0.01_280)]">Spread: {spread.toFixed(1)}¢</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                { label: 'YES Bid', val: yesBid, col: 'text-emerald-400' },
                { label: 'YES Ask', val: yesAsk, col: 'text-emerald-300' },
                { label: 'NO Bid',  val: noBid,  col: 'text-red-400' },
                { label: 'NO Ask',  val: noAsk,  col: 'text-red-300' },
              ].map(({ label, val, col }) => val !== null && (
                <div key={label} className="flex flex-col items-center rounded-lg bg-[oklch(0.12_0.01_280)] py-1.5">
                  <span className="text-[8px] font-semibold text-[oklch(0.38_0.01_280)] mb-0.5">{label}</span>
                  <span className={cn('text-xs font-black tabular-nums', col)}>{val}¢</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats row: Volume / OI / Expiry ─────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {d.volumeTier && (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold', volColor)}>
              {d.volumeTier === 'Deep' && <Flame className="w-3 h-3" />}
              {d.volumeTier}
            </span>
          )}
          {d.volume && (
            <span className="px-2 py-0.5 rounded-md bg-[oklch(0.14_0.015_280)] border border-[oklch(0.20_0.015_280)] text-[10px] font-medium text-[oklch(0.58_0.01_280)]">
              Vol: {d.volume}
            </span>
          )}
          {d.openInterest && (
            <span className="px-2 py-0.5 rounded-md bg-[oklch(0.14_0.015_280)] border border-[oklch(0.20_0.015_280)] text-[10px] font-medium text-[oklch(0.58_0.01_280)]">
              OI: {d.openInterest}
            </span>
          )}
          {d.expiresLabel && d.expiresLabel !== 'Closed' && (
            <span className={cn(
              'ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold',
              urgency.bg || 'bg-[oklch(0.14_0.015_280)] border-[oklch(0.20_0.015_280)]',
              urgency.text,
            )}>
              <Clock className={cn('w-3 h-3', urgency.pulse && 'animate-pulse')} aria-hidden="true" />
              {d.expiresLabel}
            </span>
          )}
        </div>

        {/* ── Historical accuracy ──────────────────────────── */}
        {d.historicalAccuracy !== undefined && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)]">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[10px] font-semibold text-[oklch(0.48_0.01_280)]">Model accuracy:</span>
            <span className="text-[10px] font-black text-cyan-300 tabular-nums">{d.historicalAccuracy}%</span>
            <div className="ml-auto flex-1 max-w-[60px] h-1.5 rounded-full bg-[oklch(0.17_0.015_280)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, parseFloat(String(d.historicalAccuracy))))}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Recommendation ──────────────────────────────── */}
        {d.recommendation && (
          <div className={cn(
            'flex items-center gap-2 mt-3 px-3 py-2 rounded-xl border',
            yesPct >= 60 ? 'bg-emerald-500/8 border-emerald-500/20'
            : yesPct <= 40 ? 'bg-red-500/8 border-red-500/20'
            : 'bg-[oklch(0.12_0.015_280)] border-[oklch(0.20_0.02_280)]',
          )}>
            <BarChart3 className={cn('w-3.5 h-3.5 shrink-0',
              yesPct >= 60 ? 'text-emerald-400' : yesPct <= 40 ? 'text-red-400' : 'text-[oklch(0.50_0.01_280)]',
            )} />
            <span className={cn('text-xs font-semibold',
              yesPct >= 60 ? 'text-emerald-400' : yesPct <= 40 ? 'text-red-400' : 'text-[oklch(0.58_0.01_280)]',
            )}>
              {d.recommendation}
            </span>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────── */}
        {(d.ticker || d.closeTime) && (
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[oklch(0.18_0.018_280)] text-[9px] text-[oklch(0.32_0.01_280)]">
            {d.ticker && <span className="font-mono">{d.ticker}</span>}
            {d.closeTime && <span>Closes {d.closeTime}</span>}
          </div>
        )}

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-3 py-2.5 rounded-xl bg-[oklch(0.09_0.01_280)] border border-[oklch(0.18_0.015_280)] text-xs font-semibold text-[oklch(0.48_0.01_280)] hover:text-[oklch(0.85_0.005_85)] hover:bg-[oklch(0.13_0.01_280)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Analyze ${title}`}
          >
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
