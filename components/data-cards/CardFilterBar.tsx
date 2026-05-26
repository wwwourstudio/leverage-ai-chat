'use client';

import { memo } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type CardSortBy } from '@/lib/store/app-store';

type StatusFilter = 'all' | 'hot' | 'value' | 'optimal';

const STATUS_FILTERS: { id: StatusFilter; label: string; activeColor: string }[] = [
  { id: 'all',     label: 'All',     activeColor: 'text-[var(--text-muted)] bg-[var(--bg-elevated)] border-[var(--border-default)]' },
  { id: 'hot',     label: '🔥 Hot',  activeColor: 'text-red-400 bg-red-500/10 border-red-500/30' },
  { id: 'value',   label: 'Value',   activeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { id: 'optimal', label: 'Optimal', activeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
];

const SORT_OPTIONS: { id: CardSortBy; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'value',   label: 'Value' },
  { id: 'time',    label: 'Newest' },
  { id: 'alpha',   label: 'A–Z' },
];

interface CardFilterBarProps {
  filter: StatusFilter;
  onFilterChange: (f: StatusFilter) => void;
  totalCount: number;
  filteredCount: number;
}

export const CardFilterBar = memo(function CardFilterBar({
  filter,
  onFilterChange,
  totalCount,
  filteredCount,
}: CardFilterBarProps) {
  const { cardSortBy, setCardSortBy, cardSearch, setCardSearch } = useAppStore();

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-faint)] pointer-events-none" />
        <input
          type="text"
          value={cardSearch}
          onChange={e => setCardSearch(e.target.value)}
          placeholder="Filter cards…"
          aria-label="Filter cards by keyword"
          className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] focus:border-blue-500/40 rounded-lg py-1.5 pl-7 pr-7 text-[11px] text-foreground placeholder-[var(--text-faint)] focus:outline-none transition-colors duration-150"
        />
        {cardSearch && (
          <button
            onClick={() => setCardSearch('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-[var(--text-faint)] hover:text-foreground hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Status filter chips + sort options */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Status chips */}
        {STATUS_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-150',
              filter === f.id
                ? f.activeColor + ' opacity-100'
                : 'text-[var(--text-faint)] bg-transparent border-[var(--border-subtle)] hover:border-[var(--border-hover)] opacity-70 hover:opacity-100',
            )}
          >
            {f.label}
          </button>
        ))}

        {/* Divider */}
        <div className="w-px h-3 bg-[var(--border-subtle)] mx-0.5" />

        {/* Sort pills */}
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setCardSortBy(opt.id)}
            aria-pressed={cardSortBy === opt.id}
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-150',
              cardSortBy === opt.id
                ? 'text-purple-400 bg-purple-500/10 border-purple-500/30 opacity-100'
                : 'text-[var(--text-faint)] bg-transparent border-[var(--border-subtle)] hover:border-[var(--border-hover)] opacity-70 hover:opacity-100',
            )}
          >
            {opt.label}
          </button>
        ))}

        {/* Result count */}
        {(cardSearch || filter !== 'all') && (
          <span className="ml-auto text-[9px] font-semibold text-[var(--text-faint)] tabular-nums">
            {filteredCount}/{totalCount}
          </span>
        )}
      </div>
    </div>
  );
});
