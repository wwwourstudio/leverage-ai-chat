'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, User } from 'lucide-react';
import { TrustMetricsBadge } from './trust-metrics-display';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  trustMetrics?: any;
  cards?: any[];
}

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
}

// ============================================================
// Typing indicator — rotates through meaningful stage labels
// ============================================================
const STAGES = ['Fetching live odds...', 'Running analysis...', 'Generating insights...'];

function TypingIndicator() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStage(s => (s + 1) % STAGES.length), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex gap-3 justify-start animate-fade-in">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-900/40">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>

      {/* Bubble */}
      <div className="bg-[oklch(0.11_0.012_280)] border border-[oklch(0.20_0.018_280)] border-l-[2px] border-l-blue-500/40 rounded-2xl px-4 py-3 flex items-center gap-3">
        {/* Three-dot pulse */}
        <div className="flex gap-1 items-center" aria-label="AI is thinking" role="status">
          {[0, 160, 320].map(delay => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-blue-500/70 animate-bounce"
              style={{ animationDelay: `${delay}ms`, animationDuration: '1.1s' }}
            />
          ))}
        </div>

        {/* Stage label — fades between states */}
        <span key={stage} className="text-[11px] text-gray-500 font-medium animate-fade-in tabular-nums">
          {STAGES[stage]}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// MessageList
// ============================================================
export function MessageList({ messages, isTyping }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        return (
          <div
            key={message.id}
            className={cn(
              'flex gap-3 animate-fade-in-up',
              isUser ? 'justify-end' : 'justify-start',
            )}
            style={{ animationDelay: `${Math.min(index * 30, 120)}ms` }}
          >
            {/* AI avatar — left of assistant messages */}
            {!isUser && (
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-900/40 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            {/* Bubble */}
            <div
              className={cn(
                'max-w-2xl rounded-2xl px-4 py-3',
                isUser
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/25'
                  : 'bg-[oklch(0.11_0.012_280)] border border-[oklch(0.20_0.018_280)] border-l-[2px] border-l-blue-500/40 text-slate-100 shadow-sm',
              )}
            >
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.content}</p>

              {!isUser && message.trustMetrics && (
                <div className="mt-3 pt-3 border-t border-[oklch(0.20_0.015_280)]">
                  <TrustMetricsBadge metrics={message.trustMetrics} />
                </div>
              )}
            </div>

            {/* User avatar — right of user messages */}
            {isUser && (
              <div className="w-7 h-7 rounded-lg bg-[oklch(0.20_0.02_280)] border border-[oklch(0.26_0.02_280)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-gray-500" />
              </div>
            )}
          </div>
        );
      })}

      {isTyping && <TypingIndicator />}

      {/* Scroll anchor */}
      <div ref={bottomRef} className="h-px" />
    </div>
  );
}
