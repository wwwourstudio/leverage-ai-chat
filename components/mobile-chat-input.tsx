'use client';

import { useRef, useState } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_CHARS = 1500;

interface MobileChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MobileChatInput({
  onSend,
  disabled,
  placeholder = 'Ask about betting opportunities...',
}: MobileChatInputProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = input.length;
  const atLimit = charCount >= MAX_CHARS;
  const nearLimit = charCount >= MAX_CHARS * 0.85;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled || atLimit) return;
    onSend(trimmed);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length > MAX_CHARS) return;
    setInput(e.target.value);
    // Auto-expand height
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const canSend = input.trim().length > 0 && !disabled && !atLimit;

  return (
    <div className="border-t border-[oklch(0.20_0.018_280)] bg-[oklch(0.095_0.01_280)]/95 backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3">

        {/* Attach */}
        <button
          type="button"
          aria-label="Attach file"
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-400 hover:bg-[oklch(0.16_0.015_280)] transition-all border border-[oklch(0.20_0.018_280)] hover:border-[oklch(0.28_0.02_280)] mb-0.5"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text area wrapper */}
        <div className={cn(
          'flex-1 relative rounded-xl border transition-all duration-150',
          focused
            ? 'border-blue-500/50 bg-[oklch(0.13_0.015_280)] ring-2 ring-blue-500/15'
            : 'border-[oklch(0.22_0.02_280)] bg-[oklch(0.13_0.015_280)]',
          disabled && 'opacity-50',
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Chat message"
            aria-describedby="chat-input-hint"
            className="w-full resize-none bg-transparent text-[13px] text-gray-100 placeholder-gray-600 py-2.5 px-3.5 pr-14 focus:outline-none disabled:cursor-not-allowed leading-relaxed"
            style={{ maxHeight: '160px' }}
          />

          {/* Char counter — appears near limit */}
          {nearLimit && (
            <span className={cn(
              'absolute bottom-2 right-3 text-[10px] tabular-nums font-mono pointer-events-none',
              atLimit ? 'text-red-400' : 'text-yellow-500/70',
            )}>
              {charCount}/{MAX_CHARS}
            </span>
          )}
        </div>

        {/* Send */}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 mb-0.5',
            canSend
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-900/40'
              : 'bg-[oklch(0.16_0.015_280)] text-gray-700 cursor-not-allowed border border-[oklch(0.20_0.018_280)]',
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Footer hint bar */}
      <div id="chat-input-hint" className="flex items-center justify-between px-3.5 pb-2.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full', disabled ? 'bg-yellow-500' : 'bg-emerald-500')} />
          <span className="text-[10px] text-gray-600 font-medium">
            {disabled ? 'AI thinking...' : 'Grok 4 ready'}
          </span>
        </div>
        <span className="text-[10px] text-gray-700">
          <kbd className="font-mono">Enter</kbd> to send &middot; <kbd className="font-mono">Shift+Enter</kbd> for newline
        </span>
      </div>
    </div>
  );
}
