'use client';

import { memo, useEffect, useState, useRef, useCallback } from 'react';
import { Sparkles, ChevronDown, Volume2 } from 'lucide-react';
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
  /** Callback to read a message aloud — wired from the voice conversation hook */
  onReadAloud?: (text: string) => void;
}

const TYPING_STAGES = [
  'Fetching live odds...',
  'Running analysis...',
  'Generating insights...',
];

const TypingIndicator = memo(function TypingIndicator() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage(s => (s + 1) % TYPING_STAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3 justify-start" role="status" aria-label="AI is thinking">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-900/30">
        <Sparkles className="w-4 h-4 text-white animate-pulse" />
      </div>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl px-5 py-3.5 flex items-center gap-3">
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
        <span
          key={stage}
          className="text-[11px] text-[var(--text-muted)] font-medium"
        >
          {TYPING_STAGES[stage]}
        </span>
      </div>
    </div>
  );
});

const MessageItem = memo(function MessageItem({
  message,
  onRetry,
  onReadAloud,
}: {
  message: Message;
  onRetry?: () => void;
  onReadAloud?: (text: string) => void;
}) {
  const [showReadBtn, setShowReadBtn] = useState(false);
  const isComplete = message.role === 'assistant' && !message.isStreaming && !message.isPending && !message.isError && message.content?.length > 0;

  return (
    <div
      className="group/msgitem relative"
      onMouseEnter={() => setShowReadBtn(true)}
      onMouseLeave={() => setShowReadBtn(false)}
    >
      <ChatMessage message={message} onRetry={onRetry} />
      {/* Read-aloud button — visible on hover for complete assistant messages */}
      {isComplete && onReadAloud && (
        <button
          onClick={() => onReadAloud(message.content)}
          aria-label="Read message aloud"
          className={`absolute -bottom-1 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-[var(--text-faint)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:text-blue-400 hover:border-blue-500/40 transition-all duration-200 ${showReadBtn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}
        >
          <Volume2 className="w-2.5 h-2.5" />
          Read
        </button>
      )}
    </div>
  );
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
      <span suppressHydrationWarning className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-faint)] px-2">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--bg-surface)]" />
    </div>
  );
}

export const MessageList = memo(function MessageList({ messages, isTyping, onRetryMessage, onReadAloud }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const [showNewContentBanner, setShowNewContentBanner] = useState(false);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCountRef = useRef(messages.length);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setShowNewContentBanner(false);
  }, []);

  const scrollRafRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return; // already scheduled
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJumpBtn(distFromBottom > 200);
      if (distFromBottom <= 60) setShowNewContentBanner(false);
    });
  }, []);

  // Detect when new assistant messages arrive while user is scrolled up
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const msgCount = messages.length;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isScrolledUp = distFromBottom > 120;
    const hasNewMsg = msgCount > prevMsgCountRef.current;
    prevMsgCountRef.current = msgCount;

    if (hasNewMsg && isScrolledUp) {
      setShowNewContentBanner(true);
      // Auto-dismiss after 6 seconds
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = setTimeout(() => setShowNewContentBanner(false), 6000);
    }
  }, [messages.length]);

  // Also show banner when isTyping starts and user is scrolled up
  useEffect(() => {
    if (!isTyping) return;
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom > 120) {
      setShowNewContentBanner(true);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = setTimeout(() => setShowNewContentBanner(false), 8000);
    }
  }, [isTyping]);

  useEffect(() => {
    return () => { if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current); };
  }, []);

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
              onReadAloud={onReadAloud}
            />
          </div>
        );
      })}

      {isTyping && !hasActiveSlot && <TypingIndicator />}

      {/* Jump-to-latest button */}
      {showJumpBtn && !showNewContentBanner && (
        <button
          onClick={scrollToBottom}
          aria-label="Jump to latest message"
          className="fixed bottom-36 right-4 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Latest
        </button>
      )}

      {/* New content below banner — fades in when response arrives below viewport */}
      {showNewContentBanner && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-fade-in-up">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white shadow-xl border border-blue-500/30 backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.92), rgba(124,58,237,0.92))',
              boxShadow: '0 8px 32px rgba(37,99,235,0.35)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            New response below
            <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
          </button>
        </div>
      )}
    </div>
  );
});
