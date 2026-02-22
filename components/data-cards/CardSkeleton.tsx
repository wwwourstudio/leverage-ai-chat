'use client';

export function CardSkeleton() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-card border border-border/50">
      {/* Top accent shimmer */}
      <div className="h-1 w-full bg-muted animate-pulse" />

      <div className="px-5 pt-4 pb-5 space-y-4">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-muted/60 rounded-full animate-pulse" />
        </div>

        {/* Title skeleton */}
        <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />

        {/* Odds grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/40 px-4 py-3"
            >
              <div className="h-2 w-10 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              <div className="h-5 w-14 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
              <div className="h-2.5 w-16 bg-muted/60 rounded animate-pulse" style={{ animationDelay: `${i * 80 + 80}ms` }} />
            </div>
          ))}
        </div>

        {/* Meta row skeleton */}
        <div className="flex gap-5">
          <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
          <div className="h-3 w-32 bg-muted/50 rounded animate-pulse" />
        </div>
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
