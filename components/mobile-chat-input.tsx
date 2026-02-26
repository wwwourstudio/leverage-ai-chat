'use client';

import { useState } from 'react';
import { Send, Mic, Paperclip } from 'lucide-react';

interface MobileChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MobileChatInput({ onSend, disabled, placeholder = "Ask about betting opportunities..." }: MobileChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div className="border-t border-[oklch(0.22_0.02_280)] bg-[oklch(0.10_0.01_280)]/95 backdrop-blur-xl p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <button
          type="button"
          className="p-3 rounded-xl bg-[oklch(0.16_0.015_280)] hover:bg-[oklch(0.20_0.02_280)] transition-colors flex-shrink-0"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-[oklch(0.16_0.015_280)] border border-[oklch(0.22_0.02_280)] rounded-xl px-4 py-3 pr-12 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ maxHeight: '120px' }}
          />

          <button
            type="button"
            className="absolute right-2 bottom-2 p-2 rounded-lg bg-[oklch(0.20_0.02_280)] hover:bg-[oklch(0.25_0.02_280)] transition-colors"
            aria-label="Voice input"
          >
            <Mic className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </form>
      
      <div className="flex items-center gap-2 mt-2 px-1">
        <div className="flex-1 flex items-center gap-1 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>AI Online</span>
        </div>
        <span className="text-xs text-slate-600">Press Enter to send</span>
      </div>
    </div>
  );
}
