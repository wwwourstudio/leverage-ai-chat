'use client';

interface StatCardProps {
  label: string;
  value: string | number;
  gradient?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ label, value, gradient = 'from-[var(--bg-elevated)] to-[var(--bg-overlay)]', trend }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-[var(--text-muted)]';
  
  return (
    <div className={`relative bg-gradient-to-br ${gradient} backdrop-blur-sm rounded-xl p-4 border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all duration-300 overflow-hidden group`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">{label}</div>
        <div className={`text-2xl font-bold ${trendColor}`}>{value}</div>
      </div>
    </div>
  );
}

interface StatsSummaryProps {
  totalValue?: string | number;
  winRate?: string | number;
  roi?: string | number;
  active?: string | number;
  className?: string;
}

export function StatsSummary({
  totalValue = '$0.00',
  winRate = '0%',
  roi = '+0%',
  active = 0,
  className = ''
}: StatsSummaryProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 ${className}`}>
      <StatCard 
        label="Total Value" 
        value={totalValue} 
        gradient="from-emerald-950/60 to-emerald-900/40"
        trend="up"
      />
      <StatCard 
        label="Win Rate" 
        value={winRate} 
        gradient="from-blue-950/60 to-blue-900/40"
        trend="neutral"
      />
      <StatCard 
        label="ROI" 
        value={roi} 
        gradient="from-purple-950/60 to-purple-900/40"
        trend={String(roi).startsWith('+') ? 'up' : 'neutral'}
      />
      <StatCard 
        label="Active" 
        value={active} 
        gradient="from-orange-950/60 to-orange-900/40"
        trend="neutral"
      />
    </div>
  );
}
