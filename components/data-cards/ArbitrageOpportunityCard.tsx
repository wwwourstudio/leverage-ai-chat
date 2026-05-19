'use client';

import { formatAmericanOdds } from '@/lib/utils';

export interface ArbitrageOpportunity {
  event: string;
  sport?: string;
  profitPercentage?: number;
  // Also accept generic edge field
  edge?: number;
  bestHomeOdds?: number;
  bestHomeBook?: string;
  bestAwayOdds?: number;
  bestAwayBook?: string;
  // Generic sides array (used when coming from enriched arbitrage endpoint)
  sides?: Array<{ name: string; book: string; price: number }>;
  bets?: Array<{ team: string; book: string; odds: string; stake: string }>;
  confidence?: string | number;
  commenceTime?: string;
}

interface ArbitrageOpportunityCardProps {
  opportunity: ArbitrageOpportunity;
  onAsk?: (query: string) => void;
}

export function ArbitrageOpportunityCard({ opportunity: opp, onAsk }: ArbitrageOpportunityCardProps) {
  const edge = opp.profitPercentage ?? opp.edge ?? 0;

  // Normalise sides from either shape
  const sides: Array<{ name: string; book: string; price: number }> = opp.sides
    ? opp.sides
    : [
        opp.bestAwayBook && opp.bestAwayOdds != null
          ? { name: 'Away', book: opp.bestAwayBook, price: opp.bestAwayOdds }
          : null,
        opp.bestHomeBook && opp.bestHomeOdds != null
          ? { name: 'Home', book: opp.bestHomeBook, price: opp.bestHomeOdds }
          : null,
      ].filter((s): s is { name: string; book: string; price: number } => s !== null);

  const impliedProb = (price: number): number => {
    const decimal = price >= 0 ? (price / 100) + 1 : 1 - (100 / price);
    return parseFloat((1 / decimal * 100).toFixed(1));
  };

  return (
    <div className="group relative w-full rounded-2xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-glow)] transition-all duration-300">
      {/* Gradient header */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-600/25 dark:via-teal-800/10 to-transparent pointer-events-none" />

      <div className="relative px-4 pt-4 pb-4 flex flex-col gap-3">
        {/* Header: ARBITRAGE badge + PROFIT hero */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Arbitrage
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-wide">
            PROFIT
          </span>
        </div>

        {/* Hero profit stat */}
        <div className="text-center py-2">
          <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-1">Guaranteed Profit</p>
          <p className="text-5xl font-black tabular-nums text-blue-300 leading-none">
            +{edge.toFixed(2)}%
          </p>
          {opp.sport && (
            <p className="text-[10px] text-[var(--text-muted)] mt-1.5">{opp.sport}</p>
          )}
        </div>

        {/* Event name */}
        <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3 py-2">
          <p className="text-[9px] uppercase tracking-widest text-[var(--text-faint)] mb-0.5">Event</p>
          <p className="text-[13px] font-bold text-white/90 leading-snug">{opp.event}</p>
          {opp.commenceTime && (
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{opp.commenceTime}</p>
          )}
        </div>

        {/* Bet legs side by side */}
        {sides.length > 0 && (
          <div className="flex items-stretch gap-2">
            {sides.map((s, i) => {
              const prob = impliedProb(s.price);
              const isLeg1 = i === 0;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-xl border p-3 ${
                    isLeg1
                      ? 'bg-blue-500/8 border-blue-500/25'
                      : 'bg-teal-500/8 border-teal-500/25'
                  }`}
                >
                  <div className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isLeg1 ? 'text-blue-500' : 'text-teal-400'}`}>
                    Leg {i + 1}
                  </div>
                  <div className="text-[11px] font-bold text-white/80 truncate mb-1.5">{s.name}</div>
                  <div className={`text-xl font-black tabular-nums ${isLeg1 ? 'text-blue-300' : 'text-teal-300'}`}>
                    {formatAmericanOdds(s.price)}
                  </div>
                  <div className="text-[9px] text-[var(--text-faint)] mt-1">{prob}% implied</div>
                  <div className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide mt-0.5">{s.book}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Combined implied probs note */}
        {sides.length >= 2 && (() => {
          const combined = sides.reduce((sum, s) => sum + impliedProb(s.price), 0);
          const edgeConfirmed = combined < 100;
          return (
            <div className="text-[9px] text-center text-[var(--text-faint)]">
              Combined implied: <span className="font-bold tabular-nums">{combined.toFixed(1)}%</span>
              {edgeConfirmed && (
                <span className="ml-1.5 text-blue-400 font-bold">← edge confirmed</span>
              )}
            </div>
          );
        })()}

        {/* View Details CTA */}
        {onAsk && (
          <button
            onClick={() =>
              onAsk(
                `Explain this arbitrage opportunity: ${opp.event}. Edge: ${edge.toFixed(2)}%. How should I size each bet to guarantee profit?`,
              )
            }
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-500/50 text-[12px] font-bold text-blue-300 hover:text-blue-200 transition-all duration-200"
          >
            <span className="text-base leading-none">💰</span>
            Calculate Stakes → View Details
          </button>
        )}
      </div>
    </div>
  );
}
