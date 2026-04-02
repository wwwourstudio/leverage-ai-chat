export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg-overlay)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[var(--border-subtle)] border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-500/70 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
        </div>
        <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
          Loading Leverage AI
        </p>
      </div>
    </div>
  );
}
