'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Heart, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayerHeadshotUrl } from '@/lib/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

const WATCHLIST_KEY = 'leverage_watchlist';

interface WatchlistEntry {
  name: string;
  team?: string;
  position: string;
  addedAt: string;
}

interface WatchlistLightboxProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Player row ─────────────────────────────────────────────────────────────────

function PlayerRow({ entry, onRemove }: { entry: WatchlistEntry; onRemove: (name: string) => void }) {
  const [imgError, setImgError] = useState(false);
  const headshotUrl = getPlayerHeadshotUrl(entry.name);
  const addedDate = new Date(entry.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-elevated)] transition-colors group">
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
          <span className="text-[10px] font-bold text-blue-400/80 uppercase">{entry.position}</span>
          <span className="text-[var(--border-subtle)] text-[10px]">·</span>
          <span className="text-[10px] text-[var(--text-faint)]">Added {addedDate}</span>
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(entry.name)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-[var(--text-faint)] hover:text-rose-400 transition-all duration-150"
        title="Remove from watchlist"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Main lightbox ─────────────────────────────────────────────────────────────

export function WatchlistLightbox({ isOpen, onClose }: WatchlistLightboxProps) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);

  // Sync from localStorage whenever the lightbox opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? '[]') as WatchlistEntry[];
      setEntries(stored.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()));
    } catch {
      setEntries([]);
    }
  }, [isOpen]);

  const handleRemove = useCallback((name: string) => {
    setEntries(prev => {
      const updated = prev.filter(e => e.name !== name);
      try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setEntries([]);
    try { localStorage.removeItem(WATCHLIST_KEY); } catch {}
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[var(--bg-overlay)] border-l border-[var(--border-subtle)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-400" fill="currentColor" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">Player Watchlist</h2>
              <p className="text-[10px] text-[var(--text-faint)]">{entries.length} {entries.length === 1 ? 'player' : 'players'} saved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-elevated)] rounded-xl text-[var(--text-muted)] hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                <Heart className="w-6 h-6 text-[var(--text-faint)]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-muted)]">No players saved yet</p>
                <p className="text-[11px] text-[var(--text-faint)] mt-1 leading-relaxed">
                  Tap the ♥ on any pitcher analysis card to add them here
                </p>
              </div>
            </div>
          ) : (
            <div>
              {entries.map((entry, i) => (
                <PlayerRow key={i} entry={entry} onRemove={handleRemove} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
            <button
              onClick={handleClearAll}
              className="w-full py-2 rounded-xl text-[11px] font-bold text-[var(--text-faint)] hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
            >
              Clear all players
            </button>
          </div>
        )}
      </div>
    </>
  );
}
