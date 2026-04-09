'use client';

import { memo, useEffect, useState, useRef, useCallback } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
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
  isPartial?: boolean;
  isError?: boolean;
  isPending?: boolean;
}

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  onRetryMessage?: (messageId: string) => void;
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
    <div className="flex gap-3 justify-start" role="status" aria-label="AI is thinking">
      {/* Waveform keyframe — injected once per indicator mount */}
      <style>{`
        @keyframes leverageWave {
          0%, 100% { transform: scaleY(0.35); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-900/30">
        <Sparkles className="w-4 h-4 text-white animate-pulse" />
      </div>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl px-5 py-3.5 flex items-center gap-3">
        {/* Animated waveform — 5 bars with staggered timing */}
        <div className="flex gap-[3px] items-center" style={{ height: '18px' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: '100%',
                borderRadius: '2px',
                background: `oklch(0.65 0.15 ${260 + i * 8})`,
                animation: `leverageWave 1.1s ease-in-out ${i * 0.11}s infinite`,
                transformOrigin: 'center',
              }}
            />
          ))}
        </div>
        {/* Stage label */}
        <span
          key={stage}
          className="text-[11px] text-[var(--text-muted)] font-medium animate-fade-in-up"
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
const MessageItem = memo(function MessageItem({
  message,
  onRetry,
}: {
  message: Message;
  onRetry?: () => void;
}) {
  return <ChatMessage message={message} onRetry={onRetry} />;
});

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-2" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-[var(--bg-surface)]" />
      {/* suppressHydrationWarning: server UTC vs client local timezone can produce
          different Today/Yesterday labels; the client value is always correct. */}
      <span suppressHydrationWarning className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)] px-2">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--bg-surface)]" />
    </div>
  );
}

export const MessageList = memo(function MessageList({ messages, isTyping, onRetryMessage }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showJumpBtn, setShowJumpBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpBtn(distFromBottom > 200);
  }, []);

  // Show the external TypingIndicator only when isTyping but no message is already
  // occupying the assistant slot (pending placeholder or active streaming).
  const hasActiveSlot = messages.some(m => m.isPending || m.isStreaming);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-5 relative"
    >
      {messages.map((message, idx) => {
        const prevMessage = idx > 0 ? messages[idx - 1] : null;
        const showSeparator = prevMessage &&
          message.timestamp &&
          prevMessage.timestamp &&
          !isSameDay(new Date(message.timestamp), new Date(prevMessage.timestamp));

        return (
          <div key={message.id}>
            {showSeparator && (
              <DateSeparator label={formatDateLabel(new Date(message.timestamp))} />
            )}
            <MessageItem
              message={message}
              onRetry={
                (message.isError || message.isPartial)
                  ? () => onRetryMessage?.(message.id)
                  : undefined
              }
            />
          </div>
        );
      })}

      {isTyping && !hasActiveSlot && <TypingIndicator />}

      {showJumpBtn && (
        <button
          onClick={scrollToBottom}
          aria-label="Jump to latest message"
          className="fixed bottom-24 right-4 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-bold shadow-lg animate-fade-in-up transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Latest
        </button>
      )}
    </div>
  );
});
