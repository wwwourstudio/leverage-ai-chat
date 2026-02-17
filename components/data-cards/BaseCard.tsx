'use client';

import { ReactNode, memo } from 'react';
import { LucideIcon, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Type definitions for better type safety and clarity
interface StatusBadge {
  icon: LucideIcon;
  label: string;
  bg: string;
  border: string;
  text: string;
}

interface BaseCardProps {
  /** Icon component to display in the header */
  icon: LucideIcon;
  /** Main title of the card */
  title: string;
  /** Primary category label (e.g., "DFS", "BETTING") */
  category: string;
  /** Secondary category label (e.g., "Lineup Building") */
  subcategory: string;
  /** Tailwind gradient classes for theming */
  gradient: string;
  /** Optional status badge configuration */
  status?: StatusBadge;
  /** Card content */
  children?: ReactNode;
  /** Optional callback for analysis action */
  onAnalyze?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ErrorState - Displays error information in a styled container
 */
function ErrorState({ error, className }: { error: string; className?: string }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl p-6 backdrop-blur-xl border',
        'bg-linear-to-br from-red-950/40 to-red-900/30',
        'border-red-800/50 shadow-lg',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-red-300">
        <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-red-200">Error Loading Card</h3>
          <p className="text-xs text-red-400 mt-1 break-words">{error}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * LoadingState - Displays loading spinner and message
 */
function LoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl p-6 backdrop-blur-xl border',
        'bg-linear-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95',
        'border-gray-700/60 shadow-lg',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-3 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium">Loading data...</span>
      </div>
    </div>
  );
}

/**
 * CardHeader - Renders the icon, category, title, and status badge
 */
function CardHeader({
  icon: Icon,
  category,
  subcategory,
  title,
  gradient,
  status,
}: Pick<BaseCardProps, 'icon' | 'category' | 'subcategory' | 'title' | 'gradient' | 'status'>) {
  const StatusIcon = status?.icon;

  return (
    <div className="relative flex items-start justify-between mb-5">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        {/* Icon container with gradient background */}
        <div
          className={cn(
            'p-3 rounded-xl shadow-lg ring-4 shrink-0 transition-all',
            'bg-linear-to-br',
            gradient,
            'ring-gray-800/50 group-hover:ring-gray-700/50'
          )}
          aria-hidden="true"
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Category labels */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest truncate">
              {category}
            </span>
            <span className="text-gray-600 shrink-0" aria-hidden="true">
              •
            </span>
            <span className="text-xs font-medium text-gray-500 truncate">{subcategory}</span>
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-white leading-tight text-balance">{title}</h3>

          {/* Status badge */}
          {status && StatusIcon && (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1',
                'rounded-full border',
                status.bg,
                status.border
              )}
              role="status"
            >
              <StatusIcon className={cn('w-3.5 h-3.5', status.text)} aria-hidden="true" />
              <span className={cn('text-xs font-bold uppercase tracking-wide', status.text)}>
                {status.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * AnalyzeButton - Action button for detailed analysis
 */
function AnalyzeButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="relative mt-4 pt-4 border-t border-gray-700/50">
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center justify-center gap-2',
          'text-xs font-bold text-gray-400 hover:text-white',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900',
          'rounded-lg py-2'
        )}
        aria-label="View full analysis"
      >
        <span>View Full Analysis</span>
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
      </button>
    </div>
  );
}

/**
 * BaseCard - Reusable card component for displaying data insights
 * 
 * Features:
 * - Loading and error states
 * - Animated hover effects
 * - Category-specific theming via gradients
 * - Status badges
 * - Optional action button
 * - Fully accessible with ARIA attributes
 */
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
  // Early returns for loading and error states
  if (error) {
    return <ErrorState error={error} className={className} />;
  }

  if (isLoading) {
    return <LoadingState className={className} />;
  }

  // Validate required data
  if (!title || !category || !subcategory) {
    return (
      <ErrorState
        error="Missing required card data (title, category, or subcategory)"
        className={className}
      />
    );
  }

  return (
    <article
      className={cn(
        'group relative rounded-2xl p-5 backdrop-blur-xl border shadow-xl overflow-hidden',
        'bg-linear-to-br from-gray-900/98 via-gray-850/98 to-gray-900/98',
        'border-gray-700/50 hover:border-gray-500/70',
        'transition-all duration-300',
        'hover:shadow-2xl hover:shadow-gray-950/50',
        className
      )}
    >
      {/* Animated gradient overlay on hover */}
      <div
        className={cn(
          'absolute inset-0 bg-linear-to-br opacity-0 transition-opacity duration-700',
          'group-hover:opacity-10',
          gradient
        )}
        aria-hidden="true"
      />

      {/* Accent line on left edge */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b transition-opacity',
          'opacity-60 group-hover:opacity-100',
          gradient
        )}
        aria-hidden="true"
      />

      {/* Card Header */}
      <CardHeader
        icon={Icon}
        category={category}
        subcategory={subcategory}
        title={title}
        gradient={gradient}
        status={status}
      />

      {/* Card Content */}
      <div className="relative mt-1">{children}</div>

      {/* Optional Action Button */}
      {onAnalyze && <AnalyzeButton onClick={onAnalyze} />}
    </article>
  );
});
