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
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0 mr-4">
        {formattedLabel}
      </span>
      <span
        className={`text-sm font-bold text-right flex items-center gap-1 tabular-nums ${
          highlight ? 'text-card-foreground' : 'text-card-foreground/80'
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
      <div className="text-center py-6 text-muted-foreground text-sm">{empty}</div>
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
