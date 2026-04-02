'use client';

import { AlertCircle, Info, Search } from 'lucide-react';

interface NoDataCardProps {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'search';
  compact?: boolean;
  className?: string;
}

export function NoDataCard({ 
  title,
  message,
  type = 'info',
  compact = false,
  className = ''
}: NoDataCardProps) {
  const iconConfig = {
    info: { icon: Info, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30' },
    warning: { icon: AlertCircle, color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-600/20', border: 'border-orange-500/30' },
    search: { icon: Search, color: 'text-[var(--text-muted)]', bg: 'from-gray-500/20 to-gray-600/20', border: 'border-gray-500/30' },
  };

  const config = iconConfig[type];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={`p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] ${className}`}>
        <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
          <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
          <span>{message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-gradient-to-br from-[var(--bg-overlay)] to-[var(--bg-overlay)] backdrop-blur-xl rounded-2xl p-6 border border-[var(--border-subtle)] shadow-lg overflow-hidden ${className}`}>
      {/* Subtle background glow */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.2),transparent_50%)]" />
      </div>
      
      <div className="relative flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.bg} border ${config.border} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
        </div>
        
        <div className="flex-1 min-w-0 pt-1">
          {title && (
            <h4 className="text-sm font-bold text-white mb-1.5">
              {title}
            </h4>
          )}
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
