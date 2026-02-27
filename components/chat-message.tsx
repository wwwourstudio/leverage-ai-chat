'use client';

import React from 'react';
import { TrustMetricsDisplay } from '@/components/trust-metrics-display';
import { Shield, Copy, Edit3, CheckCheck, X, Zap, Brain, Database, Activity, RotateCcw } from 'lucide-react';
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

// ============================================================
// Markdown renderer — **bold**, ## headers, - bullets, `code`
// ============================================================
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${key}`} className="my-2 ml-1 space-y-1.5">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-[oklch(0.78_0.005_280)]">
            <span className="mt-[7px] w-[3px] h-[3px] rounded-full bg-blue-500/60 shrink-0" aria-hidden />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      flushBullets(String(i));
      elements.push(
        <p key={i} className="text-[11px] font-bold text-blue-400/80 mt-4 mb-1 uppercase tracking-widest">
          {trimmed.slice(3)}
        </p>
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      flushBullets(String(i));
      elements.push(
        <p key={i} className="text-sm font-bold text-white mt-3 mb-1">
          {trimmed.slice(2)}
        </p>
      );
      return;
    }

    if (/^[-•*]\s/.test(trimmed)) {
      bulletBuffer.push(trimmed.slice(2).trim());
      return;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      bulletBuffer.push(trimmed.replace(/^\d+\.\s/, '').trim());
      return;
    }

    if (trimmed === '') {
      flushBullets(String(i));
      if (elements.length > 0) elements.push(<div key={`gap-${i}`} className="h-1.5" />);
      return;
    }

    flushBullets(String(i));
    elements.push(
      <p key={i} className="text-[13px] leading-relaxed text-[oklch(0.80_0.005_280)]">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushBullets('end');
  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  if (!text.includes('**') && !text.includes('`')) return text;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeIdx = remaining.indexOf('`');
    const boldIdx = remaining.indexOf('**');

    // Pick whichever delimiter comes first
    if (codeIdx !== -1 && (boldIdx === -1 || codeIdx < boldIdx)) {
      if (codeIdx > 0) parts.push(<React.Fragment key={key++}>{remaining.slice(0, codeIdx)}</React.Fragment>);
      const closeCode = remaining.indexOf('`', codeIdx + 1);
      if (closeCode === -1) { parts.push(<React.Fragment key={key++}>{remaining.slice(codeIdx)}</React.Fragment>); break; }
      parts.push(
        <code key={key++} className="font-mono text-[12px] bg-[oklch(0.18_0.02_280)] border border-[oklch(0.26_0.02_280)] px-1 py-0.5 rounded text-blue-300/90">
          {remaining.slice(codeIdx + 1, closeCode)}
        </code>
      );
      remaining = remaining.slice(closeCode + 1);
      continue;
    }

    if (boldIdx === -1) { parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>); break; }
    if (boldIdx > 0) parts.push(<React.Fragment key={key++}>{remaining.slice(0, boldIdx)}</React.Fragment>);
    const closeBold = remaining.indexOf('**', boldIdx + 2);
    if (closeBold === -1) { parts.push(<React.Fragment key={key++}>{remaining.slice(boldIdx)}</React.Fragment>); break; }
    parts.push(<strong key={key++} className="font-semibold text-white">{remaining.slice(boldIdx + 2, closeBold)}</strong>);
    remaining = remaining.slice(closeBold + 2);
  }

  return <>{parts}</>;
}

// ============================================================
// Source reliability — 3-tier colour system
// ============================================================
function reliabilityStyle(pct: number) {
  if (pct >= 75) return { badge: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/8', dot: 'bg-emerald-500' };
  if (pct >= 50) return { badge: 'text-yellow-400 border-yellow-500/25 bg-yellow-500/8', dot: 'bg-yellow-500' };
  return { badge: 'text-red-400 border-red-500/25 bg-red-500/8', dot: 'bg-red-500' };
}

function SourceIcon({ type }: { type: string }) {
  if (type === 'database') return <Database className="w-3 h-3" />;
  if (type === 'api') return <Activity className="w-3 h-3" />;
  if (type === 'cache') return <RotateCcw className="w-3 h-3" />;
  return <Zap className="w-3 h-3" />;
}

// ============================================================
// ChatMessage
// ============================================================
export function ChatMessage({ message, onEdit, onCopy }: ChatMessageProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);
  const [showTrust, setShowTrust] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleSaveEdit = () => { onEdit?.(editContent); setIsEditing(false); };

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isUser = message.role === 'user';

  // Format timestamp safely on client only
  const [timeLabel, setTimeLabel] = React.useState<string>('');
  React.useEffect(() => {
    setTimeLabel(message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [message.timestamp]);

  return (
    <div className={cn('group/msg flex gap-3 animate-fade-in-up', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-3xl w-full', isUser ? 'ml-auto max-w-xl' : '')}>

        {/* Bubble */}
        <div className={cn(
          'relative rounded-2xl px-4 py-3.5',
          isUser
            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
            : 'bg-[oklch(0.11_0.012_280)] border border-[oklch(0.20_0.018_280)] border-l-[2px] border-l-blue-500/40 shadow-sm',
        )}>

          {/* Hover timestamp */}
          {timeLabel && (
            <span className="absolute -top-5 right-1 text-[10px] text-gray-600 font-mono tabular-nums opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 pointer-events-none select-none">
              {timeLabel}
            </span>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full bg-[oklch(0.09_0.01_280)] text-white rounded-lg p-3 min-h-[100px] focus:outline-none focus:ring-1 focus:ring-blue-500/60 text-sm resize-none"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold text-white transition-colors">
                  <CheckCheck className="w-3.5 h-3.5" /> Save
                </button>
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[oklch(0.18_0.02_280)] hover:bg-[oklch(0.22_0.02_280)] rounded-lg text-xs font-semibold text-gray-300 transition-colors">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {isUser
                ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                : <MarkdownContent text={message.content} />
              }
            </>
          )}
        </div>

        {/* Assistant metadata bar — shown below bubble */}
        {!isUser && !isEditing && (
          <div className="mt-2 flex items-center gap-3 px-1">
            {/* Model + time */}
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
              {message.modelUsed && (
                <span className="flex items-center gap-1">
                  <Brain className="w-3 h-3 text-purple-500/50" />
                  <span className="font-mono">{message.modelUsed.replace(/grok-[34](-fast)?/i, 'Grok 4').replace('Grok 3', 'Grok 4')}</span>
                </span>
              )}
              {message.processingTime && (
                <span className="flex items-center gap-0.5 ml-1">
                  <Zap className="w-2.5 h-2.5 text-yellow-500/50" />
                  <span className="tabular-nums font-mono">{message.processingTime}ms</span>
                </span>
              )}
              {message.confidence != null && (
                <span className={cn(
                  'ml-1 tabular-nums font-semibold',
                  message.confidence >= 75 ? 'text-emerald-500/70' :
                  message.confidence >= 50 ? 'text-yellow-500/70' : 'text-red-500/70',
                )}>
                  {message.confidence}%
                </span>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons — reveal on group hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
              <button
                onClick={handleCopy}
                title="Copy"
                className="p-1.5 rounded-md hover:bg-[oklch(0.18_0.02_280)] text-gray-600 hover:text-gray-300 transition-all"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                title="Edit"
                className="p-1.5 rounded-md hover:bg-[oklch(0.18_0.02_280)] text-gray-600 hover:text-gray-300 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              {message.trustMetrics && (
                <button
                  onClick={() => setShowTrust(v => !v)}
                  title="Trust metrics"
                  className={cn(
                    'p-1.5 rounded-md transition-all',
                    showTrust
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'hover:bg-[oklch(0.18_0.02_280)] text-gray-600 hover:text-gray-300',
                  )}
                >
                  <Shield className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sources — compact pills */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 px-1">
            {message.sources.map((src, idx) => {
              const style = reliabilityStyle(src.reliability);
              return (
                <span
                  key={idx}
                  className={cn('inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border', style.badge)}
                  title={`${src.name} — ${src.reliability}% reliability`}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
                  <SourceIcon type={src.type} />
                  <span className="font-medium">{src.name}</span>
                  <span className="opacity-60">{src.reliability}%</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Trust metrics — collapsible */}
        {showTrust && message.trustMetrics && (
          <div className="mt-2 px-1 animate-fade-in-up">
            <TrustMetricsDisplay metrics={message.trustMetrics} showDetails />
          </div>
        )}
      </div>
    </div>
  );
}
