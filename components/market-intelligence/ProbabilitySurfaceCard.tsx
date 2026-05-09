'use client';

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
  { key: 'sportsbook',         label: 'Sportsbooks', color: 'bg-blue-500',    dotColor: 'bg-blue-400'    },
  { key: 'prediction_market',  label: 'Kalshi',      color: 'bg-fuchsia-500', dotColor: 'bg-fuchsia-400' },
  { key: 'historical',         label: 'Historical',  color: 'bg-violet-500',  dotColor: 'bg-violet-400'  },
] as const;

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function probColor(prob: number): string {
  if (prob >= 0.65) return 'text-emerald-400';
  if (prob >= 0.45) return 'text-amber-400';
  return 'text-red-400';
}

function confidenceLabel(c: number): string {
  if (c >= 0.9) return 'HIGH';
  if (c >= 0.6) return 'MED';
  return 'LOW';
}

function confidenceColor(c: number): string {
  if (c >= 0.9) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  if (c >= 0.6) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
  return 'text-red-400 bg-red-500/10 border-red-500/25';
}

export function ProbabilitySurfaceCard({ surfaceProbability, components, weights, confidence }: Props) {
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

  const surfacePct = Math.round(surfaceProbability * 100);

  return (
    <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 space-y-3">
      {/* Hero probability */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-faint)] mb-0.5">Bayesian Surface</p>
          <p className={`text-2xl font-black tabular-nums ${probColor(surfaceProbability)}`}>
            {surfacePct}%
          </p>
        </div>
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${confidenceColor(confidence)}`}>
          {confidenceLabel(confidence)} CONF
        </span>
      </div>

      {/* Component bars */}
      <div className="space-y-2">
        {bars.map(bar => (
          <div key={bar.key}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${bar.dotColor}`} />
                <span className="text-[10px] text-[var(--text-muted)]">{bar.label}</span>
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-[var(--text-muted)]">
                {pct(bar.value)} <span className="text-[var(--text-faint)]">× {Math.round(bar.normalizedWeight * 100)}%</span>
              </span>
            </div>
            <div className="relative h-1.5 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full rounded-full ${bar.color} transition-all duration-700`}
                style={{ width: `${bar.value * 100}%`, opacity: 0.6 + bar.normalizedWeight * 0.4 }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Confidence dots */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
        <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-wide">Data sources</span>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            {[0.33, 0.66, 1.0].map(thresh => (
              <div
                key={thresh}
                className={`w-2 h-2 rounded-sm transition-colors ${confidence >= thresh ? 'bg-blue-500' : 'bg-[var(--bg-overlay)]'}`}
              />
            ))}
          </div>
          <span className="text-[9px] text-[var(--text-faint)]">{Math.round(confidence * 3)}/3</span>
        </div>
      </div>
    </div>
  );
}
