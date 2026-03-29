'use client';

import React from 'react';
import { TrustMetricsDisplay } from '@/components/trust-metrics-display';
import { Shield, Copy, Edit3, CheckCheck, X, Zap, Brain, AlertCircle, Info, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast-provider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  confidence?: number;
  trustMetrics?: any;
  sources?: any[];
  modelUsed?: string;
  processingTime?: number;
  isPartial?: boolean;   // stream interrupted; content shows what arrived before the break
  isError?: boolean;     // request failed with no usable content
  isPending?: boolean;   // optimistic placeholder while API call is in flight
  isStreaming?: boolean; // tokens are actively arriving from the SSE stream
}

interface ChatMessageProps {
  message: Message;
  onEdit?: (content: string) => void;
  onCopy?: () => void;
  onRetry?: () => void;
}

/** Render inline markdown: **bold**, _italic_, `code` */
function renderInline(text: string): React.ReactNode {
  // Fast path: no markers present
  if (!text.includes('**') && !text.includes('_') && !text.includes('`')) return text;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the earliest marker
    const boldIdx = remaining.indexOf('**');
    const italicIdx = (() => {
      let idx = remaining.indexOf('_');
      // Avoid treating mid-word underscores (e.g. snake_case) as italic markers
      while (idx !== -1) {
        const before = idx > 0 ? remaining[idx - 1] : ' ';
        const after = idx + 1 < remaining.length ? remaining[idx + 1] : ' ';
        if (/\w/.test(before) && /\w/.test(after)) {
          idx = remaining.indexOf('_', idx + 1);
        } else {
          break;
        }
      }
      return idx;
    })();
    const codeIdx = remaining.indexOf('`');

    const candidates = [
      boldIdx !== -1 ? boldIdx : Infinity,
      italicIdx !== -1 ? italicIdx : Infinity,
      codeIdx !== -1 ? codeIdx : Infinity,
    ];
    const earliest = Math.min(...candidates);

    if (earliest === Infinity) {
      parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    }

    // Emit text before the marker
    if (earliest > 0) {
      parts.push(<React.Fragment key={key++}>{remaining.slice(0, earliest)}</React.Fragment>);
      remaining = remaining.slice(earliest);
    }

    // Bold: **text**
    if (remaining.startsWith('**')) {
      const close = remaining.indexOf('**', 2);
      if (close === -1) {
        parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
        break;
      }
      parts.push(
        <strong key={key++} className="font-bold text-white">
          {remaining.slice(2, close)}
        </strong>
      );
      remaining = remaining.slice(close + 2);
      continue;
    }

    // Inline code: `code`
    if (remaining.startsWith('`')) {
      const close = remaining.indexOf('`', 1);
      if (close === -1) {
        parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
        break;
      }
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-[oklch(0.18_0.015_280)] text-blue-300 font-mono text-[0.85em]">
          {remaining.slice(1, close)}
        </code>
      );
      remaining = remaining.slice(close + 1);
      continue;
    }

    // Italic: _text_
    if (remaining.startsWith('_')) {
      const close = remaining.indexOf('_', 1);
      if (close === -1) {
        parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
        break;
      }
      parts.push(
        <em key={key++} className="italic text-[oklch(0.75_0.005_85)]">
          {remaining.slice(1, close)}
        </em>
      );
      remaining = remaining.slice(close + 1);
      continue;
    }

    // Should not reach here; advance one char to prevent infinite loop
    parts.push(<React.Fragment key={key++}>{remaining[0]}</React.Fragment>);
    remaining = remaining.slice(1);
  }

  return <>{parts}</>;
}

/** Lightweight markdown renderer — handles **bold**, _italic_, `code`, ``` blocks, ## headers, - bullets */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';

  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${key}`} className="space-y-1.5 my-2 ml-1">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-[oklch(0.82_0.005_85)]">
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" aria-hidden="true" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  let numberedBuffer: string[] = [];
  const flushNumbered = (key: string) => {
    if (numberedBuffer.length === 0) return;
    elements.push(
      <ol key={`ol-${key}`} className="space-y-1.5 my-2 ml-1">
        {numberedBuffer.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-[oklch(0.82_0.005_85)]">
            <span className="mt-0.5 min-w-[18px] h-[18px] rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ol>
    );
    numberedBuffer = [];
  };

  const flushCode = (key: string) => {
    if (codeBuffer.length === 0) return;
    elements.push(
      <div key={`code-${key}`} className="my-2 rounded-lg overflow-hidden border border-[oklch(0.22_0.02_280)]">
        {codeLang && (
          <div className="px-3 py-1 bg-[oklch(0.16_0.015_280)] text-[10px] font-mono text-[oklch(0.45_0.01_280)] uppercase tracking-wide border-b border-[oklch(0.22_0.02_280)]">
            {codeLang}
          </div>
        )}
        <pre className="px-4 py-3 bg-[oklch(0.10_0.01_280)] text-sm font-mono text-[oklch(0.78_0.005_280)] overflow-x-auto leading-relaxed">
          <code>{codeBuffer.join('\n')}</code>
        </pre>
      </div>
    );
    codeBuffer = [];
    codeLang = '';
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Fenced code block toggle
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushBullets(String(i));
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      } else {
        inCodeBlock = false;
        flushCode(String(i));
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // ### Headers (h3)
    if (trimmed.startsWith('### ')) {
      flushBullets(String(i));
      flushNumbered(String(i));
      elements.push(
        <p key={i} className="text-[12px] font-bold text-blue-300/80 mt-2 mb-0.5 uppercase tracking-wide">
          {trimmed.slice(4)}
        </p>
      );
      return;
    }

    // ## Headers (h2)
    if (trimmed.startsWith('## ')) {
      flushBullets(String(i));
      flushNumbered(String(i));
      elements.push(
        <p key={i} className="text-[13px] font-bold text-blue-400 mt-3 mb-1 uppercase tracking-wide">
          {trimmed.slice(3)}
        </p>
      );
      return;
    }

    // # Headers (h1)
    if (trimmed.startsWith('# ')) {
      flushBullets(String(i));
      elements.push(
        <p key={i} className="text-sm font-black text-white mt-3 mb-1">
          {trimmed.slice(2)}
        </p>
      );
      return;
    }

    // Bullet points (- or • or *)
    if (/^[-•*]\s/.test(trimmed)) {
      bulletBuffer.push(trimmed.slice(2).trim());
      return;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      flushBullets(String(i));
      numberedBuffer.push(trimmed.replace(/^\d+\.\s/, '').trim());
      return;
    }

    // Empty line — flush bullets and add a gap
    if (trimmed === '') {
      flushBullets(String(i));
      flushNumbered(String(i));
      if (elements.length > 0) {
        elements.push(<div key={`gap-${i}`} className="h-1" />);
      }
      return;
    }

    // Regular paragraph
    flushBullets(String(i));
    flushNumbered(String(i));
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-[oklch(0.82_0.005_85)]">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushBullets('end');
  flushNumbered('end');
  if (inCodeBlock) flushCode('eof'); // unclosed fence — render what we have

  return <div className="space-y-0.5">{elements}</div>;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Chars before we collapse an assistant message. ~2 full screens of text. */
const COLLAPSE_THRESHOLD = 3000;

export const ChatMessage = React.memo(function ChatMessage({ message, onEdit, onCopy, onRetry }: ChatMessageProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);
  const [showTrust, setShowTrust] = React.useState(false);
  const [justCopied, setJustCopied] = React.useState(false);
  const toast = useToast();
  const isLong = !message.role || message.role === 'assistant'
    ? message.content.length > COLLAPSE_THRESHOLD
    : false;
  const [expanded, setExpanded] = React.useState(false);

  const handleSaveEdit = () => {
    onEdit?.(editContent);
    setIsEditing(false);
  };

  const isUser = message.role === 'user';

  return (
    <div
      role="article"
      aria-label={isUser ? 'User message' : 'AI response'}
      className={cn('flex gap-2.5 animate-fade-in', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* AI avatar */}
      {!isUser && (
        <div className="shrink-0 mt-1">
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 opacity-30 blur-[6px]" />
            <div className="relative w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm shadow-blue-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-white"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            </div>
          </div>
        </div>
      )}
      <div className={cn('max-w-3xl min-w-0', isUser ? 'order-2' : 'flex-1')}>
        <div className={cn(
          'relative rounded-2xl px-4 py-3.5 overflow-hidden',
          isUser
            ? 'bg-gradient-to-br from-[oklch(0.32_0.09_258)] to-[oklch(0.26_0.07_268)] text-white shadow-lg shadow-blue-900/40 border border-[oklch(0.40_0.08_258)] min-w-[120px]'
            : message.isError
              ? 'bg-[oklch(0.11_0.015_15)] border border-[oklch(0.22_0.03_15)] shadow-sm'
              : message.isPartial
                ? 'bg-[oklch(0.11_0.012_280)] border border-[oklch(0.22_0.015_280)] shadow-sm'
                : 'bg-[oklch(0.11_0.012_280)] border border-[oklch(0.20_0.015_280)] shadow-sm',
          (!isUser && (message.isPending || message.isStreaming)) ? 'min-h-[72px]' : '',
        )}>
          {/* Error / partial accent strip */}
          {!isUser && message.isError && (
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl bg-red-500/70" />
          )}
          {!isUser && message.isPartial && (
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl bg-amber-500/60" />
          )}
          {!isUser && !message.isError && !message.isPartial && !message.isPending && !message.isStreaming && (
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl bg-gradient-to-b from-blue-500/60 to-violet-500/30" />
          )}
          {/* ── Loading skeleton — shown while pending OR while first tokens arrive ── */}
          {!isUser && (message.isPending || (message.isStreaming && !message.content?.trim())) && (
            <div className="space-y-2.5 py-1" aria-label="Loading response" aria-busy="true">
              <div className="h-2.5 w-48 rounded-full bg-white/10 animate-pulse" />
              <div className="h-2.5 w-64 rounded-full bg-white/10 animate-pulse [animation-delay:150ms]" />
              <div className="h-2.5 w-36 rounded-full bg-white/10 animate-pulse [animation-delay:300ms]" />
            </div>
          )}

          {!message.isPending && !(message.isStreaming && !message.content?.trim()) && (isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                className="w-full bg-[oklch(0.10_0.01_280)] text-white rounded-lg p-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 text-sm text-white"
                >
                  <CheckCheck className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 text-sm text-white"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error / partial inline labels */}
              {!isUser && message.isError && (
                <div className="flex items-center gap-1.5 mb-2.5">
                  <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                  <span className="text-[11px] text-red-400 font-semibold">Response failed</span>
                </div>
              )}
              {!isUser && message.isPartial && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[11px] text-amber-400 font-semibold">Partial response</span>
                </div>
              )}
              {isUser ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              ) : isLong && !expanded ? (
                <>
                  <MarkdownContent text={message.content.slice(0, COLLAPSE_THRESHOLD)} />
                  <div className="mt-3 pt-2 border-t border-[oklch(0.20_0.015_280)]">
                    <button
                      onClick={() => setExpanded(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <span>Show full response</span>
                      <span className="text-[oklch(0.42_0.01_280)]">
                        ({Math.ceil((message.content.length - COLLAPSE_THRESHOLD) / 1000)}k more chars)
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <div className={message.isStreaming ? 'content-streaming' : undefined}>
                  {/* Plain text during streaming — avoids markdown re-parse jank on every token */}
                  {message.isStreaming
                    ? <p className="text-sm leading-relaxed text-[oklch(0.82_0.005_85)] whitespace-pre-wrap">{message.content}</p>
                    : <MarkdownContent text={message.content} />
                  }
                  {isLong && expanded && (
                    <div className="mt-3 pt-2 border-t border-[oklch(0.20_0.015_280)]">
                      <button
                        onClick={() => setExpanded(false)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Collapse response
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isUser && (
                <div className="mt-3 pt-2.5 border-t border-[oklch(0.18_0.012_280)]">
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: model + confidence + sources */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-[oklch(0.40_0.01_280)] min-w-0">
                      {(message.modelUsed || message.processingTime) && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Brain className="w-3 h-3 text-violet-500/60" />
                          {message.modelUsed && (
                            <span className="font-medium text-[oklch(0.46_0.01_280)]">
                              {message.modelUsed.replace(/grok-3(-fast)?/gi, 'Grok 3 Fast').replace(/grok-4/gi, 'Grok 3 Fast')}
                            </span>
                          )}
                          {message.processingTime && (
                            <span className="flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5 text-yellow-500/50" />
                              {message.processingTime}ms
                            </span>
                          )}
                        </span>
                      )}
                      {message.confidence != null && (
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          message.confidence >= 80
                            ? 'text-blue-400/80 bg-blue-950/40'
                            : message.confidence >= 60
                              ? 'text-amber-400/80 bg-amber-950/30'
                              : 'text-[oklch(0.42_0.01_280)] bg-[oklch(0.15_0.01_280)]'
                        }`}>
                          {message.confidence}%
                        </span>
                      )}
                    </div>

                    {/* Right: action buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {onRetry && (
                        <button
                          onClick={onRetry}
                          title="Retry"
                          className={cn(
                            'p-1.5 rounded-lg text-[11px] transition-all',
                            message.isError
                              ? 'text-red-400 hover:bg-red-950/40'
                              : message.isPartial
                                ? 'text-amber-400 hover:bg-amber-950/30'
                                : 'text-[oklch(0.38_0.01_280)] hover:text-[oklch(0.60_0.01_280)] hover:bg-[oklch(0.17_0.01_280)]',
                          )}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          onCopy?.();
                          setJustCopied(true);
                          toast.success('Copied to clipboard');
                          setTimeout(() => setJustCopied(false), 1500);
                        }}
                        title="Copy response"
                        className="p-1.5 rounded-lg text-[oklch(0.38_0.01_280)] hover:text-blue-400 hover:bg-[oklch(0.17_0.01_280)] transition-all"
                      >
                        {justCopied
                          ? <CheckCheck className="w-3.5 h-3.5 text-blue-400 animate-scale-in" />
                          : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setIsEditing(true)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-[oklch(0.38_0.01_280)] hover:text-blue-400 hover:bg-[oklch(0.17_0.01_280)] transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {message.trustMetrics && (
                        <button
                          onClick={() => setShowTrust((v: any) => !v)}
                          title="Trust metrics"
                          className={cn(
                            'p-1.5 rounded-lg transition-all',
                            showTrust
                              ? 'text-blue-400 bg-blue-950/30'
                              : 'text-[oklch(0.38_0.01_280)] hover:text-blue-400 hover:bg-[oklch(0.17_0.01_280)]',
                          )}
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {showTrust && message.trustMetrics && (
                    <div className="mt-3">
                      <TrustMetricsDisplay metrics={message.trustMetrics} showDetails={true} />
                    </div>
                  )}
                </div>
              )}
            </>
          ))}
        </div>
        {/* Timestamp — suppressHydrationWarning because Date.now() differs between SSR and client */}
        {message.timestamp && (
          <p
            suppressHydrationWarning
            className={cn(
              'text-[10px] mt-1 text-[oklch(0.38_0.008_280)]',
              isUser ? 'text-right' : 'text-left'
            )}
          >
            {formatRelativeTime(message.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
});
