'use client';

import { memo } from 'react';
import {
  TrendingUp, TrendingDown, Vote, Trophy, CloudRain,
  Cpu, Film, Globe, Clock, ChevronRight, Flame,
  Activity, BarChart3, Zap, ArrowUp, ArrowDown,
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

/** SVG arc gauge — renders a semicircular probability arc */
function ProbabilityArc({ pct, color }: { pct: number; color: string }) {
  const r = 36;
  const cx = 48;
  const cy = 48;
  const startAngle = -180;
  const endAngle = 0;
  const angle = startAngle + (endAngle - startAngle) * (pct / 100);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const describeArc = (start: number, end: number) => {
    const s = { x: cx + r * Math.cos(toRad(start)), y: cy + r * Math.sin(toRad(start)) };
    const e = { x: cx + r * Math.cos(toRad(end)),   y: cy + r * Math.sin(toRad(end)) };
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };
  return (
    <svg viewBox="0 0 96 56" className="w-full" aria-hidden="true">
      {/* Track */}
      <path d={describeArc(startAngle, endAngle)} fill="none" stroke="oklch(0.18 0.02 280)" strokeWidth="6" strokeLinecap="round" />
      {/* Fill */}
      <path d={describeArc(startAngle, angle)} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
      {/* Centre needle */}
      <line
        x1={cx} y1={cy}
        x2={cx + (r - 10) * Math.cos(toRad(angle))}
        y2={cy + (r - 10) * Math.sin(toRad(angle))}
        stroke={color} strokeWidth="2" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="3" fill={color} />
    </svg>
  );
}

function urgencyStyles(label?: string) {
  if (!label || label === 'Closed') return { wrap: '', text: 'text-[oklch(0.40_0.01_280)]', pulse: false };
  if (label === '<24h') return { wrap: 'bg-red-500/10 border-red-500/25', text: 'text-red-400', pulse: true };
  const d = parseInt(label);
  if (!isNaN(d) && d <= 3) return { wrap: 'bg-red-500/10 border-red-500/25', text: 'text-red-400', pulse: false };
  if (!isNaN(d) && d <= 7) return { wrap: 'bg-amber-500/10 border-amber-500/25', text: 'text-amber-400', pulse: false };
  return { wrap: 'bg-[oklch(0.13_0.01_280)] border-[oklch(0.20_0.015_280)]', text: 'text-[oklch(0.48_0.01_280)]', pulse: false };
}

function volTierStyles(tier?: string) {
  switch (tier) {
    case 'Deep':     return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    case 'Active':   return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
    case 'Moderate': return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    default:         return 'bg-[oklch(0.13_0.01_280)] border-[oklch(0.20_0.015_280)] text-[oklch(0.45_0.01_280)]';
  }
}

export const KalshiCard = memo(function KalshiCard({
  title,
  category,
  subcategory,
  gradient,
  data: d,
  status,
  onAnalyze,
  isHero,
}: KalshiCardProps) {
  const yesPct: number = typeof d.yesPct === 'number' ? d.yesPct : parseFloat(d.yesPrice) || 50;
  const noPct: number  = typeof d.noPct  === 'number' ? d.noPct  : 100 - yesPct;
  const isActive = status === 'active' || status === 'open' || status === 'live';
  const edgeScore: number = typeof d.edgeScore === 'number' ? d.edgeScore : Math.round(Math.abs(yesPct - 50) * 2);

  // Arc colour based on YES probability
  const arcColor =
    yesPct >= 70 ? '#10b981' :
    yesPct >= 55 ? '#4ade80' :
    yesPct >= 45 ? '#94a3b8' :
    yesPct >= 30 ? '#fb923c' : '#f87171';

  const urgency = urgencyStyles(d.expiresLabel);
  const volStyle = volTierStyles(d.volumeTier);

  const yesBid: number | null = typeof d.yesBid === 'number' ? d.yesBid : null;
  const yesAsk: number | null = typeof d.yesAsk === 'number' ? d.yesAsk : null;
  const noBid:  number | null = typeof d.noBid  === 'number' ? d.noBid  : null;
  const noAsk:  number | null = typeof d.noAsk  === 'number' ? d.noAsk  : null;
  const hasBidAsk = (yesBid !== null && yesBid > 0) || (yesAsk !== null && yesAsk > 0);
  const spread = yesAsk !== null && yesBid !== null ? yesAsk - yesBid : null;

  const priceDir: 'up' | 'down' | 'flat' = d.priceDirection || (d.priceChange > 0 ? 'up' : d.priceChange < 0 ? 'down' : 'flat');

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.09_0.012_280)] border transition-all duration-300',
      isHero
        ? 'border-[oklch(0.26_0.025_260)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.15)]'
        : 'border-[oklch(0.18_0.016_280)] hover:border-[oklch(0.28_0.02_280)] hover:shadow-[0_0_20px_oklch(0.3_0.04_280/0.10)]',
    )}>

      {/* ── Gradient header band ─────────────────────────────────────── */}
      <div className={cn('relative px-4 pt-3.5 pb-3 bg-gradient-to-br', gradient)}>
        {/* Live / closed pulse */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {isActive ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/80">LIVE</span>
            </>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">CLOSED</span>
          )}
        </div>

        {/* Category breadcrumb */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <CategoryIcon label={d.iconLabel} className="text-white/70 w-3 h-3" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">KALSHI</span>
          <span className="text-white/30 text-[9px]">/</span>
          <span className="text-[9px] font-medium text-white/55 truncate">{subcategory || category}</span>
        </div>

        {/* Title */}
        <h3 className={cn(
          'font-black text-white leading-snug text-balance pr-12',
          isHero ? 'text-lg' : 'text-sm',
        )}>{title}</h3>

        {d.subtitle && d.subtitle !== title && (
          <p className="text-[11px] text-white/60 mt-1 line-clamp-1">{d.subtitle}</p>
        )}
      </div>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Probability gauge ────────────────────────────────────────── */}
        <div className="mt-3 rounded-xl bg-[oklch(0.07_0.01_280)] border border-[oklch(0.16_0.015_280)] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[oklch(0.40_0.01_280)] flex items-center gap-1">
              <Activity className="w-3 h-3" /> Implied Probability
            </span>
            {priceDir !== 'flat' && (
              <span className={cn('flex items-center gap-0.5 text-[10px] font-bold',
                priceDir === 'up' ? 'text-emerald-400' : 'text-red-400'
              )}>
                {priceDir === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(d.priceChange ?? 0)}¢
              </span>
            )}
          </div>

          <div className="flex items-end gap-3">
            {/* YES */}
            <div className="text-center">
              <div className={cn(
                'font-black tabular-nums leading-none',
                isHero ? 'text-4xl' : 'text-3xl',
                yesPct >= 50 ? 'text-white' : 'text-[oklch(0.45_0.01_280)]'
              )}>
                {yesPct}<span className={cn('font-bold', isHero ? 'text-lg' : 'text-base')}>%</span>
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400/80 mt-1">YES</div>
            </div>

            {/* Arc gauge — take up remaining space */}
            <div className="flex-1 -mt-1">
              <ProbabilityArc pct={yesPct} color={arcColor} />
            </div>

            {/* NO */}
            <div className="text-center">
              <div className={cn(
                'font-black tabular-nums leading-none',
                isHero ? 'text-4xl' : 'text-3xl',
                noPct >= 50 ? 'text-white' : 'text-[oklch(0.45_0.01_280)]'
              )}>
                {noPct}<span className={cn('font-bold', isHero ? 'text-lg' : 'text-base')}>%</span>
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest text-red-400/80 mt-1">NO</div>
            </div>
          </div>

          {/* Linear bar */}
          <div className="mt-2">
            <div className="relative h-2 rounded-full bg-[oklch(0.13_0.01_280)] overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{ width: `${yesPct}%`, background: arcColor }}
              />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[oklch(0.28_0.01_280)]" />
            </div>
            <div className="flex justify-between text-[8px] text-[oklch(0.28_0.01_280)] tabular-nums mt-0.5">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
        </div>

        {/* ── Edge score ───────────────────────────────────────────────── */}
        <div className="rounded-xl bg-[oklch(0.07_0.01_280)] border border-[oklch(0.16_0.015_280)] px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-[oklch(0.48_0.01_280)]" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.40_0.01_280)]">Market Edge</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                'font-black',
                isHero ? 'text-base' : 'text-sm',
                edgeScore >= 60 ? 'text-emerald-400' : edgeScore >= 30 ? 'text-amber-400' : 'text-white',
              )}>{edgeScore}</span>
              <span className="text-[9px] text-[oklch(0.35_0.01_280)]">/100</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-[oklch(0.13_0.01_280)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-700"
              style={{ width: `${Math.min(100, edgeScore)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-[oklch(0.28_0.01_280)]">
            <span>Efficient (50/50)</span>
            <span>Max Edge</span>
          </div>
        </div>

        {/* ── Order book ───────────────────────────────────────────────── */}
        {hasBidAsk && (
          <div className="rounded-xl bg-[oklch(0.07_0.01_280)] border border-[oklch(0.16_0.015_280)] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.40_0.01_280)]">Order Book</span>
              {spread !== null && spread > 0 && (
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded',
                  spread <= 2 ? 'text-emerald-400 bg-emerald-500/10' :
                  spread <= 5 ? 'text-amber-400 bg-amber-500/10' :
                  'text-red-400 bg-red-500/10'
                )}>
                  {d.spreadLabel || (spread <= 2 ? 'Tight' : spread <= 5 ? 'Normal' : 'Wide')} spread
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[
                { label: 'YES Bid', val: yesBid, col: 'text-emerald-400', bg: 'bg-emerald-500/8' },
                { label: 'YES Ask', val: yesAsk, col: 'text-emerald-300', bg: 'bg-emerald-500/5' },
                { label: 'NO Bid',  val: noBid,  col: 'text-red-400',     bg: 'bg-red-500/8' },
                { label: 'NO Ask',  val: noAsk,  col: 'text-red-300',     bg: 'bg-red-500/5' },
              ].map(({ label, val, col, bg }) => val !== null && val > 0 && (
                <div key={label} className={cn('flex flex-col items-center rounded-lg py-1.5', bg)}>
                  <span className="text-[8px] font-semibold text-[oklch(0.35_0.01_280)] mb-0.5">{label}</span>
                  <span className={cn('text-xs font-black tabular-nums', col)}>{val}¢</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {d.volumeTier && (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold', volStyle)}>
              {d.volumeTier === 'Deep' && <Flame className="w-3 h-3" />}
              {d.volumeTier}
            </span>
          )}
          {d.volume && (
            <span className="px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] font-medium text-[oklch(0.55_0.01_280)]">
              Vol {d.volume}
            </span>
          )}
          {d.openInterest && d.openInterest !== '$0' && (
            <span className="px-2 py-0.5 rounded-md bg-[oklch(0.13_0.015_280)] border border-[oklch(0.19_0.015_280)] text-[10px] font-medium text-[oklch(0.55_0.01_280)]">
              OI {d.openInterest}
            </span>
          )}
          {d.expiresLabel && d.expiresLabel !== 'Closed' && (
            <span className={cn(
              'ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold',
              urgency.wrap || 'bg-[oklch(0.13_0.015_280)] border-[oklch(0.19_0.015_280)]',
              urgency.text,
            )}>
              <Clock className={cn('w-3 h-3', urgency.pulse && 'animate-pulse')} />
              {d.expiresLabel}
            </span>
          )}
        </div>

        {/* ── Recommendation ───────────────────────────────────────────── */}
        {d.recommendation && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-xl border',
            yesPct >= 60 ? 'bg-emerald-500/8 border-emerald-500/20' :
            yesPct <= 40 ? 'bg-red-500/8 border-red-500/20' :
            'bg-[oklch(0.11_0.015_280)] border-[oklch(0.19_0.02_280)]',
          )}>
            <Zap className={cn('w-3.5 h-3.5 shrink-0',
              yesPct >= 60 ? 'text-emerald-400' : yesPct <= 40 ? 'text-red-400' : 'text-[oklch(0.48_0.01_280)]',
            )} />
            <span className={cn('text-xs font-bold',
              yesPct >= 60 ? 'text-emerald-400' : yesPct <= 40 ? 'text-red-400' : 'text-[oklch(0.55_0.01_280)]',
            )}>
              {d.recommendation}
            </span>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        {(d.ticker || d.closeTime) && (
          <div className="flex items-center justify-between pt-2 border-t border-[oklch(0.15_0.015_280)] text-[9px] text-[oklch(0.30_0.01_280)]">
            {d.ticker && <span className="font-mono">{d.ticker}</span>}
            {d.closeTime && <span>Closes {d.closeTime}</span>}
          </div>
        )}

        {/* ── Analyze CTA ──────────────────────────────────────────────── */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[oklch(0.08_0.01_280)] border border-[oklch(0.17_0.015_280)] text-xs font-semibold text-[oklch(0.46_0.01_280)] hover:text-white hover:bg-[oklch(0.14_0.015_280)] hover:border-[oklch(0.26_0.02_280)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Analyze ${title}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
});
