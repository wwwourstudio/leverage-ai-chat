'use client';

/**
 * ProbabilitySurfaceCard
 *
 * Displays the Bayesian probability surface blend with a stacked bar
 * showing each component's weighted contribution.
 */

interface SurfaceWeights {
  sportsbook: number;
  prediction_market: number;
  historical: number;
}

interface Props {
  surfaceProbability: number;
  components: {
    sportsbookConsensus: number;
    kalshiProbability: number | null;
    historicalPrior: number | null;
  };
  weights: SurfaceWeights;
  confidence: number;
}

const COMPONENT_STYLES = [
  { key: 'sportsbook', label: 'Sportsbooks', color: 'bg-blue-500' },
  { key: 'prediction_market', label: 'Kalshi', color: 'bg-purple-500' },
  { key: 'historical', label: 'Historical', color: 'bg-emerald-500' },
] as const;

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function probColor(prob: number): string {
  if (prob >= 0.65) return 'text-emerald-400';
  if (prob >= 0.45) return 'text-amber-400';
  return 'text-red-400';
}

export function ProbabilitySurfaceCard({ surfaceProbability, components, weights, confidence }: Props) {
  // Compute the normalized effective weight for each visible component
  const availableComponents = COMPONENT_STYLES.filter(c => {
    if (c.key === 'sportsbook') return true;
    if (c.key === 'prediction_market') return components.kalshiProbability !== null;
    if (c.key === 'historical') return components.historicalPrior !== null;
    return false;
  });

  const totalWeight = availableComponents.reduce((s, c) => s + weights[c.key], 0);

  const bars = availableComponents.map(c => {
    const value = c.key === 'sportsbook'
      ? components.sportsbookConsensus
      : c.key === 'prediction_market'
        ? (components.kalshiProbability ?? 0)
        : (components.historicalPrior ?? 0);
    const normalizedWeight = totalWeight > 0 ? weights[c.key] / totalWeight : 0;
    return { ...c, value, normalizedWeight };
  });

  return (
    <div className="space-y-3">
      {/* Final surface probability */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Bayesian Surface</span>
        <span className={`text-lg font-bold font-mono ${probColor(surfaceProbability)}`}>
          {pct(surfaceProbability)}
        </span>
      </div>

      {/* Stacked contribution bar */}
      <div className="space-y-1.5">
        {bars.map(bar => (
          <div key={bar.key}>
            <div className="flex justify-between text-xs text-white/50 mb-0.5">
              <span>{bar.label}</span>
              <span className="font-mono">{pct(bar.value)} × {pct(bar.normalizedWeight)}</span>
            </div>
            <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full rounded-full ${bar.color} transition-all duration-500`}
                style={{ width: `${bar.value * 100}%`, opacity: 0.7 + bar.normalizedWeight * 0.3 }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Confidence indicator */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">Data confidence</span>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[0.33, 0.66, 1.0].map(thresh => (
              <div
                key={thresh}
                className={`w-2 h-2 rounded-sm ${confidence >= thresh ? 'bg-emerald-500' : 'bg-white/15'}`}
              />
            ))}
          </div>
          <span className="text-white/40">{Math.round(confidence * 3)}/3 sources</span>
        </div>
      </div>
    </div>
  );
}
