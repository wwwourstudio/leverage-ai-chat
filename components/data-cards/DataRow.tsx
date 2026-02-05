'use client';

interface DataRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

export function DataRow({ label, value, highlight, trend }: DataRowProps) {
  const isMetric = typeof value === 'string' && (
    value.includes('%') || 
    value.includes('$') || 
    value.includes('pts') ||
    value.includes('↑') ||
    value.includes('↓')
  );
  
  // Format the label to be more readable
  const formattedLabel = label
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();

  let trendIcon = null;
  if (trend === 'up') {
    trendIcon = <span className="text-green-400">↑</span>;
  } else if (trend === 'down') {
    trendIcon = <span className="text-red-400">↓</span>;
  }

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-200 group/item">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 mr-4">
        {formattedLabel}
      </span>
      <span className={`text-sm font-bold text-right flex items-center gap-1.5 ${
        highlight || isMetric ? 'text-white' : 'text-gray-300'
      } group-hover/item:text-blue-300 transition-colors`}>
        {trendIcon}
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
      <div className="text-center py-6 text-gray-500 text-sm">
        {empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value], i) => (
        <DataRow key={i} label={key} value={value} />
      ))}
    </div>
  );
}
