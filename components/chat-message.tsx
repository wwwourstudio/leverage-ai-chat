'use client';

import React from 'react';
import { TrustMetricsDisplay } from '@/components/trust-metrics-display';
import { Shield, Copy, Edit3, CheckCheck, X, Zap, Brain, AlertCircle, Info, RotateCcw, ChevronDown, ChevronUp, Check, TrendingUp } from 'lucide-react';
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
  isPartial?: boolean;
  isError?: boolean;
}

interface ChatMessageProps {
  message: Message;
  onEdit?: (content: string) => void;
  onCopy?: () => void;
  onRetry?: () => void;
}

/** Render inline markdown: **bold**, _italic_, `code` */
function renderInline(text: string): React.ReactNode {
  if (!text.includes('**') && !text.includes('_') && !text.includes('`')) return text;
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldIdx = remaining.indexOf('**');
    const italicIdx = (() => {
      let idx = remaining.indexOf('_');
      while (idx !== -1) {
        const before = idx > 0 ? remaining[idx - 1] : ' ';
        const after = idx + 1 < remaining.length ? remaining[idx + 1] : ' ';
        if (/\w/.test(before) && /\w/.test(after)) { idx = remaining.indexOf('_', idx + 1); } else { break; }
      }
      return idx;
    })();
    const codeIdx = remaining.indexOf('`');
    const candidates = [boldIdx !== -1 ? boldIdx : Infinity, italicIdx !== -1 ? italicIdx : Infinity, codeIdx !== -1 ? codeIdx : Infinity];
    const earliest = Math.min(...candidates);
    if (earliest === Infinity) { parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>); break; }
    if (earliest > 0) { parts.push(<React.Fragment key={key++}>{remaining.slice(0, earliest)}</React.Fragment>); remaining = remaining.slice(earliest); }
    if (remaining.startsWith('**')) {
      const close = remaining.indexOf('**', 2);
      if (close === -1) { parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>); break; }
      parts.push(<strong key={key++} className="font-semibold text-white">{remaining.slice(2, close)}</strong>);
      remaining = remaining.slice(close + 2); continue;
    }
    if (remaining.startsWith('`')) {
      const close = remaining.indexOf('`', 1);
      if (close === -1) { parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>); break; }
      parts.push(<code key={key++} className="px-1.5 py-0.5 rounded-md bg-[oklch(0.16_0.015_280)] text-emerald-300 font-mono text-[0.82em] border border-[oklch(0.22_0.015_280)]">{remaining.slice(1, close)}</code>);
      remaining = remaining.slice(close + 1); continue;
    }
    if (remaining.startsWith('_')) {
      const close = remaining.indexOf('_', 1);
      if (close === -1) { parts.push(<React.Fragment key={key++}>{remaining}</React.Fragment>); break; }
      parts.push(<em key={key++} className="italic text-[oklch(0.72_0.008_85)]">{remaining.slice(1, close)}</em>);
      remaining = remaining.slice(close + 1); continue;
    }
    parts.push(<React.Fragment key={key++}>{remaining[0]}</React.Fragment>);
    remaining = remaining.slice(1);
  }
  return <>{parts}</>;
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let numberedBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';

  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${key}`} className="space-y-1.5 my-2.5 ml-0.5">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[oklch(0.80_0.006_85)]">
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shrink-0" aria-hidden="true" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  const flushNumbered = (key: string) => {
    if (numberedBuffer.length === 0) return;
    elements.push(
      <ol key={`ol-${key}`} className="space-y-1.5 my-2.5 ml-0.5">
        {numberedBuffer.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[oklch(0.80_0.006_85)]">
            <span className="mt-0.5 min-w-[18px] h-[18px] rounded bg-[oklch(0.22_0.025_260)] text-[oklch(0.60_0.02_260)] text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
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
      <div key={`code-${key}`} className="my-3 rounded-xl overflow-hidden border border-[oklch(0.20_0.018_280)] shadow-lg shadow-black/20">
        {codeLang && (
          <div className="flex items-center justify-between px-4 py-2 bg-[oklch(0.14_0.014_280)] border-b border-[oklch(0.20_0.018_280)]">
            <span className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-wider">{codeLang}</span>
            <span className="flex gap-1.5">
              {['bg-red-500/50','bg-yellow-500/50','bg-green-500/50'].map((c,i) => <span key={i} className={`w-2 h-2 rounded-full ${c}`} />)}
            </span>
          </div>
        )}
        <pre className="px-4 py-3.5 bg-[oklch(0.09_0.01_280)] text-[13px] font-mono text-[oklch(0.78_0.008_280)] overflow-x-auto leading-relaxed">
          <code>{codeBuffer.join('\n')}</code>
        </pre>
      </div>
    );
    codeBuffer = []; codeLang = '';
  };

  const flushAll = (key: string) => { flushBullets(key); flushNumbered(key); };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) { flushAll(String(i)); inCodeBlock = true; codeLang = trimmed.slice(3).trim(); }
      else { inCodeBlock = false; flushCode(String(i)); }
      return;
    }
    if (inCodeBlock) { codeBuffer.push(line); return; }

    if (trimmed.startsWith('### ')) {
      flushAll(String(i));
      elements.push(<p key={i} className="text-[11px] font-bold text-[oklch(0.55_0.04_280)] mt-3 mb-1 uppercase tracking-widest">{trimmed.slice(4)}</p>);
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushAll(String(i));
      elements.push(
        <div key={i} className="flex items-center gap-2 mt-4 mb-2">
          <div className="h-px flex-1 bg-gradient-to-r from-[oklch(0.28_0.025_260)] to-transparent" />
          <p className="text-[12px] font-bold text-[oklch(0.65_0.05_260)] uppercase tracking-wider px-1">{trimmed.slice(3)}</p>
          <div className="h-px flex-1 bg-gradient-to-l from-[oklch(0.28_0.025_260)] to-transparent" />
        </div>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushAll(String(i));
      elements.push(<p key={i} className="text-[15px] font-bold text-white mt-4 mb-2 tracking-tight">{trimmed.slice(2)}</p>);
      return;
    }
    if (/^[-•*]\s/.test(trimmed)) { flushNumbered(String(i)); bulletBuffer.push(trimmed.slice(2).trim()); return; }
    if (/^\d+\.\s/.test(trimmed)) { flushBullets(String(i)); numberedBuffer.push(trimmed.replace(/^\d+\.\s/, '').trim()); return; }
    if (trimmed === '') {
      flushAll(String(i));
      if (elements.length > 0) elements.push(<div key={`gap-${i}`} className="h-1.5" />);
      return;
    }
    flushAll(String(i));
    elements.push(<p key={i} className="text-sm leading-relaxed text-[oklch(0.82_0.006_85)]">{renderInline(trimmed)}</p>);
  });

  flushAll('end');
  if (inCodeBlock) flushCode('eof');
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

const COLLAPSE_THRESHOLD = 3000;

export const ChatMessage = React.memo(function ChatMessage({ message, onEdit, onCopy, onRetry }: ChatMessageProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);
  const [showTrust, setShowTrust] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const isLong = message.role === 'assistant' && message.content.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = React.useState(false);

  const handleSaveEdit = () => { onEdit?.(editContent); setIsEditing(false); };

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isUser = message.role === 'user';

  return (
    <div
      role="article"
      aria-label={isUser ? 'User message' : 'AI response'}
      className={cn('flex gap-3 group/msg', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* AI avatar */}
      {!isUser && (
        <div className="shrink-0 mt-0.5">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500/30 to-teal-600/30 blur-sm" />
            <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </div>
      )}

      <div className={cn('min-w-0', isUser ? 'max-w-[78%]' : 'max-w-[82%] flex-1')}>
        {/* User message bubble */}
        {isUser ? (
          isEditing ? (
            <div className="space-y-2.5 bg-[oklch(0.14_0.02_260)] border border-[oklch(0.28_0.04_260)] rounded-2xl rounded-tr-sm px-4 py-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-transparent text-white rounded-lg focus:outline-none text-sm resize-none min-h-[80px]"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white font-medium transition-colors">
                  <CheckCheck className="w-3.5 h-3.5" /> Save
                </button>
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[oklch(0.22_0.01_280)] hover:bg-[oklch(0.28_0.01_280)] rounded-lg text-xs text-white/70 font-medium transition-colors">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="relative group/user">
              <div className="bg-gradient-to-br from-[oklch(0.32_0.08_260)] via-[oklch(0.28_0.07_265)] to-[oklch(0.24_0.06_270)] text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg shadow-[oklch(0.15_0.04_260)/0.25] border border-[oklch(0.38_0.06_260)/0.5]">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
              {/* Hover actions */}
              <div className="absolute -bottom-5 right-0 hidden group-hover/user:flex items-center gap-1 opacity-0 group-hover/user:opacity-100 transition-all duration-150">
                {onEdit && (
                  <button onClick={() => setIsEditing(true)} className="p-1 rounded hover:bg-[oklch(0.18_0.01_280)] text-[oklch(0.40_0.01_280)] hover:text-white/70 transition-colors">
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          /* AI response */
          <div className={cn(
            'rounded-2xl rounded-tl-sm border shadow-sm overflow-hidden',
            message.isError
              ? 'bg-[oklch(0.10_0.02_15)] border-red-900/40 border-l-2 border-l-red-500/70'
              : message.isPartial
                ? 'bg-[oklch(0.10_0.012_280)] border-[oklch(0.20_0.018_280)] border-l-2 border-l-amber-500/60'
                : 'bg-[oklch(0.105_0.012_280)] border-[oklch(0.20_0.018_280)]',
          )}>
            {/* Top accent line for normal messages */}
            {!message.isError && !message.isPartial && (
              <div className="h-px w-full bg-gradient-to-r from-emerald-500/30 via-teal-500/20 to-transparent" />
            )}

            <div className="px-5 py-4">
              {/* Error / partial banners */}
              {message.isError && (
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-red-900/30">
                  <div className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                  </div>
                  <span className="text-xs font-semibold text-red-400">Response failed</span>
                  {onRetry && (
                    <button onClick={onRetry} className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50 px-2.5 py-1 rounded-lg transition-colors font-medium">
                      <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </div>
              )}
              {message.isPartial && (
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-amber-900/25">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-400 font-medium">Partial response</span>
                  {onRetry && (
                    <button onClick={onRetry} className="ml-auto flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-lg transition-colors">
                      <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </div>
              )}

              {/* Message content */}
              {isLong && !expanded ? (
                <>
                  <MarkdownContent text={message.content.slice(0, COLLAPSE_THRESHOLD)} />
                  <button
                    onClick={() => setExpanded(true)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-[oklch(0.50_0.04_260)] hover:text-[oklch(0.65_0.06_260)] transition-colors group/exp"
                  >
                    <ChevronDown className="w-3.5 h-3.5 group-hover/exp:translate-y-0.5 transition-transform" />
                    <span>Show full response</span>
                    <span className="text-[oklch(0.38_0.01_280)]">({Math.ceil((message.content.length - COLLAPSE_THRESHOLD) / 1000)}k more)</span>
                  </button>
                </>
              ) : (
                <>
                  <MarkdownContent text={message.content} />
                  {isLong && expanded && (
                    <button
                      onClick={() => setExpanded(false)}
                      className="mt-3 flex items-center gap-1.5 text-xs text-[oklch(0.50_0.04_260)] hover:text-[oklch(0.65_0.06_260)] transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" /> Collapse
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer metadata bar */}
            <div className="px-5 py-2.5 bg-[oklch(0.085_0.008_280)] border-t border-[oklch(0.16_0.014_280)] flex items-center gap-3">
              {/* Model chip */}
              {message.modelUsed && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[oklch(0.45_0.02_280)] bg-[oklch(0.14_0.012_280)] border border-[oklch(0.20_0.015_280)] rounded-md px-1.5 py-0.5">
                  <Brain className="w-2.5 h-2.5 text-[oklch(0.45_0.05_290)]" />
                  {message.modelUsed.replace(/grok-[34](-fast)?/i, 'Grok 4').replace('Grok 3', 'Grok 4')}
                </span>
              )}

              {/* Processing time */}
              {message.processingTime && (
                <span className="flex items-center gap-1 text-[10px] text-[oklch(0.40_0.01_280)]">
                  <Zap className="w-2.5 h-2.5 text-yellow-500/50" />
                  {message.processingTime < 1000 ? `${message.processingTime}ms` : `${(message.processingTime/1000).toFixed(1)}s`}
                </span>
              )}

              {/* Confidence badge */}
              {message.confidence != null && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-md border',
                  message.confidence >= 80
                    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                    : message.confidence >= 60
                      ? 'text-amber-400 bg-amber-950/30 border-amber-800/30'
                      : 'text-[oklch(0.45_0.01_280)] bg-[oklch(0.14_0.01_280)] border-[oklch(0.20_0.01_280)]'
                )}>
                  {message.confidence}% conf
                </span>
              )}

              {/* Sources count */}
              {message.sources && message.sources.length > 0 && (
                <span className="text-[10px] text-[oklch(0.40_0.01_280)]">
                  {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
                </span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action buttons */}
              {onRetry && !message.isError && !message.isPartial && (
                <button
                  onClick={onRetry}
                  title="Retry"
                  className="p-1 rounded-md text-[oklch(0.38_0.01_280)] hover:text-white/60 hover:bg-[oklch(0.16_0.01_280)] transition-all opacity-0 group-hover/msg:opacity-100"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={handleCopy}
                title="Copy response"
                className="p-1 rounded-md text-[oklch(0.38_0.01_280)] hover:text-white/60 hover:bg-[oklch(0.16_0.01_280)] transition-all opacity-0 group-hover/msg:opacity-100"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
              {onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  title="Edit"
                  className="p-1 rounded-md text-[oklch(0.38_0.01_280)] hover:text-white/60 hover:bg-[oklch(0.16_0.01_280)] transition-all opacity-0 group-hover/msg:opacity-100"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
              {message.trustMetrics && (
                <button
                  onClick={() => setShowTrust(v => !v)}
                  title="Trust metrics"
                  className={cn(
                    'p-1 rounded-md transition-all opacity-0 group-hover/msg:opacity-100',
                    showTrust ? 'text-emerald-400 bg-emerald-950/40 opacity-100' : 'text-[oklch(0.38_0.01_280)] hover:text-white/60 hover:bg-[oklch(0.16_0.01_280)]'
                  )}
                >
                  <Shield className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Trust panel */}
            {showTrust && message.trustMetrics && (
              <div className="px-5 py-3 bg-[oklch(0.08_0.008_280)] border-t border-[oklch(0.16_0.014_280)]">
                <TrustMetricsDisplay metrics={message.trustMetrics} showDetails={true} />
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        {message.timestamp && (
          <p
            suppressHydrationWarning
            className={cn('text-[10px] mt-1.5 text-[oklch(0.34_0.006_280)]', isUser ? 'text-right pr-1' : 'text-left pl-1')}
          >
            {formatRelativeTime(message.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
});
