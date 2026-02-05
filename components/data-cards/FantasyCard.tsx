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

  return (
    <BaseCard
      icon={TrendingUp}
      title={title}
      category={category}
      subcategory={subcategory}
      gradient={gradient}
      status={statusBadge}
      onAnalyze={onAnalyze}
      isLoading={isLoading}
      error={error}
    >
      <DataGrid data={data} empty="No fantasy insights available" />
    </BaseCard>
  );
}
