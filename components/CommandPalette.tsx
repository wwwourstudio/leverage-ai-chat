'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MessageSquare, Plus, Star, Trash2, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Chat {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  starred: boolean;
  category: string;
  tags: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  chats: Chat[];
  activeChat: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings?: () => void;
}

interface Action {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  onSelect: () => void;
  keywords?: string[];
}

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Simple fuzzy: every query char must appear in order
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({
  open,
  onClose,
  chats,
  activeChat,
  onSelectChat,
  onNewChat,
  onOpenSettings,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const staticActions: Action[] = [
    {
      id: 'new-chat',
      label: 'New chat',
      icon: <Plus className="w-4 h-4" />,
      onSelect: () => { onNewChat(); onClose(); },
      keywords: ['create', 'start', 'begin'],
    },
    ...(onOpenSettings ? [{
      id: 'open-settings',
      label: 'Open settings',
      icon: <Settings className="w-4 h-4" />,
      onSelect: () => { onOpenSettings(); onClose(); },
      keywords: ['preferences', 'config', 'theme'],
    }] : []),
  ];

  const matchedChats = chats.filter(c =>
    fuzzyMatch(query, c.title) || fuzzyMatch(query, c.preview) || c.tags.some(t => fuzzyMatch(query, t))
  );

  const matchedActions = staticActions.filter(a =>
    !query || fuzzyMatch(query, a.label) || (a.keywords ?? []).some(k => fuzzyMatch(query, k))
  );

  type Item = { kind: 'chat'; chat: Chat } | { kind: 'action'; action: Action };
  const items: Item[] = [
    ...matchedActions.map(a => ({ kind: 'action' as const, action: a })),
    ...matchedChats.map(c => ({ kind: 'chat' as const, chat: c })),
  ];

  const safeIdx = Math.min(cursor, Math.max(0, items.length - 1));

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setCursor(0); }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${safeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [safeIdx]);

  const select = useCallback((item: Item) => {
    if (item.kind === 'chat') { onSelectChat(item.chat.id); onClose(); }
    else item.action.onSelect();
  }, [onSelectChat, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setCursor(c => Math.min(c + 1, items.length - 1));
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setCursor(c => Math.max(c - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[safeIdx]) select(items[safeIdx]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, safeIdx, select, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-overlay)] flex items-start justify-center pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)]">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)]">
          <Search className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search chats or run a command..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-[var(--text-faint)] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[var(--text-faint)] hover:text-[var(--text-muted)]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[10px] text-[var(--text-faint)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[min(400px,60vh)] overflow-y-auto py-2">
          {items.length === 0 && (
            <p className="text-center text-sm text-[var(--text-faint)] py-8">No results for &ldquo;{query}&rdquo;</p>
          )}

          {matchedActions.length > 0 && (
            <div>
              <p className="px-4 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-faint)] uppercase">Commands</p>
              {matchedActions.map((a, i) => {
                const idx = i;
                return (
                  <button
                    key={a.id}
                    data-idx={idx}
                    onClick={() => a.onSelect()}
                    onMouseEnter={() => setCursor(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                      safeIdx === idx ? 'bg-[var(--bg-elevated)] text-foreground' : 'text-[var(--text-muted)] hover:text-foreground'
                    )}
                  >
                    <span className="text-[var(--text-faint)]">{a.icon}</span>
                    <span>{a.label}</span>
                    {a.description && <span className="ml-auto text-xs text-[var(--text-faint)]">{a.description}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {matchedChats.length > 0 && (
            <div className={matchedActions.length > 0 ? 'mt-1' : ''}>
              <p className="px-4 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-faint)] uppercase">Chats</p>
              {matchedChats.map((chat, i) => {
                const idx = matchedActions.length + i;
                return (
                  <button
                    key={chat.id}
                    data-idx={idx}
                    onClick={() => { onSelectChat(chat.id); onClose(); }}
                    onMouseEnter={() => setCursor(idx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                      safeIdx === idx ? 'bg-[var(--bg-elevated)] text-foreground' : 'text-[var(--text-muted)] hover:text-foreground',
                      chat.id === activeChat && 'opacity-60'
                    )}
                  >
                    <span className="text-[var(--text-faint)] flex-shrink-0">
                      {chat.starred ? <Star className="w-4 h-4 fill-yellow-400/60 text-yellow-400/60" /> : <MessageSquare className="w-4 h-4" />}
                    </span>
                    <span className="truncate flex-1">{chat.title}</span>
                    <span className="text-xs text-[var(--text-faint)] flex-shrink-0">
                      {chat.timestamp instanceof Date
                        ? chat.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] flex items-center gap-4 text-[11px] text-[var(--text-faint)]">
          <span><kbd className="border border-[var(--border-subtle)] rounded px-1 py-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="border border-[var(--border-subtle)] rounded px-1 py-0.5">↵</kbd> select</span>
          <span><kbd className="border border-[var(--border-subtle)] rounded px-1 py-0.5">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
