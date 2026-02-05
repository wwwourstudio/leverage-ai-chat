'use client';

import { TrendingUp, Target, Trophy } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataGrid } from './DataRow';

interface FantasyCardProps {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, string | number>;
  status: string;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
}

const statusMap: Record<string, any> = {
  target: { icon: Target, label: 'TARGET', bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400' },
  value: { icon: TrendingUp, label: 'VALUE', bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
  sleeper: { icon: Trophy, label: 'SLEEPER', bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400' },
};

export function FantasyCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isLoading,
  error
}: FantasyCardProps) {
  const statusBadge = statusMap[status] || statusMap.value;

  // Extract focus and other structured data
  const { focus, targetPlayers, targetPosition, ...remainingData } = data as any;

  return (
    <BaseCard
      icon={Trophy}
      title={title}
      category={category}
      subcategory={subcategory}
      gradient={gradient}
      status={statusBadge}
      onAnalyze={onAnalyze}
      isLoading={isLoading}
      error={error}
    >
      <div className="space-y-4">
        {/* Focus section */}
        {focus && (
          <div className="pb-3 border-b border-gray-700/40">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Focus</div>
            <div className="text-sm font-medium text-gray-200 leading-relaxed">{focus}</div>
          </div>
        )}
        
        {/* Target sections */}
        {targetPlayers && (
          <div className="pb-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Target players</div>
            <div className="text-sm font-medium text-white">{targetPlayers}</div>
          </div>
        )}
        
        {targetPosition && (
          <div className="pb-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Target position</div>
            <div className="text-sm font-medium text-white">{targetPosition}</div>
          </div>
        )}
        
        {/* Remaining data */}
        {Object.keys(remainingData).length > 0 && (
          <DataGrid data={remainingData} empty="" />
        )}
      </div>
    </BaseCard>
  );
}
