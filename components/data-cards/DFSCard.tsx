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
      <DataGrid data={data} empty="No DFS data available for this slate" />
    </BaseCard>
  );
}
