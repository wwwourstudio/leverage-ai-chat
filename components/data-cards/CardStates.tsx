'use client';

import { AlertTriangle, Sparkles } from 'lucide-react';
import { UnifiedCardShell } from './UnifiedCardShell';

export function CardsLoadingState() {
  return (
    <UnifiedCardShell className="p-4 space-y-3 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-[var(--bg-elevated)]" />
      <div className="h-12 w-full rounded-xl bg-[var(--bg-elevated)]" />
      <div className="h-20 w-full rounded-xl bg-[var(--bg-elevated)]" />
    </UnifiedCardShell>
  );
}

export function CardsErrorState({ message = 'We hit an issue loading cards. Try again.' }: { message?: string }) {
  return (
    <UnifiedCardShell className="p-4 border-red-500/30 bg-red-500/5">
      <div className="flex items-start gap-2 text-sm text-red-300">
        <AlertTriangle className="w-4 h-4 mt-0.5" />
        <p>{message}</p>
      </div>
    </UnifiedCardShell>
  );
}

export function CardsEmptyState({ message = 'No cards available yet. Ask a follow-up to generate analysis.' }: { message?: string }) {
  return (
    <UnifiedCardShell className="p-4">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Sparkles className="w-4 h-4 text-blue-400" />
        <p>{message}</p>
      </div>
    </UnifiedCardShell>
  );
}
