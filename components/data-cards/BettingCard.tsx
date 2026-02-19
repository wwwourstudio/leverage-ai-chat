'use client';

import { Zap, TrendingUp, Target, Activity } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataRow } from './DataRow';

interface BettingCardData {
  // Core betting fields
  matchup?: string;
  game?: string;
  team?: string;
  finalScore?: string;
  homeOdds?: string;
  awayOdds?: string;
  homeSpread?: string;
  overUnder?: string;
  bestLine?: string;
  line?: string;
  over?: string;
  under?: string;
  odds?: string;
  book?: string;
  bookmaker?: string;
  edge?: string;
  impliedWin?: string;
  impliedProb?: string;
  movement?: string;
  confidence?: number | string;
  marketEfficiency?: string;
  recommendation?: string;
  gameTime?: string;
  // Player prop fields
  player?: string;
  stat?: string;
  // Line movement fields
  lineChange?: string;
  oldLine?: string;
  newLine?: string;
  direction?: string;
  sharpMoney?: string;
  timestamp?: string;
  // Kelly / portfolio fields
  kellyFraction?: string;
  recommendedStake?: string;
  expectedValue?: string;
  totalBankroll?: string;
  deployed?: string;
  available?: string;
  utilizationRate?: string;
  activeBets?: number | string;
  // Informational / fallback fields
  description?: string;
  note?: string;
  [key: string]: any;
}

interface BettingCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: BettingCardData;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
}

const statusMap: Record<string, any> = {
  hot: { icon: Zap, label: 'HOT', bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' },
  value: { icon: TrendingUp, label: 'VALUE', bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
  optimal: { icon: Target, label: 'OPTIMAL', bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
  edge: { icon: Activity, label: 'EDGE', bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
};

export function BettingCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isLoading,
  error
}: BettingCardProps) {
  const statusBadge = statusMap[status] || statusMap.value;

  return (
    <BaseCard
      icon={Zap}
      title={title}
      category={category}
      subcategory={subcategory}
      gradient={gradient}
      status={statusBadge}
      onAnalyze={onAnalyze}
      isLoading={isLoading}
      error={error}
    >
      <div className="space-y-2.5">
        {/* Description / overview for informational cards */}
        {data.description && (
          <div className="pb-2.5 border-b border-gray-700/30 text-sm text-gray-300 leading-relaxed">
            {data.description}
          </div>
        )}

        {/* Core matchup / player */}
        {data.matchup && <DataRow label="Matchup" value={data.matchup} highlight />}
        {data.game && !data.matchup && <DataRow label="Game" value={data.game} highlight />}
        {data.player && <DataRow label="Player" value={data.player} highlight />}
        {data.team && <DataRow label="Team" value={data.team} highlight />}
        {data.finalScore && <DataRow label="Final" value={data.finalScore} highlight />}
        {data.stat && <DataRow label="Stat" value={data.stat} />}

        {/* Betting odds */}
        {data.homeOdds && data.awayOdds && (
          <DataRow label="Moneyline" value={`Home ${data.homeOdds} / Away ${data.awayOdds}`} />
        )}
        {data.homeSpread && data.homeSpread !== 'N/A' && (
          <DataRow label="Spread" value={`${data.homeSpread}`} />
        )}
        {data.overUnder && data.overUnder !== 'N/A' && (
          <DataRow label="Total" value={data.overUnder} />
        )}
        {data.bestLine && <DataRow label="Best Line" value={data.bestLine} />}
        {data.line && <DataRow label="Line" value={data.line} />}
        {data.over && <DataRow label="Over" value={data.over} />}
        {data.under && <DataRow label="Under" value={data.under} />}
        {data.odds && <DataRow label="Odds" value={data.odds} />}
        {data.book && <DataRow label="Book" value={data.book} />}
        {data.bookmaker && !data.book && <DataRow label="Book" value={data.bookmaker} />}
        {data.edge && <DataRow label="Edge" value={data.edge} trend="up" />}
        {data.impliedWin && <DataRow label="Implied Win" value={data.impliedWin} />}
        {data.impliedProb && <DataRow label="Implied Prob" value={data.impliedProb} />}
        {data.movement && <DataRow label="Line Movement" value={data.movement} />}
        {data.confidence !== undefined && (
          typeof data.confidence === 'number'
            ? <DataRow label="Confidence" value={`${data.confidence}%`} />
            : typeof data.confidence === 'string' && data.confidence
              ? <DataRow label="Confidence" value={data.confidence} />
              : null
        )}
        {data.marketEfficiency && <DataRow label="Market Efficiency" value={data.marketEfficiency} />}
        {data.recommendation && <DataRow label="Recommendation" value={data.recommendation} />}

        {/* Line movement fields */}
        {data.lineChange && <DataRow label="Line Change" value={data.lineChange} trend="up" highlight />}
        {data.oldLine && <DataRow label="Previous Line" value={data.oldLine} />}
        {data.newLine && <DataRow label="New Line" value={data.newLine} />}
        {data.direction && <DataRow label="Direction" value={data.direction} />}
        {data.sharpMoney && <DataRow label="Sharp Money" value={data.sharpMoney} />}

        {/* Kelly / sizing fields */}
        {data.kellyFraction && <DataRow label="Kelly Fraction" value={data.kellyFraction} highlight />}
        {data.recommendedStake && <DataRow label="Rec. Stake" value={data.recommendedStake} />}
        {data.expectedValue && <DataRow label="Expected Value" value={data.expectedValue} trend="up" />}

        {/* Portfolio fields */}
        {data.totalBankroll && <DataRow label="Bankroll" value={data.totalBankroll} highlight />}
        {data.deployed && <DataRow label="Deployed" value={data.deployed} />}
        {data.available && <DataRow label="Available" value={data.available} />}
        {data.utilizationRate && <DataRow label="Utilization" value={data.utilizationRate} />}
        {data.activeBets !== undefined && data.activeBets !== null && (
          <DataRow label="Active Bets" value={String(data.activeBets)} />
        )}

        {/* Timing */}
        {data.gameTime && <DataRow label="Game Time" value={data.gameTime} />}
        {data.timestamp && !data.gameTime && <DataRow label="Updated" value={data.timestamp} />}

        {/* Note */}
        {data.note && <DataRow label="Note" value={data.note} />}
      </div>
    </BaseCard>
  );
}
