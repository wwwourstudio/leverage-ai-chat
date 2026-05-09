'use client';

import { memo } from 'react';
import {
  Zap, DollarSign, Award, CheckCircle, Target, Medal,
  Flame, BarChart3, TrendingUp, TrendingDown, Sparkles,
} from 'lucide-react';

export interface InsightCard {
  type: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, string | number>;
  status: string;
  realData?: boolean;
}

const STATUS_BADGES: Record<string, {
  bg: string; text: string; border: string;
  icon: React.ComponentType<{ className?: string }>; label: string;
}> = {
  hot:         { bg: 'bg-red-500/20',    text: 'text-red-400',    border: 'border-red-500/30',    icon: Flame,       label: 'HOT' },
  value:       { bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/30',   icon: DollarSign,  label: 'VALUE' },
  optimal:     { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: Award,       label: 'OPTIMAL' },
  strong:      { bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/30',   icon: CheckCircle, label: 'STRONG' },
  target:      { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', icon: Target,      label: 'TARGET' },
  elite:       { bg: 'bg-purple-600/20', text: 'text-purple-300', border: 'border-purple-600/30', icon: Medal,       label: 'ELITE' },
  sleeper:     { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', icon: Zap,         label: 'SLEEPER' },
  opportunity: { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   border: 'border-cyan-500/30',   icon: BarChart3,   label: 'OPPORTUNITY' },
  edge:        { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: TrendingUp,  label: 'EDGE' },
  synergy:     { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', icon: Sparkles,    label: 'SYNERGY' },
};

interface Props {
  card: InsightCard;
  index: number;
}

export const InsightCardItem = memo(function InsightCardItem({ card, index }: Props) {
  if (!card || typeof card !== 'object') return null;

  const safeCard = {
    icon:        card.icon       || Zap,
    status:      card.status     || 'active',
    gradient:    card.gradient   || 'from-blue-500 to-purple-500',
    category:    card.category   || 'General',
    subcategory: card.subcategory || 'Info',
    title:       card.title      || 'Untitled Card',
    data:        card.data && typeof card.data === 'object' ? card.data : {},
    type:        card.type       || 'default',
  };

  const Icon = safeCard.icon;
  const badge = STATUS_BADGES[safeCard.status] ?? STATUS_BADGES.value;
  const BadgeIcon = badge.icon;
  const dataEntries = Object.entries(safeCard.data);

  return (
    <div
      key={`card-${index}-${safeCard.type}`}
      className="group relative bg-gradient-to-br from-[var(--bg-overlay)] to-[var(--bg-overlay)] backdrop-blur-xl rounded-2xl p-6 border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-all duration-500 shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] hover:scale-[1.02] overflow-hidden"
    >
      {/* Animated gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${safeCard.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-700`} />

      {/* Accent line on left */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${safeCard.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />

      {/* Header */}
      <div className="relative flex items-start justify-between mb-5">
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${safeCard.gradient} shadow-lg ring-4 ring-gray-800/50 group-hover:ring-gray-700/50 transition-all`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{safeCard.category}</span>
              <span className="text-[var(--text-faint)]">•</span>
              <span className="text-xs font-medium text-[var(--text-faint)]">{safeCard.subcategory}</span>
            </div>
            <h3 className="text-base font-bold text-white leading-tight mb-1">{safeCard.title}</h3>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border}`}>
              <BadgeIcon className={`w-3.5 h-3.5 ${badge.text}`} />
              <span className={`text-xs font-bold ${badge.text} uppercase tracking-wide`}>{badge.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data grid */}
      <div className="relative space-y-2">
        {dataEntries.length > 0 ? (
          dataEntries.map(([key, value], i) => {
            const formattedKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, s => s.toUpperCase())
              .trim();

            const valueStr = String(value);
            const isUpTrend   = valueStr.includes('↑') || valueStr.toLowerCase().includes('up');
            const isDownTrend = valueStr.includes('↓') || valueStr.toLowerCase().includes('down');
            const isHighValue = valueStr.includes('elite') || valueStr.includes('optimal');
            const isDollar    = valueStr.includes('$');
            const isPercent   = valueStr.includes('%');

            let valueColor = 'text-foreground/80';
            if      (isUpTrend)            valueColor = 'text-blue-400';
            else if (isDownTrend)          valueColor = 'text-red-400';
            else if (isHighValue)          valueColor = 'text-purple-400';
            else if (isDollar || isPercent) valueColor = 'text-blue-400';

            return (
              <div key={i} className="group/item relative">
                <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-gradient-to-r from-[var(--bg-elevated)]/40 to-[var(--bg-elevated)]/20 hover:from-[var(--bg-elevated)]/60 hover:to-[var(--bg-elevated)]/40 transition-all duration-200 border border-[var(--border-subtle)] hover:border-[var(--border-hover)]/50">
                  <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex-shrink-0 mr-4">
                    {formattedKey}
                  </span>
                  <span className={`text-sm font-extrabold text-right ${valueColor} group-hover/item:scale-105 transition-transform flex items-center gap-1.5`}>
                    {isUpTrend   && <TrendingUp   className="w-3.5 h-3.5" />}
                    {isDownTrend && <TrendingDown  className="w-3.5 h-3.5" />}
                    {valueStr || 'N/A'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6 text-[var(--text-faint)] text-sm font-medium">
            No data available
          </div>
        )}
      </div>
    </div>
  );
});
