'use client';

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface DataRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

export function DataRow({ label, value, highlight, trend }: DataRowProps) {
  const formattedLabel = label
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[oklch(0.10_0.01_280)] hover:bg-[oklch(0.12_0.012_280)] transition-colors">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[oklch(0.45_0.01_280)] shrink-0 mr-4">
        {formattedLabel}
      </span>
      <span
        className={`text-sm font-bold text-right flex items-center gap-1 tabular-nums ${
          highlight ? 'text-[oklch(0.92_0.005_85)]' : 'text-[oklch(0.75_0.005_85)]'
        }`}
      >
        {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-400" />}
        {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-400" />}
        {String(value || 'N/A')}
      </span>
    </div>
  );
}

interface DataGridProps {
  data: Record<string, string | number>;
  empty?: string;
}

export function DataGrid({ data, empty = 'No data available' }: DataGridProps) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-[oklch(0.45_0.01_280)] text-sm">{empty}</div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([label, value], i) => (
        <DataRow key={i} label={label} value={value} />
      ))}
    </div>
  );
}
