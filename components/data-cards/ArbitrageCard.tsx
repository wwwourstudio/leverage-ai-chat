'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle, AlertCircle, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ARB_EXPIRE_MS = 10 * 60 * 1000; // 10 minutes
const ARB_WARN_MS = 5 * 60 * 1000;    // 5 minutes warning

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
    generatedAt?: string; // ISO timestamp — injected when card is created
  };
  gradient?: string;
  onAnalyze?: () => void;
  isHero?: boolean;
}

export function ArbitrageCard({ data, gradient = 'from-emerald-500 to-green-600', onAnalyze, isHero }: ArbitrageCardProps) {
  const [ageMs, setAgeMs] = useState(0);

  useEffect(() => {
    if (!data.generatedAt) return;
    const created = new Date(data.generatedAt).getTime();
    const tick = () => setAgeMs(Date.now() - created);
    tick();
    // Use 1s interval when near expiry for accurate countdown, 15s otherwise
    const interval = ageMs >= ARB_WARN_MS ? 1_000 : 15_000;
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [data.generatedAt, ageMs >= ARB_WARN_MS]);

  const ageMin = Math.floor(ageMs / 60_000);
  const isExpired = ageMs >= ARB_EXPIRE_MS;
  const isWarning = ageMs >= ARB_WARN_MS && !isExpired;

  // Remaining time for countdown
  const remainingMs = Math.max(0, ARB_EXPIRE_MS - ageMs);
  const remainMins = Math.floor(remainingMs / 60_000);
  const remainSecs = Math.floor((remainingMs % 60_000) / 1_000);
  const countdownStr = isWarning
    ? remainMins > 0 ? `${remainMins}m ${remainSecs}s` : `${remainSecs}s`
    : `${10 - ageMin}m`;

  // ROI and implied probabilities
  const profitAmtNum = parseFloat(String(data.profitAmount ?? '').replace(/[$,]/g, ''));
  const totalStakeNum = parseFloat(String(data.totalStake ?? '').replace(/[$,]/g, ''));
  const roiPct = !isNaN(profitAmtNum) && !isNaN(totalStakeNum) && totalStakeNum > 0
    ? (profitAmtNum / totalStakeNum * 100).toFixed(2)
    : null;

  function impliedProb(odds: string): string | null {
    const n = parseFloat(odds);
    if (isNaN(n)) return null;
    const decimal = n >= 0 ? (n / 100) + 1 : 1 - (100 / n);
    return (1 / decimal * 100).toFixed(1);
  }
  const impl1 = data.bet1?.odds ? impliedProb(data.bet1.odds) : null;
  const impl2 = data.bet2?.odds ? impliedProb(data.bet2.odds) : null;

  const confColor =
    data.confidence === 'HIGH' ? 'text-emerald-400' :
    data.confidence === 'MEDIUM' ? 'text-sky-400' :
    'text-[oklch(0.50_0.01_280)]';
  const confDot =
    data.confidence === 'HIGH' ? 'bg-emerald-400' :
    data.confidence === 'MEDIUM' ? 'bg-sky-400' :
    'bg-[oklch(0.40_0.01_280)]';

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border transition-all duration-200 animate-fade-in-up',
      isExpired
        ? 'border-[oklch(0.22_0.02_280)] opacity-50 grayscale'
        : isWarning
          ? 'border-amber-600/40 hover:border-amber-500/60'
          : 'border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)]',
    )}>
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

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

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">ARBITRAGE</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" role="status">
            {data.generatedAt && ageMin > 0 && (
              <span className="text-[9px] text-[oklch(0.38_0.01_280)] mr-1">{ageMin}m ago</span>
            )}
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', isExpired ? 'bg-red-400 animate-none' : confDot)} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', isExpired ? 'text-red-400' : confColor)}>
              {isExpired ? 'EXPIRED' : data.confidence}
            </span>
          </div>
        </div>

        {/* Profit display */}
        <div className="mb-3">
          <div className="flex items-end gap-3">
            <div className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-400 leading-none">
              {data.profit}
            </div>
            {roiPct !== null && (
              <span className="text-sm font-black text-emerald-300 mb-0.5">+{roiPct}% ROI</span>
            )}
          </div>
          <p className="text-sm text-[oklch(0.60_0.01_280)] mt-1">
            Guaranteed: <span className="font-semibold text-[oklch(0.85_0.005_85)]">{data.profitAmount}</span>
            <span className="mx-2 text-[oklch(0.25_0.01_280)]">|</span>
            Stake: <span className="font-semibold text-[oklch(0.85_0.005_85)]">{data.totalStake}</span>
          </p>
        </div>

        {/* Implied probabilities */}
        {(impl1 || impl2) && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: data.bet1?.book ?? 'Leg 1', prob: impl1, accent: 'text-emerald-400' },
              { label: data.bet2?.book ?? 'Leg 2', prob: impl2, accent: 'text-sky-400' },
            ].map(({ label, prob, accent }) => prob ? (
              <div key={label} className="bg-[oklch(0.10_0.01_280)] rounded-xl border border-[oklch(0.19_0.015_280)] px-2.5 py-2 text-center">
                <p className="text-[8px] uppercase tracking-widest text-[oklch(0.38_0.01_280)] mb-0.5 truncate">{label}</p>
                <p className={cn('text-sm font-black tabular-nums', accent)}>{prob}%</p>
                <p className="text-[8px] text-[oklch(0.35_0.01_280)]">impl. prob</p>
              </div>
            ) : null)}
          </div>
        )}

        {/* Event info */}
        <div className="flex items-center gap-2 mb-3 text-xs text-[oklch(0.50_0.01_280)]">
          <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.event}</span>
          {data.gameTime && (
            <span className="inline-flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {data.gameTime}
            </span>
          )}
        </div>

        {/* Bet legs */}
        <div className="space-y-2">
          <BetLeg bet={data.bet1} leg={1} />
          <BetLeg bet={data.bet2} leg={2} />
        </div>

        {/* Market info */}
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 text-xs text-[oklch(0.50_0.01_280)]">
          <span>Efficiency: <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.efficiency}</span></span>
          <span>Books: <span className="font-semibold text-[oklch(0.80_0.005_85)]">{data.books}</span></span>
        </div>

        <p className="mt-3 text-[10px] text-[oklch(0.40_0.01_280)] text-center italic">Execute both bets quickly. Odds may change.</p>

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-1.5 w-full mt-4 pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
            aria-label="Analyze arbitrage opportunity"
          >
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
}

function BetLeg({ bet, leg }: { bet: { team: string; book: string; odds: string; stake: string; toWin: string }; leg: number }) {
  const accent = leg === 1 ? 'emerald' : 'sky';
  const borderCls = leg === 1 ? 'border-emerald-500/30' : 'border-sky-500/30';
  const oddsPositive = bet.odds && (bet.odds.startsWith('+') || parseFloat(bet.odds) > 0);
  const oddsCls = oddsPositive ? 'text-emerald-400' : 'text-white/90';

  return (
    <div className={cn('rounded-xl bg-[oklch(0.10_0.01_280)] border overflow-hidden', borderCls)}>
      {/* Leg header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 border-b',
        leg === 1 ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-sky-500/8 border-sky-500/20',
      )}>
        <div className="flex items-center gap-2">
          <CheckCircle className={cn('w-3.5 h-3.5 shrink-0', leg === 1 ? 'text-emerald-400' : 'text-sky-400')} aria-hidden="true" />
          <span className={cn('text-[9px] font-black uppercase tracking-widest', leg === 1 ? 'text-emerald-500' : 'text-sky-500')}>
            LEG {leg}
          </span>
          <span className="text-sm font-black text-white/90">{bet.team}</span>
        </div>
        <span className={cn('text-base font-black tabular-nums', oddsCls)}>{bet.odds}</span>
      </div>
      {/* Leg details */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2.5 text-xs">
        <div>
          <span className="text-[oklch(0.42_0.01_280)] text-[9px] uppercase tracking-wide font-bold">Book</span>
          <div className="font-bold text-[oklch(0.78_0.005_85)] mt-0.5">{bet.book}</div>
        </div>
        <div>
          <span className="text-[oklch(0.42_0.01_280)] text-[9px] uppercase tracking-wide font-bold">Stake</span>
          <div className="font-bold text-[oklch(0.78_0.005_85)] mt-0.5">{bet.stake}</div>
        </div>
        <div>
          <span className="text-[oklch(0.42_0.01_280)] text-[9px] uppercase tracking-wide font-bold">To Win</span>
          <div className="font-black text-emerald-400 mt-0.5">{bet.toWin}</div>
        </div>
      </div>
    </div>
  );
}
