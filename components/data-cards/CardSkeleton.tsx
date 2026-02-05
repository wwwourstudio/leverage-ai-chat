'use client';

export function CardSkeleton() {
  return (
    <div className="relative bg-gradient-to-br from-gray-900/98 via-gray-850/98 to-gray-900/98 backdrop-blur-xl rounded-2xl p-5 border border-gray-700/50 overflow-hidden">
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      
      {/* Accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-600/60 to-gray-700/60 animate-pulse" />
      
      {/* Header skeleton */}
      <div className="relative flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl bg-gray-800/80 animate-pulse" />
        <div className="flex-1 space-y-2.5">
          <div className="h-2.5 w-28 bg-gray-800/60 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-800/80 rounded animate-pulse" />
          <div className="h-6 w-24 bg-gray-800/60 rounded-full animate-pulse" />
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="relative space-y-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-800/30">
            <div className="h-3 w-24 bg-gray-800/60 rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            <div className="h-3 w-20 bg-gray-800/60 rounded animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
          </div>
        ))}
      </div>
      
      {/* Footer skeleton */}
      <div className="relative mt-4 pt-4 border-t border-gray-700/50">
        <div className="h-3.5 w-36 bg-gray-800/60 rounded mx-auto animate-pulse" />
      </div>
    </div>
  );
}

export function CardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
