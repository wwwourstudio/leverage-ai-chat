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

  // Extract known structured fields; remainder shown via DataGrid
  const { focus, targetGame, targetPlayers, description, platforms, tips, ...remainingData } = data as any;

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
      <div className="space-y-3.5">
        {/* Description / overview */}
        {(focus || description) && (
          <div className="pb-3.5 border-b border-gray-700/30">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 opacity-90">Focus</div>
            <div className="text-sm font-medium text-gray-200 leading-relaxed">{focus || description}</div>
          </div>
        )}

        {/* Target sections */}
        {targetGame && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Target game</div>
            <div className="text-[13px] font-semibold text-white leading-snug">{targetGame}</div>
          </div>
        )}

        {targetPlayers && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Target players</div>
            <div className="text-[13px] font-semibold text-white leading-snug">{targetPlayers}</div>
          </div>
        )}

        {/* Platforms */}
        {platforms && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Platforms</div>
            <div className="text-[13px] font-semibold text-white leading-snug">
              {Array.isArray(platforms) ? platforms.join(', ') : platforms}
            </div>
          </div>
        )}

        {/* Tips */}
        {tips && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Tips</div>
            <div className="text-[13px] text-gray-300 leading-snug">
              {Array.isArray(tips) ? tips.join(' · ') : tips}
            </div>
          </div>
        )}

        {/* Remaining data */}
        {Object.keys(remainingData).filter(k => !['realData', 'status'].includes(k)).length > 0 && (
          <div className="pt-2">
            <DataGrid data={Object.fromEntries(Object.entries(remainingData).filter(([k]) => !['realData', 'status'].includes(k))) as Record<string, string | number>} empty="" />
          </div>
        )}
      </div>
    </BaseCard>
  );
}
