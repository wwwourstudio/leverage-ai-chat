'use client';

export function CardSkeleton() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[oklch(0.13_0.015_280)] border border-[oklch(0.22_0.02_280)]">
      {/* Left accent shimmer */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[oklch(0.25_0.02_280)] animate-pulse" />

      <div className="pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5 space-y-4">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-20 bg-[oklch(0.18_0.02_280)] rounded animate-pulse" />
            <div className="h-3 w-24 bg-[oklch(0.16_0.015_280)] rounded animate-pulse" />
          </div>
          <div className="h-5 w-16 bg-[oklch(0.16_0.015_280)] rounded-full animate-pulse" />
        </div>

        {/* Title skeleton */}
        <div className="h-5 w-3/4 bg-[oklch(0.18_0.02_280)] rounded animate-pulse" />

        {/* Odds grid skeleton */}
        <div className="rounded-xl bg-[oklch(0.10_0.01_280)] border border-[oklch(0.20_0.015_280)] overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[oklch(0.20_0.015_280)]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 px-4 py-3">
                <div className="h-2 w-10 bg-[oklch(0.16_0.015_280)] rounded animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="h-5 w-14 bg-[oklch(0.18_0.02_280)] rounded animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
                <div className="h-2.5 w-16 bg-[oklch(0.16_0.015_280)] rounded animate-pulse" style={{ animationDelay: `${i * 80 + 80}ms` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Meta row skeleton */}
        <div className="flex gap-5">
          <div className="h-3 w-24 bg-[oklch(0.16_0.015_280)] rounded animate-pulse" />
          <div className="h-3 w-32 bg-[oklch(0.16_0.015_280)] rounded animate-pulse" />
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
