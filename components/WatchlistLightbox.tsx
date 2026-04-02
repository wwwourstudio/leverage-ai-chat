'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Bookmark, Trash2, LayoutGrid, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayerHeadshotUrl } from '@/lib/constants';
import type { SavedCardEntry } from '@/components/data-cards/DynamicCardRenderer';

// ── Types ─────────────────────────────────────────────────────────────────────

const WATCHLIST_KEY = 'leverage_watchlist';
const SAVED_CARDS_KEY = 'leverage_saved_cards';

interface WatchlistEntry {
  name: string;
  team?: string;
  position: string;
  addedAt: string;
}

interface WatchlistLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayerClick?: (name: string, position: string, team?: string) => void;
  onCardClick?: (entry: SavedCardEntry) => void;
}

// ── Player row ─────────────────────────────────────────────────────────────────

function PlayerRow({
  entry,
  onRemove,
  onClick,
}: {
  entry: WatchlistEntry;
  onRemove: (name: string) => void;
  onClick?: (name: string, position: string, team?: string) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const headshotUrl = getPlayerHeadshotUrl(entry.name);
  const addedDate = new Date(entry.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 transition-colors group',
        onClick ? 'cursor-pointer hover:bg-blue-500/5' : 'hover:bg-[var(--bg-elevated)]',
      )}
      onClick={onClick ? () => onClick(entry.name, entry.position, entry.team) : undefined}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/25 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {headshotUrl && !imgError ? (
          <img src={headshotUrl} alt={entry.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <span className="text-sm">⚾</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight truncate">{entry.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {entry.team && (
            <span className="text-[10px] font-semibold text-[var(--text-faint)]">{entry.team}</span>
          )}
          {entry.team && <span className="text-[var(--border-subtle)] text-[10px]">·</span>}
          <span className="text-[10px] font-bold text-blue-500/80 uppercase">{entry.position}</span>
          <span className="text-[var(--border-subtle)] text-[10px]">·</span>
          <span className="text-[10px] text-[var(--text-faint)]">Added {addedDate}</span>
        </div>
      </div>

      {/* Open hint */}
      {onClick && (
        <span className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-blue-500 uppercase tracking-wider transition-opacity mr-1">Open</span>
      )}

      {/* Remove */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(entry.name); }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-[var(--text-faint)] hover:text-rose-400 transition-all duration-150 flex-shrink-0"
        title="Remove bookmark"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Card row ──────────────────────────────────────────────────────────────────

function CardRow({
  entry,
  onRemove,
  onClick,
}: {
  entry: SavedCardEntry;
  onRemove: (id: string) => void;
  onClick?: (entry: SavedCardEntry) => void;
}) {
  const savedDate = new Date(entry.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Extract gradient "from-" colour for the accent strip
  const gradientMatch = entry.card.gradient.match(/from-(\w+-\d+)/);
  const accentClass = gradientMatch ? `bg-gradient-to-b ${entry.card.gradient}` : 'bg-gradient-to-b from-blue-500 to-purple-600';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 transition-colors group',
        onClick ? 'cursor-pointer hover:bg-blue-500/5' : 'hover:bg-[var(--bg-elevated)]',
      )}
      onClick={onClick ? () => onClick(entry) : undefined}
    >
      {/* Gradient swatch */}
      <div className={cn('w-2.5 h-10 rounded-full flex-shrink-0', accentClass)} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight truncate">{entry.card.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {entry.card.category && (
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{entry.card.category}</span>
          )}
          {entry.card.subcategory && (
            <>
              <span className="text-[var(--border-subtle)] text-[10px]">·</span>
              <span className="text-[10px] text-[var(--text-faint)]">{entry.card.subcategory}</span>
            </>
          )}
          <span className="text-[var(--border-subtle)] text-[10px]">·</span>
          <span className="text-[10px] text-[var(--text-faint)]">{savedDate}</span>
        </div>
      </div>

      {/* Open hint */}
      {onClick && (
        <span className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-blue-500 uppercase tracking-wider transition-opacity mr-1">Open</span>
      )}

      {/* Remove */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-[var(--text-faint)] hover:text-rose-400 transition-all duration-150 flex-shrink-0"
        title="Remove bookmark"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Main lightbox ─────────────────────────────────────────────────────────────

export function WatchlistLightbox({ isOpen, onClose, onPlayerClick, onCardClick }: WatchlistLightboxProps) {
  const [activeTab, setActiveTab] = useState<'players' | 'cards'>('players');
  const [players, setPlayers] = useState<WatchlistEntry[]>([]);
  const [savedCards, setSavedCards] = useState<SavedCardEntry[]>([]);

  // Sync from localStorage whenever the lightbox opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]') as WatchlistEntry[];
      setPlayers(stored.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()));
    } catch { setPlayers([]); }
    try {
      const stored = JSON.parse(localStorage.getItem(SAVED_CARDS_KEY) ?? '[]') as SavedCardEntry[];
      setSavedCards(stored.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
    } catch { setSavedCards([]); }
  }, [isOpen]);

  const handleRemovePlayer = useCallback((name: string) => {
    setPlayers(prev => {
      const updated = prev.filter(e => e.name !== name);
      try {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: updated.length } }));
      } catch {}
      return updated;
    });
  }, []);

  const handleRemoveCard = useCallback((id: string) => {
    setSavedCards(prev => {
      const updated = prev.filter(e => e.id !== id);
      try {
        localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(updated));
        // Also clear the flag key
        const [type, ...titleParts] = id.split(':');
        localStorage.removeItem(`bookmark:${id}`);
        window.dispatchEvent(new CustomEvent('saved-cards-update', { detail: { count: updated.length } }));
      } catch {}
      return updated;
    });
  }, []);

  const handleClearPlayers = useCallback(() => {
    setPlayers([]);
    try {
      localStorage.removeItem(WATCHLIST_KEY);
      window.dispatchEvent(new CustomEvent('watchlist-update', { detail: { count: 0 } }));
    } catch {}
  }, []);

  const handleClearCards = useCallback(() => {
    // Remove all bookmark flag keys too
    try {
      const existing: SavedCardEntry[] = JSON.parse(localStorage.getItem(SAVED_CARDS_KEY) ?? '[]');
      existing.forEach(e => localStorage.removeItem(`bookmark:${e.id}`));
      localStorage.removeItem(SAVED_CARDS_KEY);
      window.dispatchEvent(new CustomEvent('saved-cards-update', { detail: { count: 0 } }));
    } catch {}
    setSavedCards([]);
  }, []);

  if (!isOpen) return null;

  const totalCount = players.length + savedCards.length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[var(--bg-overlay)] border-l border-[var(--border-subtle)] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <Bookmark className="w-4 h-4 text-blue-500" fill="currentColor" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">Saved Bookmarks</h2>
              <p className="text-[10px] text-[var(--text-faint)]">{totalCount} {totalCount === 1 ? 'item' : 'items'} saved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-elevated)] rounded-xl text-[var(--text-muted)] hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[var(--border-subtle)] px-2 pt-2 gap-1">
          <button
            onClick={() => setActiveTab('players')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all',
              activeTab === 'players'
                ? 'text-blue-500 border-blue-500 bg-blue-500/5'
                : 'text-[var(--text-faint)] border-transparent hover:text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]',
            )}
          >
            <User className="w-3.5 h-3.5" />
            Players
            {players.length > 0 && (
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-[9px] font-black',
                activeTab === 'players' ? 'bg-blue-500/15 text-blue-500' : 'bg-[var(--bg-elevated)] text-[var(--text-faint)]',
              )}>
                {players.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all',
              activeTab === 'cards'
                ? 'text-blue-500 border-blue-500 bg-blue-500/5'
                : 'text-[var(--text-faint)] border-transparent hover:text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]',
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Cards
            {savedCards.length > 0 && (
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-[9px] font-black',
                activeTab === 'cards' ? 'bg-blue-500/15 text-blue-500' : 'bg-[var(--bg-elevated)] text-[var(--text-faint)]',
              )}>
                {savedCards.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Players tab ── */}
          {activeTab === 'players' && (
            players.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                  <Bookmark className="w-6 h-6 text-[var(--text-faint)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-muted)]">No players saved yet</p>
                  <p className="text-[11px] text-[var(--text-faint)] mt-1 leading-relaxed">
                    Tap the <Bookmark className="inline w-3 h-3 text-blue-500 fill-blue-500" /> on any pitcher card to save them here
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {players.map((entry, i) => (
                  <PlayerRow
                    key={i}
                    entry={entry}
                    onRemove={handleRemovePlayer}
                    onClick={onPlayerClick}
                  />
                ))}
              </div>
            )
          )}

          {/* ── Cards tab ── */}
          {activeTab === 'cards' && (
            savedCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                  <LayoutGrid className="w-6 h-6 text-[var(--text-faint)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-muted)]">No cards saved yet</p>
                  <p className="text-[11px] text-[var(--text-faint)] mt-1 leading-relaxed">
                    Hover any analysis card and tap the <Bookmark className="inline w-3 h-3 text-blue-500" /> to save it here
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {savedCards.map((entry) => (
                  <CardRow
                    key={entry.id}
                    entry={entry}
                    onRemove={handleRemoveCard}
                    onClick={onCardClick}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        {((activeTab === 'players' && players.length > 0) || (activeTab === 'cards' && savedCards.length > 0)) && (
          <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
            <button
              onClick={activeTab === 'players' ? handleClearPlayers : handleClearCards}
              className="w-full py-2 rounded-xl text-[11px] font-bold text-[var(--text-faint)] hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
            >
              Clear all {activeTab === 'players' ? 'players' : 'cards'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
