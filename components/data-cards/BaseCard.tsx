'use client';

import { ReactNode } from 'react';
import { LucideIcon, AlertCircle, Loader2 } from 'lucide-react';

interface BaseCardProps {
  icon: LucideIcon;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  status?: {
    icon: LucideIcon;
    label: string;
    bg: string;
    border: string;
    text: string;
  };
  children: ReactNode;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export function BaseCard({
  icon: Icon,
  title,
  category,
  subcategory,
  gradient,
  status,
  children,
  onAnalyze,
  isLoading,
  error,
  className = ''
}: BaseCardProps) {
  if (error) {
    return (
      <div className={`relative bg-gradient-to-br from-red-950/40 to-red-900/30 backdrop-blur-xl rounded-2xl p-6 border border-red-800/50 ${className}`}>
        <div className="flex items-center gap-3 text-red-300">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-red-200">Error Loading Card</h3>
            <p className="text-xs text-red-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`relative bg-gradient-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/60 ${className}`}>
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Loading data...</span>
        </div>
      </div>
    );
  }

  const StatusIcon = status?.icon;

  return (
    <div className={`group relative bg-gradient-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/60 hover:border-gray-500/80 transition-all duration-500 shadow-2xl hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] hover:scale-[1.02] overflow-hidden ${className}`}>
      {/* Animated gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-700`} />
      
      {/* Accent line on left */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
      
      {/* Header section with icon and title */}
      <div className="relative flex items-start justify-between mb-5">
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg ring-4 ring-gray-800/50 group-hover:ring-gray-700/50 transition-all flex-shrink-0`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest truncate">{category}</span>
              <span className="text-gray-600 flex-shrink-0">•</span>
              <span className="text-xs font-medium text-gray-500 truncate">{subcategory}</span>
            </div>
            <h3 className="text-base font-bold text-white leading-tight mb-1 text-balance">{title}</h3>
            {status && StatusIcon && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${status.bg} ${status.border}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${status.text}`} />
                <span className={`text-xs font-bold ${status.text} uppercase tracking-wide`}>{status.label}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Content area */}
      <div className="relative">
        {children}
      </div>

      {/* Action button */}
      {onAnalyze && (
        <div className="relative mt-4 pt-4 border-t border-gray-700/50">
          <button 
            onClick={onAnalyze}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors group/btn"
          >
            <span>View Full Analysis</span>
            <svg className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
