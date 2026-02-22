'use client';

import { ReactNode, memo } from 'react';
import { LucideIcon, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadge {
  icon: LucideIcon;
  label: string;
  bg: string;
  border: string;
  text: string;
}

interface BaseCardProps {
  icon: LucideIcon;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  status?: StatusBadge;
  children?: ReactNode;
  onAnalyze?: () => void;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

function ErrorState({ error, className }: { error: string; className?: string }) {
  return (
    <div className={cn('relative rounded-2xl p-6 border bg-red-500/10 border-red-500/20', className)} role="alert" aria-live="polite">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-red-400">Error Loading Card</h3>
          <p className="text-xs text-red-400/70 mt-1 break-words">{error}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState({ className }: { className?: string }) {
  return (
    <div className={cn('relative rounded-2xl p-6 border bg-[oklch(0.13_0.015_280)] border-[oklch(0.22_0.02_280)]', className)} role="status" aria-live="polite">
      <div className="flex items-center justify-center gap-3 text-[oklch(0.50_0.01_280)]">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium">Loading data...</span>
      </div>
    </div>
  );
}

export const BaseCard = memo(function BaseCard({
  icon: Icon,
  title,
  category,
  subcategory,
  gradient,
  status,
  children,
  onAnalyze,
  isLoading = false,
  error,
  className,
}: BaseCardProps) {
  if (error) return <ErrorState error={error} className={className} />;
  if (isLoading) return <LoadingState className={className} />;

  if (!title || !category || !subcategory) {
    return <ErrorState error="Missing required card data" className={className} />;
  }

  const StatusIcon = status?.icon;

  return (
    <article className={cn('group relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border border-[oklch(0.22_0.02_280)] hover:border-[oklch(0.30_0.02_280)] transition-all duration-200', className)}>
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b', gradient)} aria-hidden="true" />

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('p-2 rounded-lg bg-gradient-to-br shrink-0', gradient)} aria-hidden="true">
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[oklch(0.55_0.01_280)]">{category}</span>
                <span className="text-[oklch(0.3_0.01_280)]" aria-hidden="true">/</span>
                <span className="text-[11px] font-medium text-[oklch(0.45_0.01_280)] truncate">{subcategory}</span>
              </div>
              <h3 className="text-base font-bold text-[oklch(0.95_0.005_85)] leading-tight mt-1 text-balance">{title}</h3>
            </div>
          </div>

          {status && StatusIcon && (
            <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0', status.bg, status.border)} role="status">
              <StatusIcon className={cn('w-3 h-3', status.text)} aria-hidden="true" />
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', status.text)}>{status.label}</span>
            </div>
          )}
        </div>

        <div className="relative">{children}</div>

        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="flex items-center justify-center gap-2 w-full pt-3 border-t border-[oklch(0.20_0.015_280)] text-xs font-semibold text-[oklch(0.50_0.01_280)] hover:text-[oklch(0.85_0.005_85)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
            aria-label={`View full analysis for ${title}`}
          >
            View Full Analysis
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </article>
  );
});
