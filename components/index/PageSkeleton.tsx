import { CardGrid } from '@/components/data-cards/CardSkeleton';

/**
 * ISR loading skeleton shown while the page shell is being hydrated.
 * Mirrors the sidebar + main content layout with animated pulse bars.
 */
export function PageSkeleton() {
  return (
    <div className="flex h-screen bg-[var(--bg-overlay)] text-white overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="w-72 flex-shrink-0 bg-[var(--bg-overlay)] border-r border-[var(--border-subtle)] flex flex-col gap-3 p-4">
        <div className="h-9 rounded-lg bg-[var(--bg-surface)] animate-pulse" />
        <div className="flex flex-col gap-2 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[var(--bg-elevated)] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 flex-shrink-0 bg-[var(--bg-overlay)] border-b border-[var(--border-subtle)] animate-pulse" />
        <div className="flex-1 overflow-auto p-6">
          <CardGrid count={3} />
        </div>
      </div>
    </div>
  );
}
