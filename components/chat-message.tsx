'use client';

import React from 'react';
import { TrustMetricsDisplay } from '@/components/trust-metrics-display';
import { Shield, Copy, Edit3, CheckCheck, X, Zap, Brain, AlertCircle, Info, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  confidence?: number;
  trustMetrics?: any;
  sources?: any[];
  modelUsed?: string;
  processingTime?: number;
  isPartial?: boolean;  // stream interrupted; content shows what arrived before the break
  isError?: boolean;    // request failed with no usable content
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
      <ul key={`ul-${key}`} className="space-y-1 my-2 ml-1">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-[oklch(0.82_0.005_85)]">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 shrink-0" aria-hidden="true" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
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
      bulletBuffer.push(trimmed.replace(/^\d+\.\s/, '').trim());
      return;
    }

    // Empty line — flush bullets and add a gap
    if (trimmed === '') {
      flushBullets(String(i));
      if (elements.length > 0) {
        elements.push(<div key={`gap-${i}`} className="h-1" />);
      }
      return;
    }

    // Regular paragraph
    flushBullets(String(i));
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-[oklch(0.82_0.005_85)]">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushBullets('end');
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

export const ChatMessage = React.memo(function ChatMessage({ message, onEdit, onCopy, onRetry }: ChatMessageProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);
  const [showTrust, setShowTrust] = React.useState(false);

  const handleSaveEdit = () => {
    onEdit?.(editContent);
    setIsEditing(false);
  };

  const isUser = message.role === 'user';

  return (
    <div
      role="article"
      aria-label={isUser ? 'User message' : 'AI response'}
      className={cn('flex gap-3 animate-fade-in-up', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-3xl', isUser ? 'order-2' : '')}>
        <div className={cn(
          'rounded-2xl px-5 py-4',
          isUser
            ? 'bg-gradient-to-br from-[oklch(0.30_0.07_260)] to-[oklch(0.24_0.05_265)] text-white shadow-lg shadow-[oklch(0.15_0.04_260)/0.3] min-w-[200px] border border-[oklch(0.38_0.06_260)]'
            : message.isError
              ? 'bg-red-950/20 border border-l-[3px] border-red-800/40 border-l-red-500/60 shadow-sm'
              : message.isPartial
                ? 'bg-[oklch(0.12_0.015_280)] border border-l-[3px] border-[oklch(0.22_0.02_280)] border-l-amber-500/60 shadow-sm'
                : 'bg-[oklch(0.12_0.015_280)] border border-l-[3px] border-[oklch(0.22_0.02_280)] border-l-[oklch(0.45_0.06_260)] shadow-sm',
        )}>
          {isEditing ? (
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
              {/* Error / partial banners — shown above message content for assistant turns */}
              {!isUser && message.isError && (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-800/30">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs text-red-400 font-medium">Response failed</span>
                </div>
              )}
              {!isUser && message.isPartial && (
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-400">Partial response</span>
                </div>
              )}
              {isUser ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              ) : (
                <MarkdownContent text={message.content} />
              )}

              {!isUser && (
                <div className="mt-3 pt-3 border-t border-[oklch(0.20_0.015_280)]">
                  <div className="flex items-center gap-3 text-[11px] text-[oklch(0.42_0.01_280)]">
                    {/* Model + processing time */}
                    {(message.modelUsed || message.processingTime) && (
                      <span className="flex items-center gap-1">
                        <Brain className="w-3 h-3 text-purple-500/70" />
                        {message.modelUsed && (
                          <span className="font-semibold text-[oklch(0.50_0.01_280)]">
                            {message.modelUsed.replace(/grok-[34](-fast)?/i, 'Grok 4').replace('Grok 3', 'Grok 4')}
                          </span>
                        )}
                        {message.processingTime && (
                          <span className="flex items-center gap-0.5 text-[oklch(0.42_0.01_280)]">
                            <Zap className="w-2.5 h-2.5 text-yellow-500/60" />
                            {message.processingTime}ms
                          </span>
                        )}
                      </span>
                    )}

                    {/* Confidence */}
                    {message.confidence != null && (
                      <span className="ml-auto font-semibold text-[oklch(0.50_0.01_280)]">
                        {message.confidence}% confidence
                      </span>
                    )}

                    {/* Action buttons */}
                    {/* Retry button — prominent red/amber when error/partial, subtle otherwise */}
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        title="Retry"
                        className={cn(
                          'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-all',
                          message.isError
                            ? 'text-red-400 bg-red-950/30 hover:bg-red-900/40 hover:text-red-300'
                            : message.isPartial
                              ? 'text-amber-400 bg-amber-950/30 hover:bg-amber-900/40 hover:text-amber-300'
                              : 'opacity-60 hover:opacity-100 text-[oklch(0.42_0.01_280)] hover:text-blue-400 hover:bg-[oklch(0.18_0.01_280)]',
                        )}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {(message.isError || message.isPartial) && <span>Retry</span>}
                      </button>
                    )}
                    <button
                      onClick={onCopy}
                      title="Copy response"
                      className="flex items-center gap-1 opacity-100 md:opacity-60 hover:opacity-100 hover:text-blue-400 hover:bg-[oklch(0.18_0.01_280)] rounded px-1 py-0.5 transition-all"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      title="Edit"
                      className="flex items-center gap-1 opacity-100 md:opacity-60 hover:opacity-100 hover:text-blue-400 hover:bg-[oklch(0.18_0.01_280)] rounded px-1 py-0.5 transition-all"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    {message.trustMetrics && (
                      <button
                        onClick={() => setShowTrust((v: any) => !v)}
                        title="Trust metrics"
                        className="flex items-center gap-1 opacity-100 md:opacity-60 hover:opacity-100 hover:text-blue-400 hover:bg-[oklch(0.18_0.01_280)] rounded px-1 py-0.5 transition-all"
                      >
                        <Shield className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {showTrust && message.trustMetrics && (
                    <div className="mt-3">
                      <TrustMetricsDisplay metrics={message.trustMetrics} showDetails={true} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
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
