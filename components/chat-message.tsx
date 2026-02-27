'use client';

import React from 'react';
import { TrustMetricsDisplay } from '@/components/trust-metrics-display';
import { Shield, Copy, Edit3, CheckCheck, X, Zap, Brain } from 'lucide-react';
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
}

interface ChatMessageProps {
  message: Message;
  onEdit?: (content: string) => void;
  onCopy?: () => void;
}

/** Lightweight markdown renderer — handles **bold**, ## headers, - bullets */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

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

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // ## Headers
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

  return <div className="space-y-0.5">{elements}</div>;
}

/** Render inline markdown: **bold**, _italic_ */
function renderInline(text: string): React.ReactNode {
  if (!text.includes('**') && !text.includes('_')) return text;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldIdx = remaining.indexOf('**');
    if (boldIdx === -1) {
      parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    }
    if (boldIdx > 0) {
      parts.push(<React.Fragment key={key++}>{remaining.slice(0, boldIdx)}</React.Fragment>);
    }
    const closeBold = remaining.indexOf('**', boldIdx + 2);
    if (closeBold === -1) {
      parts.push(<React.Fragment key={key++}>{remaining.slice(boldIdx)}</React.Fragment>);
      break;
    }
    const boldText = remaining.slice(boldIdx + 2, closeBold);
    parts.push(
      <strong key={key++} className="font-bold text-white">
        {boldText}
      </strong>
    );
    remaining = remaining.slice(closeBold + 2);
  }

  return <>{parts}</>;
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

export function ChatMessage({ message, onEdit, onCopy }: ChatMessageProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);
  const [showTrust, setShowTrust] = React.useState(false);

  const handleSaveEdit = () => {
    onEdit?.(editContent);
    setIsEditing(false);
  };

  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 animate-fade-in-up', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-3xl', isUser ? 'order-2' : '')}>
        <div className={cn(
          'rounded-2xl px-5 py-4',
          isUser
            ? 'bg-linear-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/20'
            : 'bg-[oklch(0.12_0.015_280)] border border-l-[3px] border-[oklch(0.22_0.02_280)] border-l-blue-500/50 shadow-sm',
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
                    <button
                      onClick={onCopy}
                      title="Copy response"
                      className="flex items-center gap-1 opacity-100 md:opacity-60 hover:opacity-100 hover:text-blue-400 transition-all"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      title="Edit"
                      className="flex items-center gap-1 opacity-100 md:opacity-60 hover:opacity-100 hover:text-blue-400 transition-all"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    {message.trustMetrics && (
                      <button
                        onClick={() => setShowTrust(v => !v)}
                        title="Trust metrics"
                        className="flex items-center gap-1 opacity-100 md:opacity-60 hover:opacity-100 hover:text-blue-400 transition-all"
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
        {/* Timestamp */}
        {message.timestamp && (
          <p className={cn(
            'text-[10px] mt-1 text-[oklch(0.38_0.008_280)]',
            isUser ? 'text-right' : 'text-left'
          )}>
            {formatRelativeTime(message.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
