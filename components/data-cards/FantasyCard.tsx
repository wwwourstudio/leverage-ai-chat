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

  // Extract known structured fields; remainder shown via DataGrid
  const { focus, targetPlayers, targetPosition, description, tips, platforms, ...remainingData } = data as any;

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
      <div className="space-y-3.5">
        {/* Focus / description */}
        {(focus || description) && (
          <div className="pb-3.5 border-b border-gray-700/30">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 opacity-90">Focus</div>
            <div className="text-sm font-medium text-gray-200 leading-relaxed">{focus || description}</div>
          </div>
        )}

        {/* Target sections */}
        {targetPlayers && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Target players</div>
            <div className="text-[13px] font-semibold text-white leading-snug">{targetPlayers}</div>
          </div>
        )}

        {targetPosition && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Target position</div>
            <div className="text-[13px] font-semibold text-white leading-snug">{targetPosition}</div>
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

        {/* Platforms */}
        {platforms && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Platforms</div>
            <div className="text-[13px] font-semibold text-white leading-snug">
              {Array.isArray(platforms) ? platforms.join(', ') : platforms}
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
