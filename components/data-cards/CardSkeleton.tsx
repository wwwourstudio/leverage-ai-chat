'use client';

export function CardSkeleton() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-background border border-[var(--border-subtle)]">
      {/* Full-bleed gradient header — matches real card header height and structure */}
      <div className="relative px-4 pt-3.5 pb-3 bg-[var(--bg-surface)] overflow-hidden">
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/4 to-transparent animate-shimmer" />
        {/* Status badge row: breadcrumb left + badge right */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-14 bg-[var(--bg-elevated)] rounded animate-pulse" />
            <div className="h-2 w-20 bg-[var(--bg-elevated)] rounded animate-pulse" />
          </div>
          <div className="h-4 w-14 bg-[var(--bg-elevated)] rounded-full animate-pulse" />
        </div>
        {/* Title line */}
        <div className="h-4 w-2/3 bg-[var(--bg-elevated)] rounded animate-pulse mt-1" />
        {/* Sub-title line */}
        <div className="h-3 w-1/3 bg-[var(--border-subtle)] rounded animate-pulse mt-1.5" />
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {/* Team matchup block — logo / VS / logo */}
        <div className="flex items-center gap-4 px-2 py-3 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
          {/* Away team */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div className="w-11 h-11 rounded-xl bg-[var(--bg-surface)] animate-pulse" />
            <div className="h-2.5 w-16 bg-[var(--bg-surface)] rounded animate-pulse" />
            <div className="h-5 w-10 bg-[var(--bg-elevated)] rounded animate-pulse" />
          </div>
          {/* VS divider */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="h-3 w-6 bg-[var(--bg-surface)] rounded animate-pulse" />
            <div className="h-2.5 w-12 bg-[var(--bg-surface)] rounded animate-pulse" />
          </div>
          {/* Home team */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div className="w-11 h-11 rounded-xl bg-[var(--bg-surface)] animate-pulse" style={{ animationDelay: '80ms' }} />
            <div className="h-2.5 w-16 bg-[var(--bg-surface)] rounded animate-pulse" style={{ animationDelay: '80ms' }} />
            <div className="h-5 w-10 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ animationDelay: '80ms' }} />
          </div>
        </div>

        {/* 3-column OddsCell grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2.5"
            >
              <div className="h-2 w-12 bg-[var(--bg-surface)] rounded animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="h-5 w-10 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ animationDelay: `${i * 60 + 40}ms` }} />
            </div>
          ))}
        </div>

        {/* CTA strip */}
        <div className="h-8 w-full rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] animate-pulse" />
      </div>
    </div>
  );
}

export function CardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Inline loading state shown inside a card's analysis panel while the AI response streams. */
export function CardAnalysisSkeleton({ cardType = 'betting' }: { cardType?: string }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-blue-500/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        <span className="text-[11px] text-[var(--text-muted)] ml-1">
          Analyzing {cardType === 'kalshi' ? 'prediction market' : 'opportunity'}...
        </span>
      </div>
      <div className="h-2 bg-[var(--bg-elevated)] rounded-full animate-pulse w-full" />
      <div className="h-2 bg-[var(--bg-elevated)] rounded-full animate-pulse w-5/6" />
      <div className="h-2 bg-[var(--bg-elevated)] rounded-full animate-pulse w-3/5" />
    </div>
  );
}
