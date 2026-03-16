'use client';

import { memo, useEffect, useState } from 'react';
import { Sparkles, User } from 'lucide-react';
import { TrustMetricsBadge } from './trust-metrics-display';
import { ChatMessage } from './chat-message';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  trustMetrics?: any;
  cards?: any[];
  confidence?: number;
  modelUsed?: string;
  processingTime?: number;
  sources?: any[];
  isStreaming?: boolean;
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

// Memoized per-item component — delegates to ChatMessage for consistent rendering.
// During streaming, only the active streaming message gets a new object reference, so React
// bails out for all prior messages and only reconciles the one being typed.
const MessageItem = memo(function MessageItem({ message }: { message: Message }) {
  return <ChatMessage message={message} />;
});

export const MessageList = memo(function MessageList({ messages, isTyping }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {isTyping && <TypingIndicator />}
    </div>
  );
});
