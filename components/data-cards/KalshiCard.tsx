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
      <DataGrid data={data} empty="No Kalshi market data available" />
    </BaseCard>
  );
}
