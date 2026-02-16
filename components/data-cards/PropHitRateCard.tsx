import { BaseCard } from './BaseCard';
import { TrendingUp, TrendingDown, Minus, Activity, BarChart } from 'lucide-react';

interface PropHitRateCardProps {
  playerName: string;
  statType: string;
  hitRatePercentage: number;
  totalGames: number;
  hits: number;
  misses: number;
  avgLine: number;
  avgActual: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low';
  recommendation: string;
  recentForm?: string;
}

export function PropHitRateCard({
  playerName,
  statType,
  hitRatePercentage,
  totalGames,
  hits,
  misses,
  avgLine,
  avgActual,
  trend,
  confidence,
  recommendation,
  recentForm
}: PropHitRateCardProps) {
  
  // Determine gradient based on hit rate
  const getGradient = () => {
    if (hitRatePercentage >= 65) return 'from-green-600 to-emerald-700';
    if (hitRatePercentage <= 35) return 'from-red-600 to-rose-700';
    return 'from-slate-600 to-gray-700';
  };
  
  // Determine status badge
  const getStatus = () => {
    if (confidence === 'low') return 'Limited Data';
    if (hitRatePercentage >= 65) return 'Strong Over';
    if (hitRatePercentage <= 35) return 'Strong Under';
    return 'Neutral';
  };
  
  const getStatusColor = () => {
    if (confidence === 'low') return 'bg-amber-500';
    if (hitRatePercentage >= 65) return 'bg-green-500';
    if (hitRatePercentage <= 35) return 'bg-red-500';
    return 'bg-gray-500';
  };
  
  // Trend icon
  const TrendIcon = trend === 'improving' ? TrendingUp : 
                     trend === 'declining' ? TrendingDown : 
                     trend === 'insufficient_data' ? Activity : Minus;

  const differential = avgActual - avgLine;
  
  return (
    <BaseCard
      title={`${playerName} - ${statType}`}
      icon={BarChart}
      category="PROP ANALYSIS"
      subcategory={getStatus()}
      gradient={getGradient()}
    >
      <div className="space-y-3">
        {/* Hit Rate Summary */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-foreground/60">Hit Rate</div>
            <div className="text-2xl font-bold text-foreground">
              {hitRatePercentage.toFixed(1)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-foreground/60">Sample Size</div>
            <div className="text-lg font-semibold text-foreground">
              {hits}/{totalGames} games
            </div>
          </div>
        </div>

        {/* Avg Line vs Actual */}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-background/30 p-3">
          <div>
            <div className="text-xs text-foreground/60">Avg Line</div>
            <div className="text-lg font-semibold text-foreground">{avgLine.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-xs text-foreground/60">Avg Actual</div>
            <div className="text-lg font-semibold text-foreground">{avgActual.toFixed(1)}</div>
          </div>
        </div>

        {/* Differential */}
        <div className="flex items-center justify-between rounded-lg bg-background/30 p-3">
          <span className="text-sm text-foreground/60">Differential</span>
          <span className={`text-sm font-semibold ${differential >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {differential >= 0 ? '+' : ''}{differential.toFixed(1)}
          </span>
        </div>

        {/* Trend */}
        <div className="flex items-center gap-2 rounded-lg bg-background/30 p-3">
          <TrendIcon className="h-4 w-4 text-foreground/60" />
          <span className="text-sm text-foreground/60">Trend:</span>
          <span className="text-sm font-medium text-foreground capitalize">{trend.replace('_', ' ')}</span>
        </div>

        {/* Recent Form */}
        {recentForm && (
          <div className="rounded-lg bg-background/30 p-3">
            <div className="text-xs text-foreground/60 mb-1">Recent Form</div>
            <div className="text-sm text-foreground">{recentForm}</div>
          </div>
        )}

        {/* Recommendation */}
        <div className="rounded-lg border border-foreground/20 p-3">
          <div className="text-xs font-medium text-foreground/60 mb-1">Recommendation</div>
          <div className="text-sm text-foreground leading-relaxed">{recommendation}</div>
        </div>

        {/* Confidence Indicator */}
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          <div className={`h-2 w-2 rounded-full ${
            confidence === 'high' ? 'bg-green-500' : 
            confidence === 'medium' ? 'bg-amber-500' : 
            'bg-red-500'
          }`} />
          <span>Confidence: {confidence.toUpperCase()}</span>
        </div>
      </div>
    </BaseCard>
  );
}
