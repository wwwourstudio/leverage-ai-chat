'use client';

import { ThumbsUp, ThumbsDown, RotateCcw, Volume2, Edit3, Copy, Clock } from 'lucide-react';

interface MessageActionsToolbarMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  voted?: 'up' | 'down';
  isError?: boolean;
  isPartial?: boolean;
  isWelcome?: boolean;
}

interface MessageActionsToolbarProps {
  message: MessageActionsToolbarMessage;
  index: number;
  editingMessageIndex: number | null;
  speakingMessageId: string | null;
  onEdit: (index: number) => void;
  onVote: (index: number, dir: 'up' | 'down') => void;
  onRegenerate: (index: number) => void;
  onSpeak: (messageId: string, content: string) => void;
  onStopSpeak: () => void;
  onCopy: (content: string) => void;
}

export function MessageActionsToolbar({
  message,
  index,
  editingMessageIndex,
  speakingMessageId,
  onEdit,
  onVote,
  onRegenerate,
  onSpeak,
  onStopSpeak,
  onCopy,
}: MessageActionsToolbarProps) {
  if (message.isWelcome) return null;

  return (
    <div className={`flex items-center flex-nowrap gap-0.5 mt-2 ${message.role === 'assistant' ? 'ml-11' : ''}`}>
      {message.role === 'user' && editingMessageIndex !== index && (
        <button
          onClick={() => onEdit(index)}
          className="p-1.5 rounded-lg transition-all group/action border border-transparent hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)]"
          title="Edit this message"
          aria-label="Edit message"
        >
          <Edit3 className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover/action:text-blue-400 transition-colors" />
        </button>
      )}
      {message.role === 'assistant' && (
        <>
          <button
            onClick={() => message.voted !== 'up' && onVote(index, 'up')}
            className={`p-1.5 rounded-lg transition-all group/action border ${
              message.voted === 'up'
                ? 'bg-blue-500/15 border-blue-500/40 cursor-default'
                : 'hover:bg-blue-500/10 active:bg-blue-500/20 border-transparent hover:border-blue-500/30'
            }`}
            title="This response was helpful"
            aria-label="Mark as helpful"
          >
            <ThumbsUp className={`w-3.5 h-3.5 transition-colors ${message.voted === 'up' ? 'text-blue-400 fill-blue-400/30' : 'text-[var(--text-faint)] group-hover/action:text-blue-400'}`} />
          </button>
          <button
            onClick={() => message.voted !== 'down' && onVote(index, 'down')}
            className={`p-1.5 rounded-lg transition-all group/action border ${
              message.voted === 'down'
                ? 'bg-red-500/15 border-red-500/40 cursor-default'
                : 'hover:bg-red-500/10 active:bg-red-500/20 border-transparent hover:border-red-500/30'
            }`}
            title="This response needs improvement"
            aria-label="Mark as needing improvement"
          >
            <ThumbsDown className={`w-3.5 h-3.5 transition-colors ${message.voted === 'down' ? 'text-red-400 fill-red-400/30' : 'text-[var(--text-faint)] group-hover/action:text-red-400'}`} />
          </button>
          <button
            onClick={() => onRegenerate(index)}
            className={`flex items-center gap-1 p-1.5 rounded-lg transition-all group/action border ${
              message.isError
                ? 'text-red-400 bg-red-950/30 border-red-800/40 hover:bg-red-900/40'
                : message.isPartial
                  ? 'text-amber-400 bg-amber-950/30 border-amber-800/40 hover:bg-amber-900/40'
                  : 'hover:bg-purple-500/10 active:bg-purple-500/20 border-transparent hover:border-purple-500/30'
            }`}
            title="Regenerate this response"
            aria-label="Regenerate response"
          >
            <RotateCcw className={`w-3.5 h-3.5 transition-colors ${
              message.isError ? 'text-red-400' : message.isPartial ? 'text-amber-400' : 'text-[var(--text-faint)] group-hover/action:text-purple-400'
            }`} />
            {(message.isError || message.isPartial) && (
              <span className="text-[11px] font-medium">Retry</span>
            )}
          </button>
          <button
            onClick={() => {
              if (speakingMessageId === message.id) {
                onStopSpeak();
              } else {
                onSpeak(message.id, message.content);
              }
            }}
            className={`p-1.5 rounded-lg transition-all group/action border ${
              speakingMessageId === message.id
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-400 animate-pulse'
                : 'hover:bg-blue-500/10 active:bg-blue-500/20 border-transparent hover:border-blue-500/30'
            }`}
            title={speakingMessageId === message.id ? 'Stop speaking' : 'Read aloud'}
            aria-label={speakingMessageId === message.id ? 'Stop speaking' : 'Read aloud'}
          >
            <Volume2 className={`w-3.5 h-3.5 transition-colors ${speakingMessageId === message.id ? 'text-blue-400' : 'text-[var(--text-faint)] group-hover/action:text-blue-400'}`} />
          </button>
        </>
      )}
      <button
        onClick={() => onCopy(message.content)}
        className="p-1.5 rounded-lg hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-all group/action border border-transparent hover:border-cyan-500/30"
        title="Copy message to clipboard"
        aria-label="Copy message"
      >
        <Copy className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover/action:text-cyan-400 transition-colors" />
      </button>
      <div className="ml-auto flex items-center gap-1 px-2 py-1 bg-[var(--bg-overlay)] rounded-md border border-[var(--border-subtle)]">
        <Clock className="w-3 h-3 text-[var(--text-faint)]" />
        <span suppressHydrationWarning className="text-[10px] font-medium text-[var(--text-faint)] tabular-nums">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
