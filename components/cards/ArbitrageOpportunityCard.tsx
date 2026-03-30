'use client';

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

function formatOdds(price: number): string {
  return price >= 0 ? `+${price}` : `${price}`;
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

  return (
    <div className="bg-[oklch(0.11_0.01_280)] border border-blue-500/30 rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-blue-400/70">
          Arbitrage
        </span>
        <span className="text-lg font-bold text-blue-400">
          +{edge.toFixed(2)}%
        </span>
      </div>

      <p className="text-[13px] font-medium text-white/85">{opp.event}</p>

      {/* Sides */}
      {sides.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {sides.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-[oklch(0.08_0.01_280)] rounded-lg px-3 py-2"
            >
              <span className="text-[11px] text-white/70 truncate flex-1">{s.name}</span>
              <span className="text-[11px] font-bold text-violet-400 tabular-nums mx-3">
                {formatOdds(s.price)}
              </span>
              <span className="text-[10px] text-[oklch(0.40_0.01_280)]">{s.book}</span>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      {onAsk && (
        <button
          onClick={() =>
            onAsk(
              `Explain this arbitrage opportunity: ${opp.event}. Edge: ${edge.toFixed(2)}%. How should I size each bet to guarantee profit?`,
            )
          }
          className="w-full text-[11px] font-semibold text-blue-400 border border-blue-500/20 hover:border-blue-500/40 rounded-lg py-1.5 transition-colors"
        >
          Calculate stakes →
        </button>
      )}
    </div>
  );
}
