'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ARB_EXPIRE_MS = 10 * 60 * 1000; // 10 minutes
const ARB_WARN_MS   = 5  * 60 * 1000; // 5 minutes warning

interface ArbitrageCardProps {
  data: {
    event: string;
    gameTime: string;
    profit: string;
    profitAmount: string;
    totalStake: string;
    bet1: { team: string; book: string; odds: string; stake: string; toWin: string };
    bet2: { team: string; book: string; odds: string; stake: string; toWin: string };
    confidence: string;
    efficiency: string;
    books: string;
    generatedAt?: string;
  };
  gradient?: string;
  onAnalyze?: () => void;
  isHero?: boolean;
}

function impliedProb(odds: string): number | null {
  const n = parseFloat(odds);
  if (isNaN(n)) return null;
  const decimal = n >= 0 ? (n / 100) + 1 : 1 - (100 / n);
  return parseFloat((1 / decimal * 100).toFixed(1));
}

// ── ROI Bar ────────────────────────────────────────────────────────────────────

function ROIBar({ roiPct }: { roiPct: string }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  const pct = parseFloat(roiPct);
  if (isNaN(pct) || pct <= 0) return null;
  // Scale: 10% ROI = full bar (most arbs are 1–5%, rare above 10%)
  const barWidth = Math.min(100, pct * 10);

  return (
    <div className="space-y-1 mt-1">
      <div className="flex justify-between text-[8px] font-bold">
        <span className="text-[var(--text-faint)] uppercase tracking-wider">ROI</span>
        <span className="text-emerald-400 tabular-nums">+{roiPct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-[var(--bg-elevated)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-700"
          style={{ width: animated ? `${barWidth}%` : '0%' }}
        />
      </div>
    </div>
  );
}

// ── Bet Leg ────────────────────────────────────────────────────────────────────

function BetLeg({
  bet, leg,
}: {
  bet: { team: string; book: string; odds: string; stake: string; toWin: string };
  leg: number;
}) {
  const isLeg1 = leg === 1;
  const borderCls = isLeg1 ? 'border-emerald-500/30' : 'border-teal-500/30';
  const oddsPositive = bet.odds && (bet.odds.startsWith('+') || parseFloat(bet.odds) > 0);
  const oddsCls = oddsPositive ? 'text-emerald-300' : 'text-foreground/90';
  const prob = impliedProb(bet.odds);

  return (
    <div className={cn('rounded-xl bg-[var(--bg-elevated)] border overflow-hidden', borderCls)}>
      {/* Leg header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 border-b',
        isLeg1 ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-teal-500/8 border-teal-500/20',
      )}>
        <div className="flex items-center gap-2">
          <CheckCircle className={cn('w-3.5 h-3.5 shrink-0', isLeg1 ? 'text-emerald-400' : 'text-teal-400')}
                       aria-hidden="true" />
          <span className={cn('text-[9px] font-black uppercase tracking-widest',
            isLeg1 ? 'text-emerald-500' : 'text-teal-500')}>
            LEG {leg}
          </span>
          <span className="text-sm font-black text-foreground/90">{bet.team}</span>
        </div>
        <div className="text-right">
          <span className={cn('text-base font-black tabular-nums', oddsCls)}>{bet.odds}</span>
          {prob !== null && (
            <div className="text-[8px] text-[var(--text-faint)] tabular-nums">{prob}% impl.</div>
          )}
        </div>
      </div>
      {/* Leg details */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2.5 text-xs">
        {[
          { label: 'Book',   val: bet.book,  cls: 'text-foreground/80' },
          { label: 'Stake',  val: bet.stake, cls: 'text-foreground/80' },
          { label: 'To Win', val: bet.toWin, cls: 'text-emerald-300 font-black' },
        ].map(({ label, val, cls }) => (
          <div key={label}>
            <span className="text-[var(--text-faint)] text-[9px] uppercase tracking-wide font-bold">{label}</span>
            <div className={cn('font-bold mt-0.5', cls)}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ArbitrageCard({
  data,
  gradient = 'from-emerald-500 to-green-600',
  onAnalyze,
  isHero,
}: ArbitrageCardProps) {
  const [ageMs, setAgeMs] = useState(0);

  useEffect(() => {
    // Bug fixes: (1) use recursive setTimeout so the delay adjusts dynamically
    // without putting ageMs in the dependency array; (2) fall back to Date.now()
    // when generatedAt is absent so the card still tracks time correctly.
    const created = data.generatedAt
      ? new Date(data.generatedAt).getTime()
      : Date.now();

    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const elapsed = Date.now() - created;
      setAgeMs(elapsed);
      const nextDelay = elapsed >= ARB_WARN_MS ? 1_000 : 15_000;
      id = setTimeout(schedule, nextDelay);
    };
    schedule();
    return () => clearTimeout(id);
  }, [data.generatedAt]);

  const isExpired   = ageMs >= ARB_EXPIRE_MS;
  const isWarning   = ageMs >= ARB_WARN_MS && !isExpired;
  const remainingMs = Math.max(0, ARB_EXPIRE_MS - ageMs);
  const remainMins  = Math.floor(remainingMs / 60_000);
  const remainSecs  = Math.floor((remainingMs % 60_000) / 1_000);
  // Bug fix: use remainMins (time left) instead of 10 - ageMin (which was off by up to 1 min)
  const countdownStr = isWarning
    ? remainMins > 0 ? `${remainMins}m ${remainSecs}s` : `${remainSecs}s`
    : `${remainMins}m`;
  const ageMin = Math.floor(ageMs / 60_000);

  const profitAmtNum  = parseFloat(String(data.profitAmount  ?? '').replace(/[$,]/g, ''));
  const totalStakeNum = parseFloat(String(data.totalStake    ?? '').replace(/[$,]/g, ''));
  const roiPct = !isNaN(profitAmtNum) && !isNaN(totalStakeNum) && totalStakeNum > 0
    ? (profitAmtNum / totalStakeNum * 100).toFixed(2)
    : null;

  const impl1 = data.bet1?.odds ? impliedProb(data.bet1.odds) : null;
  const impl2 = data.bet2?.odds ? impliedProb(data.bet2.odds) : null;
  const combinedImpl = (impl1 !== null && impl2 !== null) ? impl1 + impl2 : null;
  const edgeConfirmed = combinedImpl !== null && combinedImpl < 100;

  const confColor =
    data.confidence === 'HIGH'   ? 'text-emerald-400' :
    data.confidence === 'MEDIUM' ? 'text-sky-400'     : 'text-[var(--text-muted)]';
  const confDot =
    data.confidence === 'HIGH'   ? 'bg-emerald-400' :
    data.confidence === 'MEDIUM' ? 'bg-sky-400'     : 'bg-[var(--text-muted)]';

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-300 animate-fade-in-up',
      isExpired
        ? 'border-[var(--border-subtle)] opacity-50 grayscale'
        : isWarning
          ? 'border-amber-600/40 hover:border-amber-500/60 hover:shadow-[0_0_24px_oklch(0.6_0.15_80/0.12)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)]',
    )}>
      {/* Gradient header */}
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-emerald-500/5 to-transparent dark:from-emerald-600/25 dark:via-teal-800/10 pointer-events-none" />

      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)}
           aria-hidden="true" />

      {/* Expiry banner */}
      {(isWarning || isExpired) && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold border-b',
          isExpired
            ? 'bg-red-900/30 border-red-700/30 text-red-400'
            : 'bg-amber-900/20 border-amber-700/20 text-amber-400',
        )}>
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {isExpired
            ? `Opportunity expired ${ageMin} min ago — odds likely changed`
            : `${countdownStr} remaining — execute quickly`}
        </div>
      )}

      <div className="relative pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
              ARBITRAGE
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0" role="status">
            {data.generatedAt && ageMin > 0 && (
              <span className="text-[9px] text-[var(--text-faint)]">{ageMin}m ago</span>
            )}
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse',
              isExpired ? 'bg-red-400 animate-none' : confDot)} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider',
              isExpired ? 'text-red-400' : confColor)}>
              {isExpired ? 'EXPIRED' : data.confidence}
            </span>
          </div>
        </div>

        {/* Event name + game time */}
        <div className="mb-3">
          <h3 className="text-sm font-black text-foreground/90 leading-snug">{data.event}</h3>
          {data.gameTime && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)]">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {data.gameTime}
            </div>
          )}
        </div>

        {/* Profit hero + ROI */}
        <div className="rounded-2xl bg-[var(--bg-elevated)] border border-emerald-500/20 p-4 mb-4 text-center">
          <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Guaranteed Profit</p>
          <div className="flex items-end justify-center gap-3">
            <div className="text-4xl font-black tabular-nums text-emerald-300 leading-none">
              {data.profit}
            </div>
            {roiPct !== null && (
              <span className="text-base font-black text-emerald-400 mb-0.5">+{roiPct}% ROI</span>
            )}
          </div>
          {/* Investment vs profit comparison */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <div className="flex-1 text-center">
              <div className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-0.5">Total Investment</div>
              <div className="text-sm font-black text-[var(--foreground)] tabular-nums">{data.totalStake}</div>
            </div>
            <div className="text-[var(--text-faint)] text-xs">→</div>
            <div className="flex-1 text-center">
              <div className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-0.5">Guaranteed Return</div>
              <div className="text-sm font-black text-emerald-300 tabular-nums">{data.profitAmount}</div>
            </div>
          </div>
          {/* ROI progress bar */}
          {roiPct !== null && <ROIBar roiPct={roiPct} />}
        </div>

        {/* Implied probabilities + edge confirmation */}
        {combinedImpl !== null && (
          <div className="mb-3 text-[9px] text-center text-[var(--text-faint)] bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] px-3 py-2">
            Combined implied: <span className="font-bold tabular-nums">{combinedImpl.toFixed(1)}%</span>
            {edgeConfirmed && (
              <span className="ml-1.5 text-emerald-400 font-bold">← edge confirmed</span>
            )}
          </div>
        )}

        {/* Bet legs */}
        <div className="space-y-2 mb-3">
          <BetLeg bet={data.bet1} leg={1} />
          <BetLeg bet={data.bet2} leg={2} />
        </div>

        {/* Market info */}
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-[var(--text-muted)]">
          <span>Efficiency: <span className="font-semibold text-foreground/80">{data.efficiency}</span></span>
          <span>Books: <span className="font-semibold text-foreground/80">{data.books}</span></span>
        </div>

        <p className="mt-2 text-[10px] text-[var(--text-faint)] text-center italic">
          Execute both bets quickly. Odds may change.
        </p>

        {/* LOCK IN button */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/55 text-sm font-black text-emerald-300 hover:text-emerald-200 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Lock in arbitrage opportunity"
          >
            <CheckCircle className="w-4 h-4" aria-hidden="true" />
            LOCK IN — View Full Analysis
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}
