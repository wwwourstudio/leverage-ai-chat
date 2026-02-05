'use client';

export function CardSkeleton() {
  return (
    <div className="relative bg-gradient-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/60 animate-pulse">
      {/* Accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-600 to-gray-700" />
      
      {/* Header skeleton */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-xl bg-gray-800/80" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-gray-800/80 rounded" />
          <div className="h-4 w-3/4 bg-gray-800/80 rounded" />
          <div className="h-6 w-20 bg-gray-800/80 rounded-full" />
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/30">
            <div className="h-3 w-20 bg-gray-800/80 rounded" />
            <div className="h-3 w-24 bg-gray-800/80 rounded" />
          </div>
        ))}
      </div>
      
      {/* Footer skeleton */}
      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="h-4 w-32 bg-gray-800/80 rounded mx-auto" />
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
