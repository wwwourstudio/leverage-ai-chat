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
    <div
      className={cn(
        'relative rounded-2xl p-6 border',
        'bg-destructive/10 border-destructive/30',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-destructive">Error Loading Card</h3>
          <p className="text-xs text-destructive/70 mt-1 break-words">{error}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl p-6 border',
        'bg-card border-border/50',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-3 text-muted-foreground">
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
    return (
      <ErrorState
        error="Missing required card data (title, category, or subcategory)"
        className={className}
      />
    );
  }

  const StatusIcon = status?.icon;

  return (
    <article
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden',
        'bg-card border border-border/60',
        'hover:border-border transition-all duration-300',
        'shadow-sm hover:shadow-md',
        className
      )}
    >
      {/* Top accent bar */}
      <div
        className={cn('h-1 w-full bg-gradient-to-r', gradient)}
        aria-hidden="true"
      />

      <div className="px-5 pt-4 pb-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'p-2 rounded-lg bg-gradient-to-br shrink-0',
                gradient
              )}
              aria-hidden="true"
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {category}
                </span>
                <span className="text-muted-foreground/40" aria-hidden="true">/</span>
                <span className="text-[11px] font-medium text-muted-foreground/70 truncate">
                  {subcategory}
                </span>
              </div>
              <h3 className="text-base font-bold text-card-foreground leading-tight mt-1 text-balance">
                {title}
              </h3>
            </div>
          </div>

          {status && StatusIcon && (
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0',
                status.bg,
                status.border
              )}
              role="status"
            >
              <StatusIcon className={cn('w-3 h-3', status.text)} aria-hidden="true" />
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', status.text)}>
                {status.label}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="relative">{children}</div>

        {/* CTA */}
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className={cn(
              'flex items-center justify-center gap-2 w-full pt-3',
              'border-t border-border/40',
              'text-xs font-semibold text-muted-foreground hover:text-card-foreground',
              'transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg py-2'
            )}
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
