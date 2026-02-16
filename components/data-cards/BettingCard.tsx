'use client';

import { Zap, TrendingUp, Target, Activity } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataRow } from './DataRow';

interface BettingCardData {
  matchup?: string;
  bestLine?: string;
  book?: string;
  edge?: string;
  movement?: string;
  confidence?: number;
  gameTime?: string;
  marketEfficiency?: string;
  team?: string;
  line?: string;
  impliedWin?: string;
  recommendation?: string;
  odds?: string;
  impliedProb?: string;
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
        {data.matchup && <DataRow label="Matchup" value={data.matchup} highlight />}
        {data.team && <DataRow label="Team" value={data.team} highlight />}
        {data.finalScore && <DataRow label="Final" value={data.finalScore} highlight />}
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
        {data.odds && <DataRow label="Odds" value={data.odds} />}
        {data.book && <DataRow label="Book" value={data.book} />}
        {data.bookmaker && !data.book && <DataRow label="Book" value={data.bookmaker} />}
        {data.edge && <DataRow label="Edge" value={data.edge} trend="up" />}
        {data.impliedWin && <DataRow label="Implied Win" value={data.impliedWin} />}
        {data.impliedProb && <DataRow label="Implied Prob" value={data.impliedProb} />}
        {data.movement && <DataRow label="Line Movement" value={data.movement} />}
        {data.confidence !== undefined && <DataRow label="Confidence" value={`${data.confidence}%`} />}
        {data.marketEfficiency && <DataRow label="Market Efficiency" value={data.marketEfficiency} />}
        {data.recommendation && <DataRow label="Recommendation" value={data.recommendation} />}
        {data.gameTime && <DataRow label="Game Time" value={data.gameTime} />}
      </div>
    </BaseCard>
  );
}
