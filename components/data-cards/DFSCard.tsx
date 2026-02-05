'use client';

import { Award, Trophy, Medal } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataGrid } from './DataRow';

interface DFSCardProps {
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
  optimal: { icon: Award, label: 'OPTIMAL', bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
  value: { icon: Trophy, label: 'VALUE', bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
  elite: { icon: Medal, label: 'ELITE', bg: 'bg-purple-600/20', border: 'border-purple-600/30', text: 'text-purple-300' },
};

export function DFSCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isLoading,
  error
}: DFSCardProps) {
  const statusBadge = statusMap[status] || statusMap.value;

  // Extract focus and other structured data
  const { focus, targetGame, targetPlayers, ...remainingData } = data as any;

  return (
    <BaseCard
      icon={Award}
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
        {targetGame && (
          <div className="pb-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Target game</div>
            <div className="text-sm font-medium text-white">{targetGame}</div>
          </div>
        )}
        
        {targetPlayers && (
          <div className="pb-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Target players</div>
            <div className="text-sm font-medium text-white">{targetPlayers}</div>
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
