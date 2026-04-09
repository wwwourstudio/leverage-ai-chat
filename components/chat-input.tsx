'use client';

import { memo, useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { Send, X, Paperclip, FileText, ImageIcon, Bookmark, Sparkles, Brain, Square, Mic, MicOff } from 'lucide-react';
import { useToast } from '@/components/toast-provider';
import { useVoiceInput } from '@/lib/hooks/use-voice-input';

interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'csv' | 'text' | 'json';
  url: string;
  size: number;
  data?: { headers: string[]; rows: string[][] } | null;
  textContent?: string | null;
  imageBase64?: string | null;
  mimeType?: string | null;
}

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isTyping: boolean;
  onStopGeneration: () => void;
  uploadedFiles: FileAttachment[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (id: string) => void;
  onSaveFile: (file: FileAttachment) => void;
  onFileDrop: (files: FileList) => Promise<FileAttachment[]>;
  onFilesAdded: (files: FileAttachment[]) => void;
  creditsRemaining: number;
  onOpenStripe: () => void;
  lastUserQuery: string;
  selectedCategory: string;
  placeholder?: string;
  deepThink?: boolean;
  onToggleDeepThink?: () => void;
  systemStatus?: 'ok' | 'degraded' | 'down';
}

const MAX_CHARS = 2000;

export const ChatInput = memo(function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isTyping,
  onStopGeneration,
  uploadedFiles,
  onFileUpload,
  onRemoveFile,
  onSaveFile,
  onFileDrop,
  onFilesAdded,
  creditsRemaining,
  onOpenStripe,
  lastUserQuery,
  selectedCategory,
  placeholder,
  deepThink = false,
  onToggleDeepThink,
}: ChatInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const { isRecording, isSupported: micSupported, toggle: toggleMic } = useVoiceInput(
    useCallback((transcript: string) => {
      onInputChange(input ? `${input} ${transcript}` : transcript);
    }, [input, onInputChange]),
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    });
  }, [input]);

  const defaultPlaceholder = placeholder ?? (lastUserQuery
    ? `Follow up on your ${
        lastUserQuery.toLowerCase().includes('nba') ? 'NBA' :
        lastUserQuery.toLowerCase().includes('nfl') ? 'NFL' :
        lastUserQuery.toLowerCase().includes('kalshi') ? 'Kalshi' :
        lastUserQuery.toLowerCase().includes('dfs') ? 'DFS' :
        lastUserQuery.toLowerCase().includes('fantasy') ? 'fantasy' : 'sports'
      } analysis or ask something new...`
    : selectedCategory === 'fantasy' ? 'Ask about draft picks, waiver wire, ADP values...'
    : selectedCategory === 'dfs' ? 'Build a DFS lineup, find value plays...'
    : selectedCategory === 'kalshi' ? 'Ask about prediction markets, implied odds, edge...'
    : 'Ask about betting odds, fantasy, DFS, or Kalshi markets...');

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  }, [onSubmit]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = await onFileDrop(e.dataTransfer.files);
    if (dropped.length > 0) onFilesAdded(dropped);
  }, [onFileDrop, onFilesAdded]);

  const charsLeft = MAX_CHARS - input.length;
  const nearLimit = charsLeft <= 200;
  const overLimit = charsLeft < 0;
  const charPct = Math.min(input.length / MAX_CHARS, 1);
  const RING_R = 7;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C * (1 - charPct);
  const ringColor = overLimit ? '#f87171' : nearLimit ? '#fb923c' : '#3b82f6';
  const canSubmit = (input.trim().length > 0 || uploadedFiles.length > 0) && !overLimit;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg,image/gif,image/webp,text/csv,.tsv,text/tab-separated-values,text/plain,.txt,.json,application/json,.pdf,application/pdf"
        multiple
        onChange={onFileUpload}
        className="hidden"
      />

      {/* Attached file chips — shown above the card */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-xs"
            >
              {file.type === 'image'
                ? <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                : <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              <span className="font-medium text-foreground/80 max-w-[100px] truncate">{file.name}</span>
              <span className="text-[var(--text-faint)]">{(file.size / 1024).toFixed(0)}KB</span>
              <button
                onClick={() => { onSaveFile(file); toast.success('Saved'); }}
                className="p-0.5 rounded hover:bg-blue-500/20 transition-colors"
                title="Save to profile"
              >
                <Bookmark className="w-3 h-3 text-[var(--text-faint)] hover:text-blue-400" />
              </button>
              <button
                onClick={() => onRemoveFile(file.id)}
                className="p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3 text-[var(--text-faint)] hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main card */}
      <form
        onSubmit={onSubmit}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl border transition-all duration-200 ${
          isDragOver
            ? 'border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/30'
            : 'bg-[var(--bg-overlay)] border-[var(--border-subtle)] hover:border-[var(--border-hover)] focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/20'
        }`}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Paperclip className="w-6 h-6 text-blue-400" />
              <span className="text-sm font-semibold text-blue-300">Drop to attach</span>
            </div>
          </div>
        )}

        {/* Textarea + inline attach */}
        <div className="flex items-start">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => { if (e.target.value.length <= MAX_CHARS + 10) onInputChange(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder={defaultPlaceholder}
            disabled={isTyping}
            className="flex-1 bg-transparent resize-none pl-4 pr-2 pt-3 pb-2 text-[13px] sm:text-sm leading-tight sm:leading-relaxed font-medium text-foreground placeholder-[var(--text-faint)] focus:outline-none disabled:opacity-50"
            style={{ minHeight: '52px', maxHeight: '180px' }}
          />
          {/* Attach — floats right of textarea, vertically centered */}
          <div className="flex items-center pt-3 pr-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping}
              title="Attach file"
              className="flex items-center justify-center w-8 h-8 rounded-xl text-[var(--text-faint)] hover:text-foreground hover:bg-[var(--bg-elevated)] border border-transparent hover:border-[var(--border-subtle)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          {/* Left: mic + think harder */}
          <div className="flex items-center gap-1.5">
            {/* Voice input */}
            {micSupported && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={isTyping}
                title={isRecording ? 'Stop recording' : 'Voice input'}
                className={`flex items-center justify-center h-8 w-8 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isRecording
                    ? 'bg-red-500/15 border-red-500/40 text-red-400 animate-pulse'
                    : 'text-[var(--text-faint)] border-transparent hover:text-foreground hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)]'
                }`}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            {/* Think Harder */}
            {onToggleDeepThink && (
              <button
                type="button"
                onClick={onToggleDeepThink}
                disabled={isTyping}
                title={deepThink ? 'Think Harder ON' : 'Think Harder'}
                className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  deepThink
                    ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-300'
                    : 'text-[var(--text-faint)] border-transparent hover:text-foreground hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <Brain className={`w-3.5 h-3.5 shrink-0 ${deepThink ? 'text-indigo-300' : ''}`} />
                <span className="hidden sm:inline">Think Harder</span>
              </button>
            )}
          </div>

          {/* Right: char ring + credits + send/stop */}
          <div className="flex items-center gap-2">
            {/* Credits */}
            <button
              type="button"
              onClick={onOpenStripe}
              className={`hidden sm:flex items-center gap-1 h-8 px-2.5 rounded-xl text-[10px] font-semibold border transition-all hover:opacity-80 ${
                creditsRemaining <= 3
                  ? 'text-orange-400 bg-orange-500/10 border-orange-500/25'
                  : 'text-[var(--text-muted)] bg-transparent border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {creditsRemaining} {creditsRemaining === 1 ? 'credit' : 'credits'}
            </button>

            {/* Char counter — appears near limit */}
            {input.length > MAX_CHARS * 0.65 && (
              <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                <svg className="-rotate-90 absolute inset-0 w-8 h-8" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="16" cy="16" r="12" fill="none" stroke="var(--border-subtle)" strokeWidth="2.5" />
                  <circle
                    cx="16" cy="16" r="12"
                    fill="none" stroke={ringColor} strokeWidth="2.5"
                    strokeDasharray={2 * Math.PI * 12}
                    strokeDashoffset={(2 * Math.PI * 12) * (1 - charPct)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.2s, stroke 0.2s' }}
                  />
                </svg>
                <span className={`relative z-10 text-[9px] font-bold tabular-nums leading-none ${overLimit ? 'text-red-400' : nearLimit ? 'text-orange-400' : 'text-[var(--text-faint)]'}`}>
                  {overLimit ? `-${Math.abs(charsLeft)}` : charsLeft}
                </span>
              </div>
            )}

            {/* Send / Stop */}
            {isTyping ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] text-[var(--text-muted)] hover:text-foreground text-xs font-semibold transition-all duration-150 active:scale-95"
              >
                <Square className="w-2.5 h-2.5 fill-current shrink-0" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="relative flex items-center gap-1.5 h-8 px-4 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 hover:from-blue-400 hover:via-blue-500 hover:to-violet-500 disabled:from-[oklch(0.17_0.01_280)] disabled:via-[oklch(0.16_0.01_280)] disabled:to-[oklch(0.15_0.01_280)] text-white disabled:text-white/25 text-xs font-bold tracking-wide transition-all duration-200 shadow-lg shadow-blue-900/30 hover:shadow-blue-700/40 disabled:shadow-none disabled:cursor-not-allowed active:scale-95 active:shadow-none disabled:hover:scale-100 overflow-hidden group/send"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 -translate-x-full group-hover/send:translate-x-full transition-transform duration-700 pointer-events-none" />
                <Send className="w-3.5 h-3.5 relative z-10 shrink-0" />
                <span className="relative z-10">Analyze</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </>
  );
});

export type { FileAttachment, ChatInputProps };
