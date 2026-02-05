'use client';

import { BarChart3, Activity, Sparkles } from 'lucide-react';
import { BaseCard } from './BaseCard';
import { DataGrid } from './DataRow';

interface KalshiCardProps {
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
  opportunity: { icon: BarChart3, label: 'OPPORTUNITY', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  edge: { icon: Activity, label: 'EDGE', bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
  synergy: { icon: Sparkles, label: 'SYNERGY', bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400' },
};

export function KalshiCard({
  title,
  category,
  subcategory,
  gradient,
  data,
  status,
  onAnalyze,
  isLoading,
  error
}: KalshiCardProps) {
  const statusBadge = statusMap[status] || statusMap.opportunity;

  // Extract focus and other structured data
  const { focus, targetMarket, inefficiencies, ...remainingData } = data as any;

  return (
    <BaseCard
      icon={BarChart3}
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
        {/* Focus section */}
        {focus && (
          <div className="pb-3.5 border-b border-gray-700/30">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 opacity-90">Focus</div>
            <div className="text-sm font-medium text-gray-200 leading-relaxed">{focus}</div>
          </div>
        )}
        
        {/* Target sections */}
        {targetMarket && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Target market</div>
            <div className="text-[13px] font-semibold text-white leading-snug">{targetMarket}</div>
          </div>
        )}
        
        {inefficiencies && (
          <div className="pb-2.5">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 opacity-90">Market inefficiencies</div>
            <div className="text-[13px] font-semibold text-white leading-snug">{inefficiencies}</div>
          </div>
        )}
        
        {/* Remaining data */}
        {Object.keys(remainingData).length > 0 && (
          <div className="pt-2">
            <DataGrid data={remainingData} empty="" />
          </div>
        )}
      </div>
    </BaseCard>
  );
}
