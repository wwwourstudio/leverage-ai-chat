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
  isHero?: boolean;
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
    <div className={cn('relative rounded-2xl p-6 border bg-background border-[var(--border-subtle)]', className)} role="status" aria-live="polite">
      <div className="flex items-center justify-center gap-3 text-[var(--text-muted)]">
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
  isHero = false,
}: BaseCardProps) {
  if (error) return <ErrorState error={error} className={className} />;
  if (isLoading) return <LoadingState className={className} />;

  if (!title || !category || !subcategory) {
    return <ErrorState error="Missing required card data" className={className} />;
  }

  const StatusIcon = status?.icon;

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-background border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-[0_0_40px_oklch(0.4_0.12_240/0.12)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 transition-all duration-200 animate-fade-in-up',
      isHero && 'border-[var(--border-hover)] shadow-[0_0_24px_oklch(0.3_0.08_260/0.15)]',
      className,
    )}>
      <div className={cn('absolute left-0 top-0 bottom-0 bg-gradient-to-b', isHero ? 'w-[3px]' : 'w-1', gradient)} aria-hidden="true" />

      <div className={cn('pl-5 pr-4 space-y-4', isHero ? 'py-5 sm:pl-7 sm:pr-6 sm:py-6' : 'py-4 sm:pl-6 sm:pr-5 sm:py-5')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('rounded-lg bg-gradient-to-br shrink-0', isHero ? 'p-2.5' : 'p-2', gradient)} aria-hidden="true">
              <Icon className={cn('text-white', isHero ? 'w-5 h-5' : 'w-4 h-4')} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{category}</span>
                <span className="text-[var(--text-faint)]" aria-hidden="true">/</span>
                <span className="text-[11px] font-medium text-[var(--text-faint)] truncate">{subcategory}</span>
              </div>
              <h3 className={cn('font-bold text-foreground leading-tight mt-1 text-balance', isHero ? 'text-lg' : 'text-base')}>{title}</h3>
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
            className="flex items-center justify-center gap-2 w-full pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2"
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
