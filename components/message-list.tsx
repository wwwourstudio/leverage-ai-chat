'use client';

import { memo, useEffect, useState } from 'react';
import { Sparkles, User } from 'lucide-react';
import { TrustMetricsBadge } from './trust-metrics-display';

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

const TYPING_STAGES = [
  'Fetching live odds...',
  'Running analysis...',
  'Generating insights...',
];

function TypingIndicator() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage(s => (s + 1) % TYPING_STAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-900/30">
        <Sparkles className="w-4 h-4 text-white animate-pulse" />
      </div>
      <div className="bg-[oklch(0.12_0.015_280)] border border-[oklch(0.22_0.02_280)] rounded-2xl px-5 py-3.5 flex items-center gap-3">
        {/* Animated dots */}
        <div className="flex gap-1.5 items-center">
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce shadow-sm shadow-blue-400/40" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce shadow-sm shadow-purple-400/40" style={{ animationDelay: '160ms' }} />
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce shadow-sm shadow-indigo-400/40" style={{ animationDelay: '320ms' }} />
        </div>
        {/* Stage label */}
        <span
          key={stage}
          className="text-[11px] text-[oklch(0.50_0.01_280)] font-medium animate-fade-in-up"
        >
          {TYPING_STAGES[stage]}
        </span>
      </div>
    </div>
  );
}

// Memoized per-item component — skips re-render for messages whose reference hasn't changed.
// During streaming, only the active streaming message gets a new object reference, so React
// bails out for all prior messages and only reconciles the one being typed.
const MessageItem = memo(function MessageItem({ message, index }: { message: Message; index: number }) {
  return (
    <div
      className={`flex gap-3 animate-fade-in-up ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {message.role === 'assistant' && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-900/30">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}

      <div
        className={`max-w-3xl rounded-2xl px-5 py-4 ${
          message.role === 'user'
            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/20'
            : 'bg-[oklch(0.12_0.015_280)] border border-l-[3px] border-[oklch(0.22_0.02_280)] border-l-blue-500/40 text-slate-100 shadow-sm'
        }`}
      >
        <div className="prose prose-invert max-w-none">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.role === 'assistant' && message.trustMetrics && (
          <div className="mt-3 pt-3 border-t border-[oklch(0.20_0.015_280)]">
            <TrustMetricsBadge metrics={message.trustMetrics} />
          </div>
        )}
      </div>

      {message.role === 'user' && (
        <div className="w-8 h-8 rounded-full bg-[oklch(0.20_0.015_280)] flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-[oklch(0.60_0.01_280)]" />
        </div>
      )}
    </div>
  );
});

export const MessageList = memo(function MessageList({ messages, isTyping }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
      {messages.map((message, index) => (
        <MessageItem key={message.id} message={message} index={index} />
      ))}

      {isTyping && <TypingIndicator />}
    </div>
  );
});
