'use client';

import { TrendingUp, CheckCircle, AlertCircle, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  };
  gradient?: string;
  onAnalyze?: () => void;
}

export function ArbitrageCard({ data, gradient = 'from-emerald-500 to-green-600', onAnalyze }: ArbitrageCardProps) {
  const confColor =
    data.confidence === 'HIGH' ? 'text-emerald-400' :
    data.confidence === 'MEDIUM' ? 'text-sky-400' :
    'text-[oklch(0.50_0.01_280)]';
  const confDot =
    data.confidence === 'HIGH' ? 'bg-emerald-400' :
    data.confidence === 'MEDIUM' ? 'bg-sky-400' :
    'bg-[oklch(0.40_0.01_280)]';

  return (
    <article className="group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)] transition-all duration-200 animate-fade-in-up">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">ARBITRAGE</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" role="status">
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', confDot)} />
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', confColor)}>
              {data.confidence}
            </span>
          </div>
        </div>

        {/* Profit display */}
        <div className="mb-3">
          <div className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-400 leading-none">
            {data.profit}
          </div>
          <p className="text-sm text-[oklch(0.60_0.01_280)] mt-1">
            Guaranteed: <span className="font-semibold text-[oklch(0.85_0.005_85)]">{data.profitAmount}</span>
            <span className="mx-2 text-[oklch(0.25_0.01_280)]">|</span>
            Stake: <span className="font-semibold text-[oklch(0.85_0.005_85)]">{data.totalStake}</span>
          </p>
        </div>

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
  return (
    <div className="rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold text-[oklch(0.90_0.005_85)]">{bet.team}</span>
        </div>
        <span className="text-sm font-mono font-bold tabular-nums text-[oklch(0.90_0.005_85)]">{bet.odds}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-[oklch(0.45_0.01_280)]">Book</span>
          <div className="font-semibold text-[oklch(0.75_0.005_85)]">{bet.book}</div>
        </div>
        <div>
          <span className="text-[oklch(0.45_0.01_280)]">Stake</span>
          <div className="font-semibold text-[oklch(0.75_0.005_85)]">{bet.stake}</div>
        </div>
        <div>
          <span className="text-[oklch(0.45_0.01_280)]">To Win</span>
          <div className="font-semibold text-emerald-400">{bet.toWin}</div>
        </div>
      </div>
    </div>
  );
}
